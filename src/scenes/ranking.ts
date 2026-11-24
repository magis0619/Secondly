import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { setBgm } from "../audio/bgm.ts";
import { logEvent, logScreen } from "../game/analytics.ts";
import { COLORS } from "../game/config.ts";
import { t } from "../game/i18n.ts";
import type { RoomMember, WorldEntry } from "../game/online.ts";
import {
  fetchMyRank, fetchTop, newRoomCode, normalizeRoomCode, onlineEnabled, roomFetch, roomLeave, syncBest, syncRoom,
} from "../game/online.ts";
import type { SaveData } from "../game/save.ts";
import { ensureIdentity, loadSave, setRoom } from "../game/save.ts";
import { shareInvite } from "../game/share.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";

type Tab = "world" | "local" | "friends";

export class RankingScene implements Scene {
  private t = 0;
  private save: SaveData = ensureIdentity();
  private tab: Tab = "local";
  private world: WorldEntry[] | null = null;
  private worldState: "idle" | "loading" | "ok" | "error" = "idle";
  /** TOP_N圏外の時の自分の順位(1始まり)。取得前/対象外はnull */
  private myRank: number | null = null;
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private tabRects: { rect: Rect; tab: Tab }[] = [];
  /** ともだち(ルーム)タブ */
  private friends: RoomMember[] | null = null;
  private friendsState: "idle" | "loading" | "ok" | "error" = "idle";
  private friendBtns: { rect: Rect; action: () => void }[] = [];
  private toast: { text: string; t: number } | null = null;

  constructor(
    private app: App,
    /** 直前のプレイの順位(ローカルタブのハイライト用)。なければ-1 */
    private highlightRank = -1,
    /** 初期タブ。未指定ならオンライン時world/オフラインlocal(れんしゅうからはlocalを渡す) */
    private initialTab?: Tab,
  ) {}

  enter(): void {
    logScreen("ranking");
    setBgm("menu");
    this.save = ensureIdentity();
    this.tab = this.initialTab ?? (onlineEnabled() ? "world" : "local");
    if (this.tab === "world" && onlineEnabled()) this.loadWorld();
    if (this.tab === "friends") this.loadFriends();
    logEvent("ranking_view", { tab: this.tab });
  }

  private showToast(text: string): void {
    this.toast = { text, t: 2.4 };
  }

  /** 参加中のルームの名簿を読み込む(先に自分の最新ベストを書いてから読むので、自分の行も最新になる) */
  private loadFriends(): void {
    const code = loadSave().room;
    if (!code || !onlineEnabled()) {
      this.friendsState = "idle";
      return;
    }
    this.friendsState = "loading";
    void syncRoom()
      .then(() => roomFetch(code))
      .then((list) => {
        if (loadSave().room !== code) return; // 読み込み中に抜けた/変わった
        this.friends = list;
        this.friendsState = list === null ? "error" : "ok";
      });
  }

  private createRoom(): void {
    const code = newRoomCode();
    setRoom(code);
    this.friendsState = "loading";
    void syncRoom(true).then((ok) => {
      if (!ok) {
        setRoom(""); // 名簿に登録できなかったルームは作らなかったことにする
        this.friendsState = "idle";
        this.showToast(t("netError"));
        return;
      }
      logEvent("room_create");
      this.showToast(t("roomCreated"));
      this.loadFriends();
    });
  }

  private joinRoom(): void {
    const input = window.prompt(t("roomPrompt"), "");
    if (input === null) return;
    const code = normalizeRoomCode(input);
    if (!code) {
      logEvent("room_join", { ok: false, why: "format" });
      this.showToast(t("roomBadCode"));
      return;
    }
    this.friendsState = "loading";
    void roomFetch(code).then((list) => {
      if (list === null) {
        this.friendsState = "idle";
        this.showToast(t("netError"));
        return;
      }
      if (list.length === 0) {
        this.friendsState = "idle";
        logEvent("room_join", { ok: false, why: "notfound" });
        this.showToast(t("roomNotFound"));
        return;
      }
      setRoom(code);
      void syncRoom(true).then(() => {
        logEvent("room_join", { ok: true });
        this.showToast(t("roomJoined"));
        this.loadFriends();
      });
    });
  }

  private leaveRoom(): void {
    if (!window.confirm(t("roomLeaveConfirm"))) return;
    const code = loadSave().room;
    setRoom("");
    this.friends = null;
    this.friendsState = "idle";
    logEvent("room_leave");
    this.showToast(t("roomLeft"));
    if (code) void roomLeave(code, this.save.playerId);
  }

