// Sen Quest: walk the Hiểu Da Mình booth in first person (arrow keys on desktop, on-screen joystick on phones),
// play one mini-game per zone to earn 3 keys, then submit the run to the leaderboard and share an invite link.
import * as THREE from "three";
import { buildBooth, EYE, START, ZONE_AREAS, BOUNDS, BOXES, CIRCLES, ZONE_COLORS } from "./scene.js";
import { ZONES, POINTS } from "./questions.js";
import { oilRush, swipe, runner } from "./games.js";
import { api, ONLINE, savedCode, saveCode, normCode, fmtCode } from "./backend.js";

const $ = (id) => document.getElementById(id);
const fmtTime = (ms) => { if (ms == null) return "–"; const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const TOUCH = matchMedia("(pointer: coarse)").matches;

// ---------- panels ----------
const PANELS = ["pLoading", "pHome", "pRules", "pRegister", "pIntro", "pGame", "pResult", "pBoard"];
let backTo = null; // panel to return to from Rules/Board; null = back to walking
const show = (id) => PANELS.forEach((p) => ($(p).hidden = p !== id));
const hidePanels = () => PANELS.forEach((p) => ($(p).hidden = true));
const panelOpen = () => PANELS.some((p) => !$(p).hidden);
document.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => (backTo ? show(backTo) : hidePanels())));

