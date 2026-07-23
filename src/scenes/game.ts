import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { TAU, clamp, damp, lerp } from "../core/math.ts";
import {
  sfxCount, sfxFall, sfxGo, sfxHop, sfxTick, sfxTimeup, sfxZone,
} from "../audio/sfx.ts";
import { Fx } from "../fx/particles.ts";
import { Juice } from "../fx/juice.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS, FEVER, GAME, LAYOUT, MOTION, ZONES, ZONE_BLEND, skinColor } from "../game/config.ts";
import { t, zoneName } from "../game/i18n.ts";
import { addScore, ensureIdentity } from "../game/save.ts";
import { onlineEnabled, syncBest } from "../game/online.ts";
import type { Side } from "../game/tower.ts";
import { Tower } from "../game/tower.ts";
import { drawFx } from "../render/fx.ts";
import type { SyncStatus } from "./result.ts";
import { ResultScene } from "./result.ts";

export type GameMode = "practice" | "ranked";

type Rgb = [number, number, number];
function hexRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function css([r, g, b]: Rgb, alpha = 1): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}

/** 高度に応じたゾーンindex */
function zoneAt(h: number): number {
  let i = 0;
  for (let z = 0; z < ZONES.length; z++) if (h >= ZONES[z].from) i = z;
  return i;
}

/** 高度に応じた空の色(ゾーン境界はZONE_BLEND mで滑らかに補間) */
function skyColors(h: number): { top: Rgb; bottom: Rgb; tint: Rgb } {
  const i = zoneAt(h);
  const cur = ZONES[i];
  const next = ZONES[i + 1];
  let top = hexRgb(cur.skyTop);
  let bottom = hexRgb(cur.skyBottom);
  let tint = hexRgb(cur.tint);
  if (next) {
    const t = clamp((h - (next.from - ZONE_BLEND)) / ZONE_BLEND, 0, 1);
    if (t > 0) {
      top = mix(top, hexRgb(next.skyTop), t);
      bottom = mix(bottom, hexRgb(next.skyBottom), t);
      tint = mix(tint, hexRgb(next.tint), t);
    }
  }
  return { top, bottom, tint };
}

