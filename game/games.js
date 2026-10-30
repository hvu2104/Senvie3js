// The three zone mini-games. Each one is played inside `root` and resolves with the points earned.
import { ZONES, POINTS, STATEMENTS, DECK_SIZE, GOOD, BAD, RUN_DAYS } from "./questions.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
// ?debug=1: short rounds and a timer-driven loop so scripted tests can finish a game in a hidden tab
const DEBUG = new URLSearchParams(location.search).has("debug");
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
let actx = null;
function beep(freq = 660, ms = 90, type = "square", vol = 0.05) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g).connect(actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + ms / 1000); o.stop(actx.currentTime + ms / 1000);
  } catch {}
}
// rAF loop with dt in seconds, clamped so a background tab doesn't count as play time
function loop(step) {
  let last = performance.now(), on = true;
  const f = (now) => { if (!on) return; const dt = Math.min((now - last) / 1000, 0.05); last = now; if (step(dt, now) === false) on = false; else next(f); };
  const next = DEBUG ? (fn) => setTimeout(() => fn(performance.now()), 16) : requestAnimationFrame;
  next(f);
  return () => (on = false);
}
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w: r.width, h: r.height };
}

// Shared frame: header (zone, score, status), intro card, play area, end card.
function shell(root, zi) {
  const z = ZONES[zi];
  root.innerHTML = "";
  const head = el("div", "ghead", `<span class="zonetag" style="background:${z.color}">CHẶNG ${zi + 1} · ${z.name}</span><b class="gname">${z.game}</b><span class="chip gscore">0 điểm</span><span class="chip gstat"></span>`);
  const stage = el("div", "gstage");
  root.append(head, stage);
  const intro = el("div", "gcard", `<h2>${z.game.toUpperCase()}</h2><p>${z.how}</p><button class="btn primary" type="button">Bắt đầu</button>`);
  stage.append(intro);
  return {
    stage, setScore: (n) => (head.querySelector(".gscore").textContent = `${n} điểm`), setStat: (t) => (head.querySelector(".gstat").textContent = t),
    start: () => new Promise((ok) => { const b = intro.querySelector("button"); b.focus(); b.onclick = () => { intro.remove(); beep(880, 60); ok(); }; }),
    end: (title, text, score) => new Promise((ok) => {
      const c = el("div", "gcard", `<div class="kicker">CHẶNG ${zi + 1} · ${z.name}</div><h2>${title}</h2><p>${text}</p><div class="codebox">+${score} điểm</div><p>Bạn nhận <b>${z.key}</b>!</p><button class="btn primary" type="button">Nhận chìa & đi tiếp</button>`);
      stage.append(c); const b = c.querySelector("button"); b.focus(); b.onclick = () => ok(score);
    }),
  };
}

