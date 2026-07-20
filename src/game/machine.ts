import { clamp, damp } from "../core/math.ts";
import type { RunMods, TileKind } from "./config.ts";
import { GRID, MACHINE, TILE_DEFS } from "./config.ts";
import type { Terrain } from "./terrain.ts";
import { clearTile, kindAt } from "./terrain.ts";

export type MachineState = "drilling" | "charging" | "dashing" | "hurt";

/** 1フレームぶんの入力 */
export interface Ctrl {
  pressed: boolean;
  /** このフレームの横ドラッグ量(列単位に換算済み) */
  dragCols: number;
  keyDir: number;
}

/** worldが実装するコールバック。machineはスコアもストレージも知らない */
export interface MachineHost {
  dig(col: number, row: number): void;
  smash(col: number, row: number, kind: TileKind): void;
  clang(col: number, row: number): void;
  pickup(col: number, row: number, kind: "ore" | "gem", duringDash: boolean): void;
  gasBurst(col: number, row: number, harmless: boolean): void;
  damaged(hpLeft: number, col: number, row: number): void;
  reachCore(): void;
  dashStart(tier: number): void;
  dashEnd(smashed: number, tier: number): void;
  tierUp(tier: number): void;
}

/**
 * ドリル機体。drilling(自動掘削) →押す→ charging(停止・横移動可)
 * →離す→ dashing(貫通) →停止→ drilling。被弾で hurt(ノックバック+無敵)。
 */
export class Machine {
  col: number = GRID.COLS / 2;
  targetCol: number = GRID.COLS / 2;
  depth = -1.2; // 地表の少し上から降りてくる
  state: MachineState = "drilling";
  stateT = 0;
  chargeT = 0;
  attackTier = 0;
  dashLeft = 0;
  hp: number;
  invulnT = 0;
  /** このダッシュで壊したタイル数 */
  private dashSmashed = 0;
  /** 直近のドラッグ操縦からの経過ロック(>0の間はチャージが増えない) */
  private recentMoveT = 0;

  constructor(private mods: RunMods) {
    this.hp = mods.maxHp;
  }

  get chargeTier(): number {
    return this.chargeT >= this.mods.chargeT3 ? 2 : this.chargeT >= this.mods.chargeT2 ? 1 : 0;
  }

  get chargeRatio(): number {
    return Math.min(this.chargeT / this.mods.chargeT3, 1);
  }

  get maxHp(): number {
    return this.mods.maxHp;
  }

  update(dt: number, ctrl: Ctrl, t: Terrain, host: MachineHost): void {
    this.stateT += dt;
    this.invulnT = Math.max(this.invulnT - dt, 0);

    // 操縦中の検出(タッチイベントは数フレームおきに届くので時間ロックで均す)
    if (Math.abs(ctrl.dragCols) > MACHINE.CHARGE_MOVE_EPS || ctrl.keyDir !== 0) {
      this.recentMoveT = MACHINE.CHARGE_MOVE_LOCK;
    } else {
      this.recentMoveT = Math.max(this.recentMoveT - dt, 0);
    }

    // 横移動(ダッシュ中はロック=コミット感)
    if (this.state !== "dashing" && this.state !== "hurt") {
      this.targetCol += ctrl.dragCols + ctrl.keyDir * MACHINE.KEY_SPEED * dt;
      this.targetCol = clamp(this.targetCol, 0.5, GRID.COLS - 0.5);
      this.moveHorizontal(dt, t, host);
    } else {
      this.targetCol = this.col;
    }

    switch (this.state) {
      case "drilling":
        if (ctrl.pressed) {
          this.state = "charging";
          this.stateT = 0;
          this.chargeT = 0;
          break;
        }
        this.advanceVertical(dt, t, host);
        break;

      case "charging": {
        // 操縦中(直近にドラッグあり)はチャージが増えない(値は保持)。
        // これで「操縦のつもりが勝手にダッシュ」の誤爆を構造的に防ぐ
        if (this.recentMoveT <= 0) {
          const prev = this.chargeTier;
          this.chargeT += dt;
          if (this.chargeTier > prev) host.tierUp(this.chargeTier);
        }
        if (!ctrl.pressed) {
          if (this.chargeT < MACHINE.CHARGE_T1) {
            // 最低チャージ未満: ダッシュせず掘削に戻る(操縦だけのタッチ)
            this.state = "drilling";
            this.stateT = 0;
            break;
          }
          this.attackTier = this.chargeTier;
          this.dashLeft = MACHINE.TIERS[this.attackTier].rows;
          this.dashSmashed = 0;
          this.state = "dashing";
          this.stateT = 0;
          host.dashStart(this.attackTier);
        }
        break;
      }

      case "dashing":
        this.advanceDash(dt, t, host);
        break;

      case "hurt":
        if (this.stateT >= MACHINE.HURT_TIME) {
          this.state = "drilling";
          this.stateT = 0;
        }
        break;
    }

    // 溶岩・ガスの重なりチェック(横移動やノックバック後の保険)
    this.checkHazardOverlap(t, host);
  }