  private loadWorld(): void {
    this.worldState = "loading";
    // 未送信のほんばんベストがあれば先に送信してから取得(旧セーブもここで自動送信される)
    this.myRank = null;
    void syncBest()
      .then(() => fetchTop())
      .then((list) => {
        if (list === null) {
          this.worldState = "error";
          return;
        }
        this.world = list;
        this.worldState = "ok";
        // TOP_N圏外なら別途、自分の順位だけ集計クエリで取得する
        const inTop = list.some((e) => e.id === this.save.playerId);
        if (!inTop && this.save.rankedBest > 0) {
          void fetchMyRank(this.save.rankedBest).then((r) => {
            this.myRank = r;
          });
        }
      });
  }

  update(dt: number): void {
    this.t += dt;
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u, safeTop, safeBottom } = vp;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${26 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("rankingTitle"), w / 2, safeTop + 34 * u);

    // タブ
    this.tabRects = [];
    const tabs: { tab: Tab; label: string }[] = [
      { tab: "world", label: t("tabWorld") },
      { tab: "local", label: t("tabLocal") },
      { tab: "friends", label: t("tabFriends") },
    ];
    tabs.forEach((tb, i) => {
      const rect: Rect = { x: w / 2 - 158 * u + i * 107 * u, y: safeTop + 58 * u, w: 102 * u, h: 38 * u };
      this.tabRects.push({ rect, tab: tb.tab });
      const sel = this.tab === tb.tab;
      drawButton(ctx, u, rect, tb.label, {
        bg: sel ? COLORS.accent : "#1c2743",
        fg: sel ? COLORS.bg : COLORS.textDim,
        fontPx: 11.5 * u,
      });
    });

    const listTop = safeTop + 116 * u;
    const rowH = 42 * u;