function hash(n: number): number {
  let h = (n * 2654435761) ^ 0x9e3779b9;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export class GameScene implements Scene {
  private tower = new Tower();
  private fx = new Fx();
  private juice = new Juice();
  private camH = 0;
  private best = 0;
  private taps = 0;
  private endT = 0;
  private finished = false;
  private goFlash = 0;
  private lastKeyDir = 0;
  private t = 0;
  /** 着地で沈む足場: h -> 残り時間 */
  private dips = new Map<number, number>();
  private landSquashT = 1;
  private lastZone = 0;
  private banner: { text: string; t: number } | null = null;
  /** フィーバー: ノーミス連続ホップ数 / 残り時間 */
  private combo = 0;
  private maxCombo = 0;
  private feverT = 0;
  private feverCount = 0;
  private skin = "pink";
  private trailAcc = 0;

  constructor(
    private app: App,
    private mode: GameMode = "practice",
  ) {}

  enter(): void {
    const save = ensureIdentity();
    this.best = save.best;
    this.skin = save.skin;
    logEvent("play_start", { mode: this.mode });
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__climb = {
        tower: this.tower,
        tap: (d: Side) => this.tower.tap(d),
        skip: () => {
          if (this.tower.phase === "count") this.tower.countdown = 0.01;
          else this.tower.timeLeft = Math.min(this.tower.timeLeft, 0.4);
        },
        warp: (h: number) => {
          this.tower.h = h;
          this.tower.maxH = Math.max(this.tower.maxH, h);
          this.camH = h;
        },
        state: () => ({
          scene: "game",
          phase: this.tower.phase,
          h: this.tower.h,
          maxH: this.tower.maxH,
          timeLeft: this.tower.timeLeft,
          nextSide: this.tower.side(this.tower.h + 1),
          colNext: this.tower.col(this.tower.h + 1),
          combo: this.combo,
          fever: this.feverT > 0,
        }),
      };
    }
  }

  update(dt: number): void {
    this.t += dt;
    const { vp, input } = this.app;
    this.juice.update(dt, 7 * vp.unit);
    this.goFlash = Math.max(this.goFlash - dt, 0);
    this.landSquashT += dt;
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    for (const [k, v] of this.dips) {
      if (v - dt <= 0) this.dips.delete(k);
      else this.dips.set(k, v - dt);
    }

    // 開発用: ←→キーでもタップ
    const kd = input.keyDir;
    if (kd !== this.lastKeyDir && kd !== 0) this.tap(kd < 0 ? 0 : 1);
    this.lastKeyDir = kd;

    this.tower.update(dt);
    this.fx.update(dt);

    // フィーバー残り時間(切れたら足場を左右に戻す。直後の1段は両側OKの猶予つき)
    if (this.feverT > 0) {
      this.feverT = Math.max(this.feverT - dt, 0);
      if (this.feverT === 0) this.tower.setFever(false);
    }

    // ホップ中のトレイル(残像パーティクル)
    if (this.tower.anim.kind === "hop") {
      this.trailAcc += dt;
      if (this.trailAcc >= 0.025) {
        this.trailAcc = 0;
        const u = vp.unit;
        const tx = vp.w / 2 + this.tower.visualSide() * LAYOUT.COL_OFFSET * u;
        const ty = vp.h * LAYOUT.ANCHOR + (this.camH - this.tower.visualH()) * LAYOUT.STEP_H * u - LAYOUT.PLAYER_R * u;
        const col = this.feverT > 0 ? `hsl(${Math.floor((this.t * 400) % 360)}, 90%, 65%)` : "rgba(200,220,255,0.7)";
        this.fx.burst(tx, ty, col, 1, 14 * u, 2.6 * u);
      }
    }

    for (const ev of this.tower.drainEvents()) {
      const u = vp.unit;
      switch (ev.type) {
        case "count":
          sfxCount();
          break;
        case "go":
          sfxGo();
          this.goFlash = 0.6;
          break;
        case "hop": {
          sfxHop(ev.h);
          const [x, y] = this.platPos(ev.h - 1);
          // 踏み切り: 砂ぼこり+リング
          this.fx.burst(x, y, "#c9d6ff", 7, 100 * u, 3 * u);
          this.fx.ring(x, y, this.feverT > 0 ? COLORS.gold : "rgba(255,255,255,0.8)", 26 * u, 2 * u, 0.28);
          // フィーバーコンボ(発動で足場が中央1本になり、連打で登れる)
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          if (this.feverT <= 0 && this.combo >= FEVER.REQ) {
            this.combo = 0; // 次のフィーバーはまた0から溜め直し(終了直後の即再発動を防ぐ)
            this.feverT = FEVER.TIME;
            this.feverCount++;
            this.tower.setFever(true);
            logEvent("fever_start");
            sfxZone();
            this.banner = { text: t("feverBanner"), t: 1.4 };
            this.juice.flashScreen(COLORS.gold, 0.22);
            const [bx2, by2] = this.platPos(ev.h);
            this.fx.burst(bx2, by2 - 30 * u, COLORS.gold, 22, 200 * u, 4 * u);
          }
          // ゾーン到達マイルストーン
          const z = zoneAt(ev.h);
          if (z > this.lastZone) {
            this.lastZone = z;
            sfxZone();
            this.banner = { text: t("zoneBanner", { m: ZONES[z].from, name: zoneName(ZONES[z].name) }), t: 1.6 };
            this.juice.flashScreen(ZONES[z].tint, 0.15);
            const [bx, by] = this.platPos(ev.h);
            this.fx.burst(bx, by - 30 * u, ZONES[z].tint, 18, 180 * u, 4 * u);
          } else if (ev.h % 10 === 0) {
            const [bx, by] = this.platPos(ev.h);
            this.fx.float(bx, by - 34 * u, `${ev.h}m!`, COLORS.gold, 13 * u, 0.7);
          }
          break;
        }
        case "landed": {
          this.dips.set(ev.h, MOTION.PLAT_DIP_TIME);
          this.landSquashT = 0;
          // 着地の砂ぼこり(左右へ)
          const [lx, ly] = this.platPos(ev.h);
          this.fx.burst(lx - 14 * u, ly - 2 * u, "rgba(230,236,255,0.7)", 3, 60 * u, 2.4 * u);
          this.fx.burst(lx + 14 * u, ly - 2 * u, "rgba(230,236,255,0.7)", 3, 60 * u, 2.4 * u);
          break;
        }
        case "fellLanded": {
          this.dips.set(ev.h, MOTION.PLAT_DIP_TIME * 1.4);
          this.landSquashT = -0.06; // 重い着地は少し長く潰れる
          const [x, y] = this.platPos(ev.h);
          this.fx.burst(x, y, "#8a93ad", 8, 120 * this.app.vp.unit, 3 * this.app.vp.unit);
          break;
        }
        case "fall": {
          this.combo = 0;
          if (this.feverT > 0) {
            this.feverT = 0; // ミスでフィーバー即終了
            this.tower.setFever(false);
          }
          const dist = ev.from + 1 - ev.to;
          sfxFall(dist);
          this.juice.shake(clamp(0.15 + dist * 0.06, 0.2, 0.6));
          this.juice.flashScreen(COLORS.danger, 0.18);
          break;
        }
        case "tick":
          sfxTick();
          break;
        case "timeup":
          sfxTimeup();
          this.juice.flashScreen(COLORS.gold, 0.2);
          break;
      }
    }

    // カメラ(上へ少し先読み)
    const camTarget = this.tower.visualH() + MOTION.CAM_LOOKAHEAD;
    this.camH += (camTarget - this.camH) * damp(MOTION.CAM_RATE, dt);

    if (this.tower.phase === "done") {
      this.endT += dt;
      if (this.endT >= GAME.END_DELAY && !this.finished) {
        this.finished = true;
        const score = this.tower.maxH;
        logEvent("play_end", { mode: this.mode, score, maxCombo: this.maxCombo, fever: this.feverCount });
        const outcome = addScore(score, this.mode === "ranked");
        // ほんばんのみ世界へ送信。判定はsyncBest(rankedBest > lastSynced)。
        // 失敗しても次回のほんばん終了時かランキング画面で自動再送される。
        const sync: SyncStatus = { state: "none" };
        if (this.mode === "ranked" && onlineEnabled()) {
          sync.state = "sending";
          void syncBest().then((r) => {
            sync.state = r === "sent" ? "ok" : r === "failed" ? "fail" : "none";
          });
        }
        this.app.manager.switchTo(
          new ResultScene(this.app, {
            score,
            rank: outcome.rank,
            newBest: outcome.newBest,
            best: outcome.save.best,
            mode: this.mode,
            sync,
          }),
        );
      }
    }
  }

  private tap(d: Side): void {
    if (this.tower.tap(d)) this.taps++;
  }

  private dipOf(h: number): number {
    const left = this.dips.get(h);
    if (left === undefined) return 0;
    const t = 1 - left / MOTION.PLAT_DIP_TIME;
    return Math.sin(Math.min(t, 1) * Math.PI) * MOTION.PLAT_DIP * this.app.vp.unit;
  }

  /** h段目の足場の画面座標(中心, 沈み込み込み)。フィーバー中は中央 */
  private platPos(h: number): [number, number] {
    const { vp } = this.app;
    const u = vp.unit;
    const anchorY = vp.h * LAYOUT.ANCHOR;
    const x = vp.w / 2 + this.tower.col(h) * LAYOUT.COL_OFFSET * u;
    const y = anchorY + (this.camH - h) * LAYOUT.STEP_H * u + this.dipOf(h);
    return [x, y];
  }

  // ==================== 描画 ====================

  /**
   * 高度altにある遠景要素の画面Y。factor<1で遠くに見える。
   * 登るほど(camHが増えるほど)値が増える=要素は下へ流れ去る(標高表現)。
   */
  private py(alt: number, factor: number): number {
    const { vp } = this.app;
    return vp.h * LAYOUT.ANCHOR + (this.camH - alt) * LAYOUT.STEP_H * vp.unit * factor;
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h: H, unit: u } = vp;
    const sky = skyColors(this.camH);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(sky.top));
    g.addColorStop(1, css(sky.bottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, H);

    const scroll = this.camH * LAYOUT.STEP_H * u;
    const onScreen = (y: number, m = 80 * u) => y > -m && y < H + m;

    // 星(空のドームとしてループ。高度が上がるほど濃く)
    const starAlpha = clamp((this.camH - 12) / 30, 0, 0.9);
    if (starAlpha > 0) {
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 26; i++) {
        const sy = ((i * 173 + scroll * 0.25) % (H + 60)) - 30;
        const tw = 0.5 + 0.5 * Math.sin(this.t * (1.2 + (i % 5) * 0.4) + i);
        ctx.globalAlpha = starAlpha * (0.25 + 0.5 * tw) * (0.5 + (i % 3) * 0.25);
        const s = (i % 4 === 0 ? 2.6 : 1.7) * u;
        ctx.fillRect((i * 97 + 31) % w, sy, s, s);
      }
      ctx.globalAlpha = 1;
    }

    // --- 以下は全て「高度アンカー」: 登ると画面の下へ流れ去っていく ---

    // ゆうぐれ: 沈む太陽(高度4m)と山のシルエット(高度0m)
    {
      const sunY = this.py(4, 0.3);
      if (onScreen(sunY)) {
        ctx.fillStyle = css(hexRgb("#ffb03c"), 0.85);
        ctx.beginPath();
        ctx.arc(w * 0.72, sunY, 26 * u, 0, TAU);
        ctx.fill();
        ctx.fillStyle = css(hexRgb("#ffdca0"), 0.25);
        ctx.beginPath();
        ctx.arc(w * 0.72, sunY, 44 * u, 0, TAU);
        ctx.fill();
      }
      const baseY = this.py(0, 0.35) + H * 0.18;
      if (baseY > -60) {
        ctx.fillStyle = css(mix(hexRgb("#1c1230"), hexRgb("#2a1a40"), 0.5), 0.9);
        ctx.beginPath();
        ctx.moveTo(0, H + 60);
        for (let x = 0; x <= w; x += w / 8) {
          ctx.lineTo(x, baseY - (30 + 70 * hash(Math.floor(x / (w / 8)))) * u);
        }
        ctx.lineTo(w, H + 60);
        ctx.fill();
      }
    }

    // よぞら: 月(高度34m。近づくと上から現れ、登り切ると下へ抜ける)
    {
      const my = this.py(34, 0.25);
      if (onScreen(my)) {
        const mx = w * 0.22;
        ctx.fillStyle = css(hexRgb("#f4ecd0"), 0.95);
        ctx.beginPath();
        ctx.arc(mx, my, 22 * u, 0, TAU);
        ctx.fill();
        ctx.fillStyle = css(sky.top, 1);
        ctx.beginPath();
        ctx.arc(mx + 9 * u, my - 5 * u, 18 * u, 0, TAU);
        ctx.fill();
      }
    }

    // くものうえ: 雲(高度48〜76mに配置+横ドリフト)
    ctx.fillStyle = css(hexRgb("#cbd4ff"), 0.16);
    for (let i = 0; i < 5; i++) {
      const alt = 48 + i * 7;
      const cy = this.py(alt, 0.5);
      if (!onScreen(cy)) continue;
      const cx = ((i * 137 + this.t * (8 + i * 3) * u) % (w + 200)) - 100;
      for (const [ox, oy, r] of [[0, 0, 30], [26, -8, 22], [-26, -4, 20], [10, 8, 24]] as const) {
        ctx.beginPath();
        ctx.arc(cx + ox * u, cy + oy * u, r * u, 0, TAU);
        ctx.fill();
      }
    }

    // うちゅう: 惑星(高度92m)+オーロラ帯(高度86m〜)
    {
      const pyy = this.py(92, 0.2);
      if (onScreen(pyy)) {
        const px = w * 0.78;
        ctx.fillStyle = css(hexRgb("#ff8a5c"), 0.9);
        ctx.beginPath();
        ctx.arc(px, pyy, 20 * u, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(hexRgb("#ffd166"), 0.8);
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.ellipse(px, pyy, 32 * u, 9 * u, -0.35, 0, TAU);
        ctx.stroke();
      }
      for (let b = 0; b < 2; b++) {
        const ay = this.py(86 + b * 10, 0.3);
        if (!onScreen(ay, 60 * u)) continue;
        ctx.strokeStyle = css(hexRgb(b === 0 ? "#38e1ff" : "#ff4fa3"), 0.12);
        ctx.lineWidth = 22 * u;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12 * u) {
          const yy = ay + Math.sin(x * 0.01 + this.t * 0.8 + b * 2) * 24 * u;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, h: number, x: number, y: number): void {
    const u = this.app.vp.unit;
    const pw = (h === 0 ? this.app.vp.w / u : LAYOUT.PLAT_W) * u;
    const ph = LAYOUT.PLAT_H * u;
    const zone = ZONES[zoneAt(h)];
    // フィーバーの中央足場は金色に発光させて特別感を出す
    const feverPlat = this.tower.isCenter(h);
    const tint = feverPlat ? hexRgb(COLORS.gold) : hexRgb(zone.tint);
    const base = mix(hexRgb(COLORS.platform), tint, feverPlat ? 0.5 : 0.18);
    const topCol = mix(hexRgb(COLORS.platformTop), tint, feverPlat ? 0.65 : 0.25);
    const x0 = h === 0 ? 0 : x - pw / 2;
    if (feverPlat) {
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = (9 + 4 * Math.sin(this.t * 6 + h)) * u;
    }

    // 下影
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.roundRect(x0 + 2 * u, y + 3 * u, pw - (h === 0 ? 0 : 4 * u), ph, 7 * u);
    ctx.fill();
    // 本体(縦グラデ)
    const g = ctx.createLinearGradient(0, y, 0, y + ph);
    g.addColorStop(0, css(mix(base, [255, 255, 255], 0.12)));
    g.addColorStop(1, css(mix(base, [0, 0, 0], 0.25)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x0, y, pw, ph, h === 0 ? 0 : 7 * u);
    ctx.fill();
    // 上面ハイライト
    ctx.fillStyle = css(topCol);
    ctx.beginPath();
    ctx.roundRect(x0, y, pw, 4.5 * u, h === 0 ? 0 : [7 * u, 7 * u, 0, 0]);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (feverPlat) return; // フィーバー足場はゾーン装飾なし(光だけ)

    if (h === 0) {
      ctx.fillStyle = css(mix(base, [0, 0, 0], 0.4));
      ctx.fillRect(0, y + ph, this.app.vp.w, this.app.vp.h - y);
      return;
    }

    // ゾーン装飾(hでシード固定)
    const r1 = hash(h * 7 + 1);
    const dx = x0 + pw * (0.18 + r1 * 0.64);
    if (zone.deco === "dusk") {
      // 草
      ctx.strokeStyle = css(mix(hexRgb("#5a8c4a"), tint, 0.2));
      ctx.lineWidth = 1.6 * u;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(dx + i * 3.4 * u, y);
        ctx.quadraticCurveTo(dx + i * 5 * u, y - 5 * u, dx + i * 6.5 * u, y - 7.5 * u);
        ctx.stroke();
      }
    } else if (zone.deco === "night") {
      // 小さな灯り
      ctx.fillStyle = css(hexRgb("#ffde7a"), 0.5 + 0.4 * Math.sin(this.t * 3 + h));
      ctx.beginPath();
      ctx.arc(dx, y + ph / 2, 2.4 * u, 0, TAU);
      ctx.fill();
    } else if (zone.deco === "clouds") {
      // ふわふわの縁
      ctx.fillStyle = "rgba(230,236,255,0.5)";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x0 + pw * (0.2 + i * 0.3), y + 1 * u, (4 + (i % 2) * 2) * u, Math.PI, 0);
        ctx.fill();
      }
    } else {
      // クリスタル
      ctx.fillStyle = css(tint, 0.85);
      ctx.beginPath();
      ctx.moveTo(dx, y - 8 * u);
      ctx.lineTo(dx + 3.4 * u, y);
      ctx.lineTo(dx - 3.4 * u, y);
      ctx.closePath();
      ctx.fill();
    }

    // 10mごとの高度ラベル
    if (h % 10 === 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${9 * u}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = x < this.app.vp.w / 2 ? "left" : "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${h}m`, x < this.app.vp.w / 2 ? x + pw / 2 + 6 * u : x - pw / 2 - 6 * u, y + 11 * u);
    }
  }

  private drawClimber(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const u = vp.unit;
    const tw = this.tower;
    const anchorY = vp.h * LAYOUT.ANCHOR;
    const stepH = LAYOUT.STEP_H * u;
    const vh = tw.visualH();
    const vx = vp.w / 2 + tw.visualSide() * LAYOUT.COL_OFFSET * u;
    const standDip = tw.anim.kind === "idle" ? this.dipOf(tw.h) : 0;
    const vy = anchorY + (this.camH - vh) * stepH + standDip;
    const r = LAYOUT.PLAYER_R * u;

    let jump = 0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let armLift = 0; // 0=下ろす 1=ばんざい
    const falling = tw.anim.kind === "fall";
    if (tw.anim.kind === "hop") {
      const t = Math.min(tw.anim.t / tw.anim.dur, 1);
      jump = Math.sin(t * Math.PI) * 30 * u;
      sy = 1 + 0.28 * Math.sin(t * Math.PI);
      sx = 1 - 0.16 * Math.sin(t * Math.PI);
      armLift = Math.sin(t * Math.PI);
      rot = tw.visualSide() !== 0 ? 0.06 * Math.sin(t * Math.PI) * (tw.visualSide() > 0 ? 1 : -1) : 0;
    } else if (falling) {
      sy = 1.15;
      sx = 0.88;
      rot = Math.sin(this.t * 26) * 0.16; // 慌てふためき
      armLift = 1;
    } else {
      // 着地のぼよん(潰れ→戻り)
      const lt = clamp(this.landSquashT / MOTION.LAND_SQUASH_TIME, 0, 1);
      const sq = Math.sin((1 - lt) * Math.PI * 0.5) * 0.3;
      sy = 1 - sq;
      sx = 1 + sq * 0.7;
      // 呼吸
      sy += 0.02 * Math.sin(this.t * 3.2);
    }

    ctx.save();
    ctx.translate(vx, vy - r - 4 * u - jump);
    ctx.rotate(rot);
    ctx.scale(sx, sy);

    // 腕
    ctx.strokeStyle = COLORS.player;
    ctx.lineCap = "round";
    ctx.lineWidth = 5.5 * u;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.7, -r * 0.05);
      ctx.lineTo(s * r * (1.05 + 0.1 * armLift), -r * 0.05 - armLift * r * 0.9);
      ctx.stroke();
    }
    // 脚(ホップ中はたたむ)
    ctx.lineWidth = 6 * u;
    const legTuck = tw.anim.kind === "hop" ? Math.sin(Math.min(tw.anim.t / tw.anim.dur, 1) * Math.PI) : 0;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, r * 0.85);
      ctx.lineTo(s * r * 0.42, r * (1.25 - legTuck * 0.35));
      ctx.stroke();
    }

    // 体(フィーバー中は虹色のオーラ)
    const fever = this.feverT > 0;
    ctx.fillStyle = COLORS.player;
    ctx.shadowColor = fever ? `hsl(${Math.floor((this.t * 400) % 360)}, 95%, 60%)` : COLORS.accent;
    ctx.shadowBlur = (fever ? 20 : 10) * u;
    ctx.beginPath();
    ctx.roundRect(-r * 0.82, -r, r * 1.64, r * 2, r * 0.72);
    ctx.fill();
    ctx.shadowBlur = 0;

    // バンダナ(きせかえ)+なびくしっぽ
    ctx.fillStyle = skinColor(this.skin, this.t);
    ctx.fillRect(-r * 0.82, -r * 0.72, r * 1.64, r * 0.3);
    ctx.beginPath();
    const wob = Math.sin(this.t * 9) * 3 * u;
    ctx.moveTo(r * 0.7, -r * 0.6);
    ctx.quadraticCurveTo(r * 1.3, -r * 0.5 + wob, r * 1.7, -r * 0.2 + wob * 1.4);
    ctx.quadraticCurveTo(r * 1.25, -r * 0.28, r * 0.75, -r * 0.38);
    ctx.fill();

    // 目(次の足場の側を見る。フィーバー中央なら正面。落下中はぐるぐる)
    const nextDir = tw.col(tw.h + 1);
    const blink = Math.sin(this.t * 0.9 + 2) > 0.985;
    ctx.fillStyle = "#1c2743";
    for (const s of [-1, 1]) {
      const ex = s * r * 0.28 + nextDir * r * 0.1;
      const ey = -r * 0.22;
      if (falling) {
        ctx.strokeStyle = "#1c2743";
        ctx.lineWidth = 1.6 * u;
        ctx.beginPath();
        ctx.arc(s * r * 0.28, ey, r * 0.15, this.t * 14, this.t * 14 + 4.5);
        ctx.stroke();
      } else if (blink) {
        ctx.fillRect(ex - r * 0.14, ey, r * 0.28, 1.4 * u);
      } else {
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.14, 0, TAU);
        ctx.fill();
      }
    }
    // ほっぺ
    ctx.fillStyle = "rgba(255,79,163,0.35)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.52, r * 0.05, r * 0.12, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h: H, unit: u, safeTop } = vp;
    const tw = this.tower;

    this.drawBackground(ctx);

    ctx.save();
    ctx.translate(this.juice.offX, this.juice.offY);

    const anchorY = H * LAYOUT.ANCHOR;
    const stepH = LAYOUT.STEP_H * u;
    const visTop = tw.h + 2; // 見えるのは2つ上まで

    const hMin = Math.max(0, Math.floor(this.camH - anchorY / stepH) - 1);
    for (let hh = hMin; hh <= visTop; hh++) {
      const [x, y] = this.platPos(hh);
      if (y < -50 || y > H + 60) continue;
      this.drawPlatform(ctx, hh, x, y);
    }

    // 3つ上の足場はゴースト(薄いシルエット)でチラ見せ ※試験導入
    {
      const gh = visTop + 1;
      const [gx, gy] = this.platPos(gh);
      if (gy > -50 && gy < H + 60) {
        const pw = LAYOUT.PLAT_W * u;
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = css(mix(hexRgb(COLORS.platformTop), [255, 255, 255], 0.3));
        ctx.beginPath();
        ctx.roundRect(gx - pw / 2, gy, pw, LAYOUT.PLAT_H * u, 7 * u);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // その先は見えない。合図はゆっくり明滅する「???」だけ
    // (以前あった霞バンドは横方向の灰色の線に見えるため廃止)
    const fogY = anchorY + (this.camH - (visTop + 1.55)) * stepH;
    if (fogY > -40 * u) {
      ctx.fillStyle = COLORS.textDim;
      ctx.globalAlpha = 0.3 + 0.18 * Math.sin(this.t * 1.6);
      ctx.font = `800 ${14 * u}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("? ? ?", w / 2, Math.max(fogY - 30 * u, safeTop + 96 * u));
      ctx.globalAlpha = 1;
    }

    this.drawClimber(ctx);
    drawFx(ctx, vp, this.fx);
    ctx.restore();

    // ==== HUD ====
    const urgent = tw.phase === "play" && tw.timeLeft <= GAME.URGENT;
    const bw = w * 0.56;
    const bx = w / 2 - bw / 2;
    const by = safeTop + 14 * u;
    ctx.fillStyle = "rgba(20,28,50,0.75)";
    ctx.beginPath();
    ctx.roundRect(bx - 2 * u, by - 2 * u, bw + 4 * u, 14 * u, 7 * u);
    ctx.fill();
    const ratio = clamp(tw.timeLeft / GAME.TIME, 0, 1);
    if (ratio > 0) {
      ctx.fillStyle = urgent ? COLORS.danger : COLORS.accent;
      ctx.shadowColor = urgent ? COLORS.danger : COLORS.accent;
      ctx.shadowBlur = 8 * u;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw * ratio, 10 * u, 5 * u);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // フィーバーゲージ(タイマーバーの直下): 溜め=ピンク、フィーバー中=金の残量
    {
      const gy = by + 13 * u;
      const gRatio = this.feverT > 0 ? this.feverT / FEVER.TIME : Math.min(this.combo / FEVER.REQ, 1);
      ctx.fillStyle = "rgba(20,28,50,0.6)";
      ctx.beginPath();
      ctx.roundRect(bx, gy, bw, 4 * u, 2 * u);
      ctx.fill();
      if (gRatio > 0) {
        ctx.fillStyle = this.feverT > 0 ? COLORS.gold : COLORS.accent2;
        if (this.feverT > 0) {
          ctx.shadowColor = COLORS.gold;
          ctx.shadowBlur = 6 * u;
        }
        ctx.beginPath();
        ctx.roundRect(bx, gy, bw * gRatio, 4 * u, 2 * u);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = urgent ? COLORS.danger : COLORS.text;
    const pulse = urgent ? 1 + 0.12 * Math.sin(this.t * 12) : 1;
    ctx.font = `900 ${26 * u * pulse}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(Math.ceil(tw.timeLeft)), w / 2, by + 21 * u);


    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("heightLabel"), 16 * u, by);
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${26 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${tw.maxH}m`, 16 * u, by + 12 * u);

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("bestLabel"), w - 16 * u, by);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `800 ${18 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${Math.max(this.best, tw.maxH)}m`, w - 16 * u, by + 13 * u);

    // マイルストーンバナー
    if (this.banner) {
      const a = clamp(this.banner.t / 0.3, 0, 1) * clamp((1.6 - this.banner.t) / 0.25, 0, 1);
      ctx.globalAlpha = Math.min(a, 1);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.gold;
      ctx.font = `900 ${24 * u}px -apple-system, system-ui, sans-serif`;
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 14 * u;
      ctx.fillText(this.banner.text, w / 2, H * 0.28);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // タップガイド
    if (this.taps < 3 && tw.phase === "play") {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.textDim;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 4);
      ctx.font = `900 ${30 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("◀", w * 0.2, H * 0.86);
      ctx.fillText("▶", w * 0.8, H * 0.86);
      ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(t("tapGuide"), w / 2, H * 0.86);
      ctx.globalAlpha = 1;
    }

    // カウントダウン / GO! / TIME UP
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (tw.phase === "count") {
      ctx.fillStyle = "rgba(10,14,26,0.5)";
      ctx.fillRect(0, 0, w, H);
      const n = Math.max(1, Math.ceil(tw.countdown));
      const frac = tw.countdown - Math.floor(tw.countdown);
      ctx.fillStyle = COLORS.text;
      ctx.font = `900 ${(70 + 24 * frac) * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(tw.countdown > GAME.COUNTDOWN ? "" : String(n), w / 2, H * 0.42);
      ctx.font = `700 ${13 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(t("tagline"), w / 2, H * 0.55);
    } else if (this.goFlash > 0) {
      ctx.fillStyle = COLORS.accent;
      ctx.globalAlpha = Math.min(this.goFlash * 3, 1);
      ctx.font = `900 ${54 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("GO!", w / 2, H * 0.42);
      ctx.globalAlpha = 1;
    } else if (tw.phase === "done") {
      ctx.fillStyle = COLORS.gold;
      ctx.font = `900 ${44 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("TIME UP!", w / 2, H * 0.42);
    }

    if (this.juice.flash > 0) {
      ctx.globalAlpha = this.juice.flash;
      ctx.fillStyle = this.juice.flashColor;
      ctx.fillRect(0, 0, w, H);
      ctx.globalAlpha = 1;
    }
  }

  onDown(x: number, y: number): void {
    // タップ波紋
    this.fx.ring(x - this.juice.offX, y - this.juice.offY, COLORS.accent, 24 * this.app.vp.unit, 2 * this.app.vp.unit, 0.3);
    this.tap(x < this.app.vp.w / 2 ? 0 : 1);
  }
}