  /** 自動掘削/落下。硬いタイルの上では停止する */
  private advanceVertical(dt: number, t: Terrain, host: MachineHost): void {
    const c = Math.floor(this.col);
    const r = MACHINE.HITBOX;
    const below = kindAt(t, c, Math.floor(this.depth + r + 0.02));
    let speed: number;
    if (below === "empty") speed = MACHINE.FALL_SPEED;
    else if (TILE_DEFS[below].hardness === 0) speed = MACHINE.DRILL_SPEED;
    else {
      // 岩/鉄骨/溶岩の上で停止(乗る)。溶岩も「上に乗る」は安全=見て考えられる
      const row = Math.floor(this.depth + r + 0.02);
      this.depth = Math.min(this.depth, row - r - 0.001);
      return;
    }
    this.depth += speed * dt;
    this.resolveSoftTiles(t, host, false);
  }

  /** 貫通ダッシュ。行境界ごとに次タイルを判定しながら進む */
  private advanceDash(dt: number, t: Terrain, host: MachineHost): void {
    const tier = MACHINE.TIERS[this.attackTier];
    let remaining = Math.min(tier.speed * dt, this.dashLeft);
    const c = Math.floor(this.col);
    const r = MACHINE.HITBOX;

    while (remaining > 0) {
      const front = this.depth + r;
      const frontRow = Math.floor(front + 1e-6);
      const boundary = frontRow + 1;
      const toBoundary = boundary - front;

      if (toBoundary > remaining) {
        // 行をまたがない移動
        this.depth += remaining;
        this.dashLeft -= remaining;
        remaining = 0;
        break;
      }

      // 次の行のタイルを判定してから境界を越える
      const nextRow = boundary;
      const kind = kindAt(t, c, nextRow);
      const def = TILE_DEFS[kind];

      if (kind === "core") {
        this.depth += toBoundary;
        host.reachCore();
        return;
      }
      if (kind === "lava") {
        // 溶岩に突っ込んだ: 手前で停止+ダメージ(溶岩内に埋まらない)
        this.depth = nextRow - r - 0.001;
        this.endDash(host);
        this.takeDamage(t, host, c, nextRow);
        return;
      }
      if (def.hardness > tier.power) {
        // ティア不足: ノーダメージで停止(ガキン)
        this.depth = nextRow - r - 0.001;
        host.clang(c, nextRow);
        this.endDash(host);
        return;
      }

      // 破壊して進む
      if (kind !== "empty") {
        clearTile(t, c, nextRow);
        if (kind === "ore" || kind === "gem") {
          host.pickup(c, nextRow, kind, true);
        } else if (kind === "gas") {
          this.dashSmashed++;
          host.gasBurst(c, nextRow, true); // ダッシュ中は無害に破壊
        } else {
          this.dashSmashed++;
          host.smash(c, nextRow, kind);
        }
      }
      this.depth += toBoundary;
      this.dashLeft -= toBoundary;
      remaining -= toBoundary;
    }

    if (this.dashLeft <= 1e-6) this.endDash(host);
  }