// ---------- Chặng 1: Oil Rush ----------
// Rub oil spots off the T-zone. Too fast rubbing raises irritation; spots left too long clog the skin.
export async function oilRush(root, mascot) {
  const sh = shell(root, 0);
  const cv = el("canvas", "gcanvas"); sh.stage.append(cv);
  await sh.start();
  let { g, w, h } = fitCanvas(cv);
  const DURATION = DEBUG ? 6 : 40;
  // head crop of the mascot image (normalised source rect) drawn to fill the canvas height
  // portrait phones get a tighter crop so the face fills the width
  const SRC = w / h < 0.8 ? { x: 0.17, y: 0.16, w: 0.66, h: 0.44 } : { x: 0.08, y: 0.1, w: 0.84, h: 0.5 };
  const sw = mascot.width * SRC.w, shh = mascot.height * SRC.h, k = Math.min((w * 0.98) / sw, (h - 84) / shh); // leave room for the two meters
  const dw = sw * k, dh = shh * k, dx = (w - dw) / 2, dy = Math.max(6, (h - 76 - dh) / 2);
  const at = (nx, ny) => [dx + ((nx - SRC.x) / SRC.w) * dw, dy + ((ny - SRC.y) / SRC.h) * dh]; // mascot-normalised -> canvas
  const REGIONS = [[0.36, 0.64, 0.28, 0.33], [0.46, 0.54, 0.39, 0.45], [0.44, 0.56, 0.5, 0.53], [0.3, 0.38, 0.41, 0.46], [0.62, 0.7, 0.41, 0.46]];
  let t = 0, spawnIn = 0.4, score = 0, irritation = 0, clog = 0, done = null;
  const spots = [], pops = [];
  let ptr = null, shake = reduced ? 0 : 0.45, intro = 0.35;
  beep(220, 220, "sawtooth", 0.08); setTimeout(() => beep(180, 260, "sawtooth", 0.08), 180);

  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now(), down: true }; });
  cv.addEventListener("pointerup", () => (ptr = ptr && { ...ptr, down: false }));
  cv.addEventListener("pointermove", (e) => {
    if (!ptr || !ptr.down || done) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
    const d = Math.hypot(x - ptr.x, y - ptr.y), dt = Math.max(now - ptr.t, 1), speed = d / dt; // px per ms
    const limit = w * 0.0042; // gentle vs. scrubbing threshold scales with screen size
    if (speed > limit) irritation += (speed - limit) * Math.min(dt, 50) * 0.06; // ~1.5s of hard scrubbing fills the meter
    for (const s of spots) {
      if (Math.hypot(s.x - x, s.y - y) < s.r + 18) {
        s.oil -= d * (speed > limit ? 0.006 : 0.011);
        if (s.oil <= 0 && !s.dead) { s.dead = true; score += POINTS.action; sh.setScore(score); pops.push({ x: s.x, y: s.y, t: 0 }); beep(990, 50, "triangle"); }
      }
    }
    ptr = { x, y, t: now, down: true };
  });

  const stop = loop((dt) => {
    if (intro > 0) intro -= dt; else if (!done) t += dt;
    if (shake > 0) shake -= dt;
    if (!done && intro <= 0) {
      spawnIn -= dt;
      const rate = 1.05 - 0.55 * (t / DURATION);
      if (spawnIn <= 0 && spots.filter((s) => !s.dead).length < 8) {
        const [x1, x2, y1, y2] = REGIONS[Math.random() < 0.8 ? Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2)];
        const [x, y] = at(x1 + Math.random() * (x2 - x1), y1 + Math.random() * (y2 - y1));
        spots.push({ x, y, r: Math.max(20, dw * 0.06), oil: 1, age: 0 }); spawnIn = rate;
      }
      for (const s of spots) if (!s.dead) { s.age += dt; if (s.age > 5) clog += dt * 7; }
      irritation = Math.max(0, irritation - dt * 6);
      if (clog >= 100) done = "clog"; else if (irritation >= 100) done = "irritated"; else if (t >= DURATION) done = "win";
      sh.setStat(`⏱ ${Math.max(0, Math.ceil(DURATION - t))}s`);
    }
    // draw
    g.save(); g.clearRect(0, 0, w, h);
    if (intro > 0) { g.fillStyle = "#1a1a1a"; g.fillRect(0, 0, w, h); }
    else {
      g.fillStyle = "#fde3ef"; g.fillRect(0, 0, w, h);
      if (shake > 0) g.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 18 * shake);
      const s0 = shake > 0 && !reduced ? 1 + shake * 0.5 : 1;
      g.translate(w / 2, h / 2); g.scale(s0, s0); g.translate(-w / 2, -h / 2);
      g.drawImage(mascot, mascot.width * SRC.x, mascot.height * SRC.y, sw, shh, dx, dy, dw, dh);
      // skin state overlays: dull/sweaty when clogging, red cheeks when irritated
      if (clog > 0) { g.fillStyle = `rgba(150,140,90,${Math.min(clog, 100) / 260})`; const [cx, cy] = at(0.5, 0.42); g.beginPath(); g.ellipse(cx, cy, dw * 0.3, dh * 0.3, 0, 0, 7); g.fill(); }
      if (irritation > 5) { g.fillStyle = `rgba(233,29,120,${Math.min(irritation, 100) / 220})`; for (const nx of [0.34, 0.66]) { const [cx, cy] = at(nx, 0.45); g.beginPath(); g.ellipse(cx, cy, dw * 0.09, dh * 0.07, 0, 0, 7); g.fill(); } }
      for (const s of spots) {
        if (s.dead) continue;
        const a = Math.max(0.15, s.oil) * (s.age > 5 ? 1 : 0.85), grd = g.createRadialGradient(s.x - s.r * 0.3, s.y - s.r * 0.3, 2, s.x, s.y, s.r);
        grd.addColorStop(0, `rgba(255,255,255,${a})`); grd.addColorStop(0.3, `rgba(255,230,120,${0.9 * a})`); grd.addColorStop(0.75, `rgba(240,200,70,${0.55 * a})`); grd.addColorStop(1, `rgba(230,190,60,0)`);
        g.fillStyle = grd; g.beginPath(); g.arc(s.x, s.y, s.r * (1 + Math.min(s.age, 6) * 0.05), 0, 7); g.fill();
        if (s.age > 4) { g.strokeStyle = `rgba(233,29,120,${Math.min((s.age - 4) / 1, 1)})`; g.lineWidth = 3; g.beginPath(); g.arc(s.x, s.y, s.r + 6, 0, 7); g.stroke(); }
      }
      for (const p of pops) { p.t += dt; g.strokeStyle = `rgba(168,207,82,${1 - p.t / 0.4})`; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y, 12 + p.t * 90, 0, 7); g.stroke(); }
      if (ptr && ptr.down) { g.fillStyle = "rgba(255,255,255,.85)"; g.strokeStyle = "#1a1a1a"; g.lineWidth = 2; g.beginPath(); g.arc(ptr.x, ptr.y, 20, 0, 7); g.fill(); g.stroke(); }
    }
    g.restore();
    // meters
    const bar = (y, label, v, col) => { g.fillStyle = "#fff"; g.fillRect(12, y, w - 24, 14); g.fillStyle = col; g.fillRect(12, y, ((w - 24) * Math.min(v, 100)) / 100, 14); g.strokeStyle = "#1a1a1a"; g.lineWidth = 2; g.strokeRect(12, y, w - 24, 14); g.fillStyle = "#1a1a1a"; g.font = "12px Float, Arial"; g.fillText(label, 14, y - 4); };
    if (intro <= 0) { bar(h - 52, "Da bí (để dầu quá lâu)", clog, "#b9a24a"); bar(h - 22, "Kích ứng (chà quá mạnh)", irritation, "#e91d78"); }
    return !done;
  });
  await new Promise((ok) => { const c = setInterval(() => { if (done) { clearInterval(c); ok(); } }, 100); });
  stop(); beep(done === "win" ? 1046 : 200, 250, "triangle");
  const msg = { win: ["DA SẠCH THOÁNG!", "Làm sạch nhẹ nhàng, đúng lúc: đó là bí quyết với da dầu tuổi dậy thì."],
    clog: ["DA HƠI BÍ RỒI!", "Dầu để lâu dễ bít lỗ chân lông. Làm sạch nhẹ nhàng sáng và tối nhé."],
    irritated: ["DA BỊ KÍCH ỨNG!", "Chà mạnh không làm sạch hơn mà khiến da đỏ rát. Hãy nhẹ tay thôi."] }[done];
  return sh.end(msg[0], msg[1], score);
}