// ---------- state ----------
const S = { player: null, playing: false, run: null, busy: false };
const newRun = () => ({ start: 0, zone: 0, scores: [0, 0, 0], done: false });
const runScore = () => S.run.scores.reduce((a, b) => a + b, 0);
const P = { x: START.x, z: START.z, yaw: START.yaw, pitch: -0.05 };

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
$("world").appendChild(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100); cam.rotation.order = "YXZ";
// portrait phones see a narrow slice at the same vertical FOV, so widen it (capped)
const fit = () => { cam.aspect = innerWidth / innerHeight; cam.fov = Math.min(92, Math.max(70, (2 * Math.atan(Math.tan((37 * Math.PI) / 180) / cam.aspect) * 180) / Math.PI)); cam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
fit(); addEventListener("resize", fit);

// floating number over the next zone + glowing floor circle marking where to stand
const markers = {}, rings = {};
function sprite(text, bg, fg) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "#1a1a1a"; g.beginPath(); g.arc(68, 68, 56, 0, 7); g.fill();
  g.fillStyle = bg; g.beginPath(); g.arc(62, 62, 56, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = "#1a1a1a"; g.stroke();
  g.fillStyle = fg; g.font = "64px Later, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 62, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(0.6, 0.6, 1); s.renderOrder = 10; return s;
}
function buildMarkers() {
  ["z1", "z2", "z3", "end"].forEach((id, i) => {
    const a = ZONE_AREAS[id], col = i < 3 ? ZONE_COLORS[i] : "#e91d78";
    const m = sprite(i < 3 ? String(i + 1) : "★", col, i < 3 ? "#1a1a1a" : "#ffffff"); m.position.set(...a.marker); m.userData.y = a.marker[1]; scene.add(m); markers[id] = m;
    const r = new THREE.Mesh(new THREE.RingGeometry(a.r - 0.12, a.r, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2; r.position.set(a.x, Math.abs(a.x) < 6 && Math.abs(a.z) < 4 ? 0.14 : 0.02, a.z); scene.add(r); rings[id] = r;
  });
}

// ---------- movement ----------
const keys = new Set();
addEventListener("keydown", (e) => {
  if (!S.playing || panelOpen()) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if ((e.key === "Enter" || e.key === " ") && !$("action").hidden) $("action").click();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
document.addEventListener("visibilitychange", () => document.hidden && keys.clear()); // no stuck keys after switching tabs

// drag anywhere on the 3D view to look around
let look = null;
const cv = renderer.domElement;
cv.addEventListener("pointerdown", (e) => { look = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener("pointermove", (e) => {
  if (!look || !S.playing) return;
  P.yaw += (e.clientX - look.x) * 0.0045; P.pitch = Math.max(-0.7, Math.min(0.5, P.pitch + (e.clientY - look.y) * 0.0035));
  look = { x: e.clientX, y: e.clientY };
});
cv.addEventListener("pointerup", () => (look = null));

// on-screen joystick (phones): up/down walks, left/right turns
const joy = { x: 0, y: 0, id: null };
const joyEl = $("joy"), knob = $("knob");
function joyMove(e) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy), max = R - 10;
  if (d > max) { dx *= max / d; dy *= max / d; }
  joy.x = dx / max; joy.y = dy / max; knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
joyEl.addEventListener("pointerdown", (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
joyEl.addEventListener("pointermove", (e) => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ""; };
joyEl.addEventListener("pointerup", joyEnd); joyEl.addEventListener("pointercancel", joyEnd);

const R = 0.28; // player radius
function blocked(x, z) {
  if (x < BOUNDS[0] || z < BOUNDS[1] || x > BOUNDS[2] || z > BOUNDS[3]) return true;
  for (const [x1, z1, x2, z2] of BOXES) if (x > x1 - R && x < x2 + R && z > z1 - R && z < z2 + R) return true;
  for (const [cx, cz, cr] of CIRCLES) if (Math.hypot(x - cx, z - cz) < cr + R) return true;
  return false;
}
function step(dt) {
  const k = (n) => keys.has(n);
  const fwd = (k("arrowup") || k("w") ? 1 : 0) - (k("arrowdown") || k("s") ? 1 : 0) - joy.y;
  const turn = (k("arrowleft") ? 1 : 0) - (k("arrowright") ? 1 : 0) - joy.x;
  const strafe = (k("d") ? 1 : 0) - (k("a") ? 1 : 0);
  P.yaw += turn * 2.0 * dt;
  if (!fwd && !strafe) return;
  const sp = 2.4 * dt, sx = -Math.sin(P.yaw), sz = -Math.cos(P.yaw);
  const nx = P.x + (sx * fwd - sz * strafe) * sp, nz = P.z + (sz * fwd + sx * strafe) * sp;
  if (!blocked(nx, nz)) { P.x = nx; P.z = nz; } else if (!blocked(nx, P.z)) P.x = nx; else if (!blocked(P.x, nz)) P.z = nz; // slide along walls
}

// ?debug=1 exposes movement for scripted testing (simulate held keys frame by frame)
if (new URLSearchParams(location.search).has("debug")) window.__sq = { P, keys, step: (dt) => { step(dt); updateZoneUI(); } };

// ---------- zones ----------
const target = () => (S.run.zone < 3 ? `z${S.run.zone + 1}` : "end");
const inside = (id) => { const a = ZONE_AREAS[id]; return Math.hypot(P.x - a.x, P.z - a.z) < a.r; };
let lastHere = null;
function updateZoneUI() {
  const t = target(), z = ZONES[S.run.zone];
  const here = inside(t);
  if (here !== lastHere) {
    lastHere = here;
    $("action").hidden = !here;
    $("action").textContent = t === "end" ? "★ Tra 3 chìa & nộp điểm" : `▶ Chơi chặng ${S.run.zone + 1} · ${z.game}`;
  }
  const other = ["z1", "z2", "z3"].find((id, i) => i !== S.run.zone && inside(id));
  $("hint").textContent = other ? (Number(other[1]) - 1 < S.run.zone ? "Bạn đã xong chặng này rồi, đi tiếp nhé!" : `Hoàn thành chặng ${S.run.zone + 1} trước đã.`)
    : here ? "" : TOUCH ? "Núm trái: đi · Kéo màn hình: nhìn quanh" : "↑↓ đi tới/lui · ←→ xoay · kéo chuột để nhìn";
  const a = ZONE_AREAS[t], ang = Math.atan2(-(a.x - P.x), -(a.z - P.z)) - P.yaw;
  $("arrow").style.transform = `rotate(${-ang}rad)`;
  $("goal").textContent = `${t === "end" ? "Hộp thư" : `Chặng ${S.run.zone + 1}`} · ${Math.max(0, Math.hypot(a.x - P.x, a.z - P.z) - a.r).toFixed(0)}m`;
}
function refresh() {
  $("score").textContent = `${runScore()} điểm`;
  $("keys").innerHTML = ZONES.map((z, i) => `<div class="key ${i < S.run.zone ? "on" : ""}" style="background:${i < S.run.zone ? z.color : "#fff"}" title="${z.key}">${i + 1}</div>`).join("");
  const t = target();
  for (const id of Object.keys(markers)) { markers[id].visible = id === t; rings[id].visible = id === t; }
  lastHere = null;
}

$("action").onclick = async () => {
  if (S.busy || !S.playing) return;
  const t = target(); if (!inside(t)) return;
  if (t === "end") return finish();
  S.busy = true; keys.clear(); joyEnd();
  show("pGame");
  const zi = S.run.zone, root = $("gRoot");
  const score = await [() => oilRush(root, ASSETS.mascot), () => swipe(root), () => runner(root, ASSETS.mascot)][zi]();
  S.run.scores[zi] = score; S.run.zone++;
  hidePanels(); S.busy = false; refresh();
};

async function finish() {
  const r = S.run, timeMs = performance.now() - r.start; r.done = true; S.busy = true;
  $("action").textContent = "Đang nộp điểm…";
  try {
    const me = await api.submit({ code: S.player.code, score: runScore(), timeMs });
    $("rTitle").textContent = me.improved ? "KỶ LỤC MỚI CỦA BẠN!" : "HOÀN THÀNH!";
    $("rScore").textContent = runScore(); $("rTime").textContent = fmtTime(timeMs); $("rRank").textContent = me.rank ? `#${me.rank}` : "–";
    $("rSplit").textContent = ZONES.map((z, i) => `${z.game}: ${r.scores[i]}`).join(" · ");
    $("rTotal").innerHTML = `Điểm xếp hạng: <b>${me.total}</b> = ${me.best_points} (lượt tốt nhất) + ${me.referrals} bạn × ${POINTS.referral}`;
    $("rCode").textContent = fmtCode(S.player.code); $("shareMsg").textContent = ""; $("shareLink").hidden = true;
    S.playing = false; setControls(false); show("pResult");
  } catch (err) {
    r.done = false; $("action").textContent = "★ Nộp lại điểm";
    $("hint").textContent = `Chưa nộp được điểm: ${err.message}. Kiểm tra mạng rồi bấm lại.`;
  } finally { S.busy = false; }
}

function setControls(on) { $("hud").hidden = !on; $("bottom").hidden = !on; $("joy").hidden = !on || !TOUCH; }

// ---------- accounts ----------
const refParam = normCode(new URLSearchParams(location.search).get("ref"));
function startPlay() {
  $("introCode").textContent = fmtCode(S.player.code);
  $("ctlHelp").innerHTML = TOUCH ? "<b>Cách đi:</b> kéo núm tròn góc trái để đi, kéo màn hình để nhìn quanh. Mũi tên trên cùng chỉ đường tới chặng tiếp theo."
    : "<b>Cách đi:</b> phím ↑↓ để đi tới/lui, ←→ để xoay, kéo chuột để nhìn. Mũi tên trên cùng chỉ đường tới chặng tiếp theo.";
  show("pIntro");
}
$("bEnter").onclick = () => {
  hidePanels(); S.run = newRun(); Object.assign(P, { x: START.x, z: START.z, yaw: START.yaw, pitch: -0.05 });
  setControls(true); refresh(); S.playing = true; S.run.start = performance.now();
};
$("bAgain").onclick = () => startPlay();
$("bPlay").onclick = () => {
  if (S.player) return startPlay();
  show("pRegister"); $("fRegister").hidden = false; $("fLogin").hidden = true; $("iRef").value = refParam ? fmtCode(refParam) : ""; $("iNick").focus();
};
$("bHaveCode").onclick = () => { $("fRegister").hidden = true; $("fLogin").hidden = false; $("iCode").focus(); };
$("bNewCode").onclick = () => { $("fLogin").hidden = true; $("fRegister").hidden = false; };
$("fRegister").onsubmit = async (e) => {
  e.preventDefault();
  const nickname = $("iNick").value.trim().replace(/\s+/g, " "), school = $("iSchool").value.trim();
  if (nickname.length < 2) return ($("regErr").textContent = "Biệt danh cần ít nhất 2 ký tự.");
  $("regErr").textContent = ""; $("bRegister").disabled = true;
  try {
    const p = await api.register({ nickname, school, ref: $("iRef").value });
    S.player = { code: normCode(p.code), nickname: p.nickname }; saveCode(S.player.code); greet(); startPlay();
  } catch (err) { $("regErr").textContent = `Chưa tạo được mã: ${err.message}`; }
  finally { $("bRegister").disabled = false; }
};
$("fLogin").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const p = await api.player($("iCode").value);
    if (!p) return ($("logErr").textContent = "Không tìm thấy mã này. Kiểm tra lại các ký tự sau SEN-.");
    S.player = { code: normCode(p.code), nickname: p.nickname }; saveCode(S.player.code); greet(); startPlay();
  } catch (err) { $("logErr").textContent = `Chưa kiểm tra được mã: ${err.message}`; }
};
function greet() {
  $("welcome").hidden = !S.player; if (S.player) $("welcome").textContent = `Xin chào ${S.player.nickname} · Mã ${fmtCode(S.player.code)}`;
  $("refBanner").hidden = !refParam || !!S.player;
  if (refParam) $("refBanner").textContent = `Bạn được ${fmtCode(refParam)} mời chơi. Đăng ký với mã này để người mời được +${POINTS.referral} điểm khi bạn chơi xong.`;
}

// ---------- share ----------
$("bShare").onclick = async () => {
  const url = `${location.origin}${location.pathname}?ref=${S.player.code}`;
  const text = `Mình được ${runScore()} điểm ở Sen Quest · Hiểu Da Mình! Vào chơi và nhập mã ${fmtCode(S.player.code)} khi đăng ký nhé:`;
  try { if (navigator.share) { await navigator.share({ title: "Sen Quest", text, url }); $("shareMsg").textContent = "Đã mở bảng chia sẻ."; return; } }
  catch (err) { if (err.name === "AbortError") return; }
  $("shareLink").value = `${text} ${url}`; $("shareLink").hidden = false;
  try { await navigator.clipboard.writeText(`${text} ${url}`); $("shareMsg").textContent = "Đã sao chép link mời. Dán vào Zalo, Messenger hoặc story nhé!"; }
  catch { $("shareLink").select(); $("shareMsg").textContent = "Sao chép đoạn ở trên để gửi cho bạn bè."; }
};

// ---------- leaderboard ----------
async function openBoard(from) {
  backTo = from; show("pBoard"); keys.clear(); joyEnd();
  $("bNote").textContent = ONLINE ? "Xếp theo tổng điểm, bằng điểm thì ai nhanh hơn xếp trên." : "Chế độ thử: điểm chỉ lưu trên máy này, có sẵn vài người chơi mẫu.";
  $("bRows").innerHTML = `<tr><td colspan="4">Đang tải…</td></tr>`; $("bMe").textContent = "";
  try {
    const b = await api.board(S.player?.code);
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    $("bRows").innerHTML = b.top.map((r) => `<tr class="${b.me && r.rank === b.me.rank ? "me" : ""}"><td>${r.rank}</td><td>${esc(r.nickname)}${r.school ? `<br><span class="muted">${esc(r.school)}</span>` : ""}</td><td class="n">${r.total}</td><td class="n">${fmtTime(r.best_time_ms)}</td></tr>`).join("") || `<tr><td colspan="4">Chưa có ai chơi. Bạn là người đầu tiên!</td></tr>`;
    if (b.me) $("bMe").innerHTML = `Bạn đang hạng <b>#${b.me.rank}</b>/${b.players} với <b>${b.me.total}</b> điểm (${b.me.referrals} bạn đã mời).`;
  } catch (err) { $("bRows").innerHTML = `<tr><td colspan="4">Chưa tải được bảng xếp hạng: ${err.message}</td></tr>`; }
}
$("bBoard").onclick = () => openBoard("pHome");
$("rBoard").onclick = () => openBoard("pResult");
$("hudBoard").onclick = () => openBoard(null);
$("bRules").onclick = () => { backTo = "pHome"; show("pRules"); };

// ---------- boot ----------
let ASSETS;
(async () => {
  await Promise.all([new FontFace("Later", "url(assets/later.ttf)").load(), new FontFace("Float", "url(assets/float.ttf)").load()].map((p) => p.then((f) => document.fonts.add(f)).catch(() => {})));
  const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  const [mascot, logo] = await Promise.all([img("assets/mascot.png"), img("assets/logo_sen.png")]);
  ASSETS = { mascot, logo };
  await buildBooth(scene, ASSETS);
  buildMarkers(); Object.values(markers).forEach((m) => (m.visible = false)); Object.values(rings).forEach((r) => (r.visible = false));
  const code = savedCode();
  if (code) { try { const p = await api.player(code); if (p) S.player = { code: normCode(p.code), nickname: p.nickname }; } catch {} }
  greet();
  $("modeNote").textContent = ONLINE ? "" : "Đang chạy chế độ thử (chưa nối máy chủ): điểm chỉ lưu trên máy này.";
  show("pHome");
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (S.playing && !panelOpen()) { step(dt); updateZoneUI(); }
    if (S.playing && S.run && !S.run.done) $("timer").textContent = fmtTime(now - S.run.start);
    for (const m of Object.values(markers)) m.position.y = m.userData.y + Math.sin(now / 350) * 0.08;
    for (const r of Object.values(rings)) r.material.opacity = 0.5 + 0.4 * Math.sin(now / 300);
    if (!S.playing) P.yaw += dt * 0.08; // slow look-around behind the menus
    cam.position.set(P.x, EYE, P.z); cam.rotation.set(P.pitch, P.yaw, 0);
    renderer.render(scene, cam);
  });
})();