  private endDash(host: MachineHost): void {
    if (this.state !== "dashing") return;
    host.dashEnd(this.dashSmashed, this.attackTier);
    this.state = "drilling";
    this.stateT = 0;
  }

  /** 横移動。岩/鉄骨は壁、土は削りながら低速、空洞・鉱石は速い追従 */
  private moveHorizontal(dt: number, t: Terrain, host: MachineHost): void {
    const dx = this.targetCol - this.col;
    if (Math.abs(dx) < 1e-4) return;
    const dir = Math.sign(dx);
    const row = Math.floor(this.depth);
    const r = MACHINE.HITBOX;
    const leadCol = Math.floor(this.col + dir * (r + 0.02));
    const curCol = Math.floor(this.col);
    const lead = leadCol !== curCol ? kindAt(t, leadCol, row) : "empty";

    if (lead !== "empty" && TILE_DEFS[lead].hardness > 0) {
      // 壁: それ以上進めない
      this.targetCol = this.col;
      return;
    }
    if (lead === "dirt") {
      // 土: 低速で削りながら進む
      const step = Math.min(Math.abs(dx), MACHINE.SIDE_DIG_SPEED * dt);
      this.col += dir * step;
      if (Math.floor(this.col + dir * (r + 0.02)) === leadCol) {
        clearTile(t, leadCol, row);
        host.dig(leadCol, row);
      }
    } else {
      // 空洞・鉱石・ジェム・ガス等: 速い追従
      this.col += dx * damp(MACHINE.SIDE_FOLLOW, dt);
    }
    this.col = clamp(this.col, 0.5, GRID.COLS - 0.5);
    this.resolveSoftTiles(t, host, false);
  }

  /** 機体中心が重なったソフトタイルの破壊・取得(ダッシュ以外の経路) */
  private resolveSoftTiles(t: Terrain, host: MachineHost, duringDash: boolean): void {
    const c = Math.floor(this.col);
    const row = Math.floor(this.depth);
    const kind = kindAt(t, c, row);
    if (kind === "dirt") {
      clearTile(t, c, row);
      host.dig(c, row);
    } else if (kind === "ore" || kind === "gem") {
      clearTile(t, c, row);
      host.pickup(c, row, kind, duringDash);
    } else if (kind === "core") {
      host.reachCore();
    }
    // gas/lava は checkHazardOverlap で処理
  }

  private checkHazardOverlap(t: Terrain, host: MachineHost): void {
    const c = Math.floor(this.col);
    const row = Math.floor(this.depth);
    const kind = kindAt(t, c, row);
    if (kind === "gas") {
      clearTile(t, c, row);
      host.gasBurst(c, row, false);
      this.takeDamage(t, host, c, row);
    } else if (kind === "lava") {
      this.takeDamage(t, host, c, row);
    }
  }

  private takeDamage(t: Terrain, host: MachineHost, col: number, row: number): void {
    if (this.invulnT > 0) return;
    this.hp -= 1;
    this.invulnT = MACHINE.INVULN;
    if (this.state === "dashing") this.endDash(host);
    this.state = "hurt";
    this.stateT = 0;
    // ノックバック: 上へ押し戻す(溶岩の中に留まらせない)
    this.depth = Math.max(this.depth - MACHINE.KNOCKBACK_ROWS, -1.2);
    // 押し戻し先が溶岩だったら更に上へ(保険)
    for (let i = 0; i < 3 && kindAt(t, Math.floor(this.col), Math.floor(this.depth)) === "lava"; i++) {
      this.depth -= 1;
    }
    host.damaged(this.hp, col, row);
  }
}