// ---------- Chặng 2: swipe Đúng / Sai ----------
export async function swipe(root) {
  const sh = shell(root, 1);
  const wrap = el("div", "swipe"), card = el("div", "scard"), fb = el("div", "sfb", "&nbsp;");
  const btns = el("div", "row sbtns", `<button class="btn sno" type="button">✗ SAI</button><button class="btn primary syes" type="button">ĐÚNG ✓</button>`);
  wrap.append(card, fb, btns); sh.stage.append(wrap);
  await sh.start();
  const deck = shuffle(STATEMENTS).slice(0, DECK_SIZE), LIMIT = DEBUG ? 20 : 75;
  let i = 0, score = 0, combo = 0, t = 0, over = false, drag = null;
  const show = () => { card.style.transition = "none"; card.style.transform = ""; card.innerHTML = `<div class="kicker">${i + 1}/${deck.length}</div><p>${deck[i].s}</p>`; };
  const decide = (yes) => {
    if (over) return;
    const item = deck[i], ok = yes === item.a;
    if (ok) { score += POINTS.action; combo++; beep(880 + combo * 40, 60, "triangle"); } else { combo = 0; beep(180, 160, "sawtooth"); }
    sh.setScore(score);
    fb.innerHTML = `<b class="${ok ? "good" : "bad"}">${ok ? "Chính xác!" : "Chưa đúng!"}${combo > 1 ? ` Combo x${combo}` : ""}</b> ${item.e}`;
    card.style.transition = "transform .25s ease-in"; card.style.transform = `translateX(${yes ? 140 : -140}%) rotate(${yes ? 25 : -25}deg)`;
    setTimeout(() => { if (++i >= deck.length) over = true; else show(); }, reduced ? 0 : 230);
  };
  card.addEventListener("pointerdown", (e) => { drag = { x: e.clientX }; card.setPointerCapture(e.pointerId); card.style.transition = "none"; });
  card.addEventListener("pointermove", (e) => { if (!drag) return; const dx = e.clientX - drag.x; card.style.transform = `translateX(${dx}px) rotate(${dx / 14}deg)`; card.dataset.lean = dx > 40 ? "yes" : dx < -40 ? "no" : ""; });
  card.addEventListener("pointerup", (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag = null; card.dataset.lean = ""; if (Math.abs(dx) > 90) decide(dx > 0); else { card.style.transition = "transform .2s"; card.style.transform = ""; } });
  btns.querySelector(".sno").onclick = () => decide(false); btns.querySelector(".syes").onclick = () => decide(true);
  const key = (e) => { if (e.key === "ArrowLeft") decide(false); if (e.key === "ArrowRight") decide(true); };
  addEventListener("keydown", key);
  show();
  await new Promise((ok) => loop((dt) => { t += dt; sh.setStat(`⏱ ${Math.max(0, Math.ceil(LIMIT - t))}s`); if (t >= LIMIT) over = true; if (over) { ok(); return false; } }));
  removeEventListener("keydown", key);
  const right = score / POINTS.action;
  return sh.end(right >= deck.length * 0.75 ? "THÁM TỬ TIN ĐỒN!" : "ĐÃ LỌC XONG TIN!", `Bạn trả lời đúng ${right}/${deck.length} tin. Gặp tin skincare trên mạng, hãy kiểm tra lại với chuyên gia trước khi làm theo.`, score);
}