    this.friendBtns = [];
    if (this.tab === "friends") {
      this.drawFriends(ctx, listTop, rowH);
    } else if (this.tab === "local") {
      const list = this.save.ranking;
      if (list.length === 0) this.drawEmpty(ctx, t("noRecords"));
      list.forEach((e, i) => {
        const d = new Date(e.date);
        this.drawRow(ctx, listTop + i * rowH, i + 1, "", e.score, i + 1 === this.highlightRank, `${d.getMonth() + 1}/${d.getDate()}`);
      });
    } else {
      if (!onlineEnabled()) {
        this.drawEmpty(ctx, t("offline"), t("offlineHint"));
      } else if (this.worldState === "loading") {
        // スピナー
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.4, 16 * u, this.t * 5, this.t * 5 + 4.2);
        ctx.stroke();
      } else if (this.worldState === "error") {
        this.drawEmpty(ctx, t("netError"), t("netErrorHint"));
      } else if (this.world && this.world.length === 0) {
        this.drawEmpty(ctx, t("worldEmpty"), t("worldEmptyHint"));
      } else if (this.world) {
        const maxRows = Math.floor((h - safeBottom - 100 * u - listTop) / rowH);
        this.world.slice(0, maxRows).forEach((e, i) => {
          this.drawRow(ctx, listTop + i * rowH, i + 1, e.name, e.score, e.id === this.save.playerId, "");
        });
        // TOP_N圏外でも自分の順位が分かるよう、リスト下に固定表示する
        if (this.myRank !== null) {
          const y = h - safeBottom - 118 * u;
          ctx.fillStyle = COLORS.textDim;
          ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(t("yourRankLabel"), w / 2, y - 20 * u);
          this.drawRow(ctx, y, this.myRank, this.save.playerName, this.save.rankedBest, true, "");
        }
      }
    }

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text });

    // トースト
    if (this.toast) {
      const a = Math.min(this.toast.t / 0.3, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(20,28,50,0.95)";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 160 * u, h - safeBottom - 132 * u, 320 * u, 40 * u, 12 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.font = `800 ${12.5 * u}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(this.toast.text, w / 2, h - safeBottom - 112 * u);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** ともだちタブ: 未参加=作成/参加ボタン、参加中=コード+招待/退出+名簿 */
  private drawFriends(ctx: CanvasRenderingContext2D, listTop: number, rowH: number): void {
    const { w, h, unit: u, safeBottom } = this.app.vp;
    const room = loadSave().room;
    const btn = (rect: Rect, label: string, action: () => void, bg: string, fg: string, fontPx = 15 * u) => {
      this.friendBtns.push({ rect, action });
      drawButton(ctx, u, rect, label, { bg, fg, fontPx });
    };
    if (!onlineEnabled()) {
      this.drawEmpty(ctx, t("offline"), t("offlineHint"));
      return;
    }
    if (!room) {
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${16 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(t("friendsIntro1"), w / 2, listTop + 34 * u);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(t("friendsIntro2"), w / 2, listTop + 62 * u);
      ctx.fillText(t("friendsHint"), w / 2, listTop + 82 * u);
      if (this.friendsState === "loading") {
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.arc(w / 2, listTop + 170 * u, 16 * u, this.t * 5, this.t * 5 + 4.2);
        ctx.stroke();
        return;
      }
      const bw = 250 * u;
      btn({ x: w / 2 - bw / 2, y: listTop + 120 * u, w: bw, h: 52 * u }, t("roomCreate"), () => this.createRoom(), COLORS.accent2, "#fff");
      btn({ x: w / 2 - bw / 2, y: listTop + 190 * u, w: bw, h: 52 * u }, t("roomJoin"), () => this.joinRoom(), "#3b74d0", "#fff");
      return;
    }

    // コード表示カード
    ctx.fillStyle = "#1c2743";
    ctx.beginPath();
    ctx.roundRect(w / 2 - 165 * u, listTop - 8 * u, 330 * u, 62 * u, 14 * u);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("roomCodeLabel"), w / 2, listTop + 8 * u);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `900 ${28 * u}px ui-monospace, Menlo, monospace`;
    ctx.fillText(room.split("").join(" "), w / 2, listTop + 34 * u);
    // 招待/退出
    const by = listTop + 64 * u;
    btn({ x: w / 2 - 165 * u, y: by, w: 200 * u, h: 36 * u }, t("roomInvite"), () => void shareInvite(room), COLORS.accent2, "#fff", 13 * u);
    btn({ x: w / 2 + 45 * u, y: by, w: 120 * u, h: 36 * u }, t("roomLeave"), () => this.leaveRoom(), "#25314f", COLORS.textDim, 12 * u);

    const top = by + 78 * u;
    if (this.friendsState === "loading") {
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(w / 2, top + 60 * u, 16 * u, this.t * 5, this.t * 5 + 4.2);
      ctx.stroke();
    } else if (this.friendsState === "error") {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${14 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(t("netError"), w / 2, top + 50 * u);
      ctx.fillText(t("netErrorHint"), w / 2, top + 76 * u);
    } else if (this.friends) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${10.5 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(t("roomMembers", { n: this.friends.length }), w / 2, top - 26 * u);
      const maxRows = Math.floor((h - safeBottom - 92 * u - top) / rowH);
      this.friends.slice(0, maxRows).forEach((e, i) => {
        // スコア0(ほんばん未プレイ)は「—」表示にするため負値で渡す
        this.drawRow(ctx, top + i * rowH, i + 1, e.name, e.score > 0 ? e.score : -1, e.id === this.save.playerId, "");
      });
    }
  }

  private drawEmpty(ctx: CanvasRenderingContext2D, line1: string, line2 = t("playToRecord")): void {
    const { w, h, unit: u } = this.app.vp;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${14 * u}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(line1, w / 2, h * 0.4);
    ctx.fillText(line2, w / 2, h * 0.4 + 26 * u);
  }

  private drawRow(
    ctx: CanvasRenderingContext2D,
    y: number,
    rank: number,
    name: string,
    score: number,
    highlight: boolean,
    date: string,
  ): void {
    const { w, unit: u } = this.app.vp;
    if (highlight) {
      ctx.fillStyle = COLORS.accent2;
      ctx.globalAlpha = 0.16 + 0.08 * Math.sin(this.t * 5);
      ctx.beginPath();
      ctx.roundRect(w / 2 - 165 * u, y - 18 * u, 330 * u, 36 * u, 9 * u);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "center";
    ctx.font = `900 ${(rank <= 3 ? 19 : 14) * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = rank === 1 ? COLORS.gold : rank === 2 ? "#cdd8ee" : rank === 3 ? "#d9a066" : COLORS.textDim;
    ctx.fillText(rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : String(rank), w / 2 - 140 * u, y);
    if (name) {
      ctx.textAlign = "left";
      ctx.fillStyle = highlight ? COLORS.accent2 : COLORS.text;
      ctx.font = `700 ${13 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(name.slice(0, 12), w / 2 - 112 * u, y);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = highlight ? COLORS.accent2 : COLORS.text;
    ctx.font = `800 ${17 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(score < 0 ? "—" : `${score}m`, w / 2 + (date ? 60 : 140) * u, y);
    if (date) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${11 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(date, w / 2 + 140 * u, y);
    }
  }

  onUp(x: number, y: number): void {
    for (const tr of this.tabRects) {
      if (inRect(tr.rect, x, y) && this.tab !== tr.tab) {
        sfxStart();
        this.tab = tr.tab;
        logEvent("ranking_view", { tab: tr.tab });
        if (tr.tab === "world" && this.worldState === "idle") this.loadWorld();
        if (tr.tab === "friends" && this.friendsState === "idle") this.loadFriends();
        return;
      }
    }
    if (this.tab === "friends") {
      for (const b of this.friendBtns) {
        if (inRect(b.rect, x, y)) {
          sfxStart();
          b.action();
          return;
        }
      }
    }
    if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
