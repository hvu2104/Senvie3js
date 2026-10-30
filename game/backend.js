// Player accounts, scores and leaderboard. Online = Supabase RPC functions (supabase/setup.sql); offline = demo store in localStorage.
import { SUPABASE_URL, SUPABASE_ANON_KEY, REFERRAL_CREDIT } from "./config.js";
import { POINTS, MAX_SCORE } from "./questions.js";

export const ONLINE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const MIN_TIME_MS = 60000; // a full run (walk + 3 mini-games) can't plausibly be faster; same check runs server-side

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export function deviceId() {
  let id = store.get("senquest_device");
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); store.set("senquest_device", id); }
  return id;
}
export const savedCode = () => store.get("senquest_code");
export const saveCode = (c) => store.set("senquest_code", c);
export const normCode = (c) => (c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^SEN/, "").slice(0, 5);
export const fmtCode = (c) => "SEN-" + normCode(c);

async function rpc(fn, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error((body && (body.message || body.hint)) || `Lỗi máy chủ (${r.status})`);
  return body;
}

// ---- demo store: mirrors the SQL functions so the game behaves the same offline ----
const SAMPLE = [["Sen Vàng 07", "THCS Mẫu A", 820, 312000, 3], ["Lá Xanh", "THPT Mẫu B", 860, 405000, 0], ["Mây Hồng", "THCS Mẫu A", 740, 288000, 2],
  ["Bé Bơ", "THPT Mẫu C", 690, 360000, 1], ["Sen Lime 21", "", 610, 340000, 1], ["Nắng Sớm", "THPT Mẫu B", 520, 299000, 0]];
function demoDb() {
  let db = store.get("senquest_demo_db_v2");
  if (!db) {
    db = { players: SAMPLE.map(([nickname, school, best_points, best_time_ms, referrals], i) => ({ code: "MAU0" + i, nickname: nickname + " (mẫu)", school, best_points, best_time_ms, referrals, games: 1, device_id: "sample", referred_by: null, credited: true, created_at: i })) };
    store.set("senquest_demo_db_v2", db);
  }
  return db;
}
const total = (p) => p.best_points + POINTS.referral * p.referrals;
const ranked = (players) => [...players].sort((a, b) => total(b) - total(a) || (a.best_time_ms ?? 9e15) - (b.best_time_ms ?? 9e15) || a.created_at - b.created_at);
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function credit(db, p) {
  const ref = db.players.find((x) => x.code === p.referred_by);
  // one credit per device: a second account on the same phone never earns its referrer points
  const deviceUsed = db.players.some((x) => x !== p && x.device_id === p.device_id && x.credited && x.referred_by);
  if (ref && ref.code !== p.code && ref.device_id !== p.device_id && !deviceUsed) ref.referrals += 1;
  p.credited = true;
}

const demo = {
  async register({ nickname, school, ref }) {
    const db = demoDb();
    let code; do { code = Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join(""); } while (db.players.some((p) => p.code === code));
    const r = normCode(ref);
    const p = { code, nickname, school, best_points: 0, best_time_ms: null, referrals: 0, games: 0, device_id: deviceId(), referred_by: r && db.players.some((x) => x.code === r) ? r : null, credited: false, created_at: Date.now() };
    db.players.push(p);
    if (p.referred_by && REFERRAL_CREDIT === "register") credit(db, p);
    store.set("senquest_demo_db_v2", db);
    return { code, nickname, school, referred_by: p.referred_by };
  },
  async player(code) {
    const p = demoDb().players.find((x) => x.code === normCode(code));
    return p ? { code: p.code, nickname: p.nickname, school: p.school, best_points: p.best_points, best_time_ms: p.best_time_ms, referrals: p.referrals } : null;
  },
  async submit({ code, score, timeMs }) {
    const db = demoDb(), p = db.players.find((x) => x.code === normCode(code));
    if (!p) throw new Error("Không tìm thấy mã người chơi.");
    const pts = Math.max(0, Math.min(Math.round(score), MAX_SCORE)), t = Math.max(timeMs, MIN_TIME_MS);
    const improved = pts > p.best_points || (pts === p.best_points && (p.best_time_ms == null || t < p.best_time_ms));
    if (improved) { p.best_points = pts; p.best_time_ms = t; }
    p.games += 1;
    if (p.referred_by && !p.credited) credit(db, p);
    store.set("senquest_demo_db_v2", db);
    return { improved, ...(await demo.board(code)).me };
  },
  async board(code) {
    const list = ranked(demoDb().players), row = (p, i) => ({ rank: i + 1, nickname: p.nickname, school: p.school, total: total(p), best_points: p.best_points, best_time_ms: p.best_time_ms, referrals: p.referrals });
    const i = list.findIndex((p) => p.code === normCode(code));
    return { top: list.slice(0, 10).map(row), me: i >= 0 ? row(list[i], i) : null, players: list.length };
  },
};

const online = {
  register: ({ nickname, school, ref }) => rpc("register_player", { p_nickname: nickname, p_school: school, p_device: deviceId(), p_ref: normCode(ref) || null }),
  player: (code) => rpc("get_player", { p_code: normCode(code) }),
  submit: ({ code, score, timeMs }) => rpc("submit_result", { p_code: normCode(code), p_score: Math.round(score), p_time_ms: Math.round(timeMs) }),
  board: (code) => rpc("get_leaderboard", { p_code: normCode(code) || null }),
};

export const api = ONLINE ? online : demo;