// ---------- Chặng 3: 30 ngày cùng Sen (3-lane runner) ----------
export async function runner(root, mascot) {
  const sh = shell(root, 2);
  const cv = el("canvas", "gcanvas"); sh.stage.append(cv);
  const ctl = el("div", "row rbtns", `<button class="btn" type="button" aria-label="Sang trái">◀</button><button class="btn" type="button" aria-label="Sang phải">▶</button>`);
  sh.stage.append(ctl);
  await sh.start();
  let { g, w, h } = fitCanvas(cv);
  let lane = 1, laneX = 1, day = 1, dayT = 0, score = 0, hearts = 3, over = null, flash = 0;
  const items = [];
  const move = (d) => { if (!over) { lane = Math.max(0, Math.min(2, lane + d)); beep(520, 30, "triangle", 0.03); } };
  ctl.children[0].onclick = () => move(-1); ctl.children[1].onclick = () => move(1);
  const key = (e) => { if (e.key === "ArrowLeft") move(-1); if (e.key === "ArrowRight") move(1); };
  addEventListener("keydown", key);
  let sx = null;
  cv.addEventListener("pointerdown", (e) => (sx = e.clientX));
  cv.addEventListener("pointerup", (e) => { if (sx == null) return; const d = e.clientX - sx; sx = null; if (Math.abs(d) > 30) move(Math.sign(d)); else move(e.clientX - cv.getBoundingClientRect().left < w / 2 ? -1 : 1); });

  const HOR = h * 0.24, BOT = h * 0.98, project = (p, ln) => { // p: 0 far .. 1 near
    const e = Math.pow(p, 1.7), y = HOR + (BOT - HOR) * e, half = w * (0.06 + 0.4 * e);
    return { x: w / 2 + (ln - 1) * half * 0.66, y, s: 0.25 + 0.75 * e };
  };
  const spawnDay = () => {
    const lanes = shuffle([0, 1, 2]);
    const gi = GOOD[Math.floor(Math.random() * GOOD.length)];
    items.push({ lane: lanes[0], p: 0, good: true, icon: gi[0], label: gi[1] });
    if (day >= 3) { const bi = BAD[Math.floor(Math.random() * BAD.length)]; items.push({ lane: lanes[1], p: -0.25 - Math.random() * 0.3, good: false, icon: bi[0], label: bi[1] }); }
    if (day >= 12 && Math.random() < 0.5) { const bi = BAD[Math.floor(Math.random() * BAD.length)]; items.push({ lane: lanes[2], p: -0.6, good: false, icon: bi[0], label: bi[1] }); }
  };
  spawnDay();
  const stop = loop((dt) => {
    const speed = 0.55 + day * 0.025, dayLen = DEBUG ? 0.25 : Math.max(0.9, 1.7 - day * 0.03);
    if (!over) {
      dayT += dt;
      if (dayT >= dayLen) { dayT = 0; if (day < RUN_DAYS) { day++; spawnDay(); } }
      for (const it of items) {
        if (it.done) continue;
        it.p += dt * speed;
        if (it.p > 0.86 && it.p < 0.99 && it.lane === lane) {
          it.done = true;
          if (it.good) { score += POINTS.action; beep(1046, 60, "triangle"); }
          else { score = Math.max(0, score - POINTS.action); hearts--; flash = 0.3; beep(160, 200, "sawtooth"); if (hearts <= 0) over = "lose"; }
          sh.setScore(score);
        }
        if (it.p >= 1.05) it.done = true;
      }
      if (day >= RUN_DAYS && items.every((it) => it.done)) over = "win";
      sh.setStat(`Ngày ${day}/${RUN_DAYS} · ${"❤".repeat(hearts)}${"♡".repeat(3 - hearts)}`);
    }
    laneX += (lane - laneX) * Math.min(1, dt * 14);
    // draw road
    const sky = g.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, "#fde3ef"); sky.addColorStop(1, "#fbfaf7");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "#e9f3d2"; g.beginPath(); const a = project(0, -0.5), b = project(0, 2.5), c = project(1, 2.5), d = project(1, -0.5);
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.fill(); g.strokeStyle = "#1a1a1a"; g.lineWidth = 2; g.stroke();
    for (const ln of [0.5, 1.5]) { g.strokeStyle = "#a8cf52"; g.setLineDash([12, 14]); g.lineDashOffset = -dayT * 60; const p0 = project(0, ln), p1 = project(1, ln); g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); g.setLineDash([]); }
    g.fillStyle = "#e91d78"; g.font = `bold ${Math.round(w * 0.05)}px Later, Arial`; g.textAlign = "center"; g.fillText(`NGÀY ${day}`, w / 2, HOR - 14);
    // items far to near
    for (const it of [...items].filter((x) => !x.done && x.p >= 0).sort((x, y) => x.p - y.p)) {
      const q = project(it.p, it.lane), r = 26 * q.s * (w / 400);
      g.fillStyle = it.good ? "#ffffff" : "#1a1a1a"; g.strokeStyle = it.good ? "#a8cf52" : "#e91d78"; g.lineWidth = 4 * q.s;
      g.beginPath(); g.arc(q.x, q.y - r, r, 0, 7); g.fill(); g.stroke();
      g.font = `${Math.round(r * 1.1)}px sans-serif`; g.textBaseline = "middle"; g.fillText(it.icon, q.x, q.y - r);
      if (q.s > 0.45) { g.font = `${Math.round(11 + 5 * q.s)}px Float, Arial`; g.fillStyle = "#1a1a1a"; g.fillText(it.label, q.x, q.y - 2 * r - 10); }
      g.textBaseline = "alphabetic";
    }
    // player
    const pl = project(0.93, laneX), ph = h * 0.22, pw = ph * (mascot.width / mascot.height);
    g.drawImage(mascot, pl.x - pw / 2, pl.y - ph, pw, ph);
    if (flash > 0) { flash -= dt; g.fillStyle = `rgba(233,29,120,${flash})`; g.fillRect(0, 0, w, h); }
    return !over;
  });
  await new Promise((ok) => { const c = setInterval(() => { if (over) { clearInterval(c); ok(); } }, 100); });
  stop(); removeEventListener("keydown", key);
  return sh.end(over === "win" ? "ĐỦ 30 NGÀY!" : "SEN CẦN NGHỈ CHÚT!", over === "win" ? "Thói quen nhỏ, làm đều mỗi ngày: đó là cách da khỏe lâu dài." : `Bạn giữ được ${day} ngày. Thử lại để đi trọn 30 ngày nhé, mỗi ngày một chút là đủ.`, score);
}
