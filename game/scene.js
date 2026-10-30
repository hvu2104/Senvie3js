// Booth scene for Sen Quest: same 12m x 8m booth as the concept, but the 3 chặng run as 3 coloured zones in one day.
// Zone 1 Nhận ra = mirror counter (yellow), Zone 2 Thấu hiểu = discovery wall (soft pink), Zone 3 Duy trì = Sen Talk stage (lime).
import * as THREE from "three";

export const C = { PINK: "#e91d78", INK: "#1a1a1a", SOFT: "#e4b5d2", LIME: "#a8cf52", YELLOW: "#fcdc31", PAPER: "#fbfaf7" };
export const ZONE_COLORS = [C.YELLOW, C.SOFT, C.LIME];

export const EYE = 1.55;
export const START = { x: -3.8, z: 7.0, yaw: 0 }; // outside the gate, facing into the booth (-z)
// Walk into one of these circles to start that zone's mini-game; marker = where the floating number hangs.
export const ZONE_AREAS = {
  z1: { x: -2.4, z: 1.0, r: 1.2, marker: [-2.3, 2.2, -0.4] },
  z2: { x: -2.6, z: -2.6, r: 1.5, marker: [-2.9, 3.0, -3.7] },
  z3: { x: 3.2, z: 0.9, r: 1.4, marker: [3.2, 1.3, -2.4] },
  end: { x: 2.0, z: 4.5, r: 1.1, marker: [2.0, 1.9, 3.3] },
};
// Walkable area and solid objects on the floor plan (x/z in metres). Boxes are [x1, z1, x2, z2], circles [x, z, r].
export const BOUNDS = [-5.9, -3.7, 6.2, 8.5];
export const BOXES = [
  [-6.3, -4.3, 6.3, -3.7],      // back wall + flip cards
  [-6.3, -3.9, -5.85, 0.8],     // left wall
  [-5.33, 3.45, -4.87, 3.95], [-2.73, 3.45, -2.27, 3.95], // gate pillars
  [-5.2, 0.8, -4.6, 2.6],       // check-in desk
  [-4.1, -0.9, -1.0, 0.12],     // mirror counter
  [1.6, 2.95, 2.4, 3.65],       // mailbox
  [3.3, 3.66, 5.5, 3.84],       // note board (gap to the mailbox is wide enough to walk through)
  [5.55, -0.65, 5.95, 1.85],    // photobooth frame
  [-0.8, 3.2, 0.0, 4.0],        // totem
];
const STOOLS = Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.15 + i * 0.117); return [3.2 + Math.cos(a) * 2.5, -2.4 + Math.sin(a) * 2.5]; });
export const CIRCLES = [[3.2, -2.4, 1.9], [1.2, 3.3, 0.35], [-4.6, -0.2, 0.3], [-5.0, -2.9, 0.3], [4.8, -0.8, 0.3], [1.6, -2.8, 0.3], [5.0, 2.6, 0.3], ...STOOLS.map(([x, z]) => [x, z, 0.24])];

export async function buildBooth(scene, A) {
  const { PINK, INK, SOFT, LIME, YELLOW, PAPER } = C;
  scene.background = new THREE.Color("#eceae6");
  scene.add(new THREE.HemisphereLight("#ffffff", "#c9c4bc", 1.6));
  const sun = new THREE.DirectionalLight("#ffffff", 2.2); sun.position.set(7, 14, 9); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005;
  scene.add(sun);

  // canvas texture helper; px per meter = 200
  function tex(wm, hm, draw, ppm = 200) {
    const c = document.createElement("canvas"); c.width = Math.round(wm * ppm); c.height = Math.round(hm * ppm);
    draw(c.getContext("2d"), c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const grid = (g, w, h, bg = PAPER, step = 40) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = "#00000014"; g.lineWidth = 2; for (let x = 0; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } };
  const label = (g, text, x, y, size, font = "Later", fill = INK, align = "left", stroke) => { g.font = `${size}px ${font}`; g.textAlign = align; g.textBaseline = "middle"; if (stroke) { g.lineWidth = size / 10; g.strokeStyle = stroke; g.strokeText(text, x, y); } g.fillStyle = fill; g.fillText(text, x, y); };
  const sticker = (g, text, x, y, size, bg, rot = 0) => { g.save(); g.translate(x, y); g.rotate(rot); g.font = `${size}px Later`; const w = g.measureText(text).width + size; g.fillStyle = INK; g.fillRect(-w / 2 + 8, -size * 0.75 + 8, w, size * 1.5); g.fillStyle = bg; g.fillRect(-w / 2, -size * 0.75, w, size * 1.5); g.lineWidth = 6; g.strokeStyle = INK; g.strokeRect(-w / 2, -size * 0.75, w, size * 1.5); label(g, text, 0, 2, size, "Later", INK, "center"); g.restore(); };

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
  const edgeMat = new THREE.LineBasicMaterial({ color: INK });
  function add(geo, material, x, y, z, { ry = 0, edges = true, cast = true } = {}) {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = true; scene.add(m);
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat));
    return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const faced = (t, side = PAPER) => { const s = mat(side); return [s, s, s, s, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), s]; };
  const pink = mat(PINK), white = mat("#ffffff"), ink = mat(INK);

  // floor, zone carpets and guiding path
  add(box(12.4, 0.12, 8.4), mat("#f4f2ee"), 0, 0.06, 0, { cast: false });
  add(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ map: tex(12, 8, (g, w, h) => grid(g, w, h, "#f4f2ee", 100), 50), roughness: 0.9 }), 0, 0.125, 0, { edges: false, cast: false }).rotation.x = -Math.PI / 2;
  [[-2.4, 0.4, 3.6, 2.6, YELLOW], [-2.9, -2.6, 5.4, 2.2, SOFT], [3.2, -1.4, 5.2, 4.6, LIME]].forEach(([x, z, w, d, col]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(col, { transparent: true, opacity: 0.35 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.127, z); m.receiveShadow = true; scene.add(m);
  });
  const path = new THREE.CatmullRomCurve3([[-3.8, 4.6], [-3.8, 2.6], [-2.4, 1.6], [-0.9, 0.6], [-1.0, -1.4], [0.4, -0.6], [1.6, 0.9], [2.8, 1.8], [3.6, 2.6], [3.0, 4.6]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  { const pts = path.getSpacedPoints(160), pos = [], idx = [];
    pts.forEach((p, i) => { const t = path.getTangentAt(i / 160), n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(0.35); pos.push(p.x + n.x, 0.13, p.z + n.z, p.x - n.x, 0.13, p.z - n.z); if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(PINK, { side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m); }

  // back wall: zone 2 headline on the left, Sen Talk screen on the right
  const backTex = tex(12, 3.2, (g, w, h) => {
    grid(g, w, h);
    sticker(g, "ZONE 2 · ĐÚNG HAY SAI?", 640, 80, 58, SOFT, -0.015);
    label(g, "THẤU HIỂU · LẬT THẺ ĐỂ BIẾT THÊM", 640, 170, 30, "Float", INK, "center");
    sticker(g, "ZONE 3 · ROUTINE CỦA MÌNH", 1840, 38, 30, LIME, 0.01);
  });
  add(box(12, 3.2, 0.2), faced(backTex), 0, 1.72, -4.1);
  const myths = ["Nặn mụn?", "Kem đánh răng?", "Rửa 5 lần/ngày?", "Da dầu bỏ dưỡng?", "Sạch kin kít?", "Ăn cay = mụn?", "Phơi nắng?", "Dùng đồ mẹ?", "Càng nhiều bước?", "Đắp chanh?", "Mụn tự hết?", "Kem trộn?", "Thức khuya?", "Che mụn?", "Trend TikTok?"];
  myths.forEach((t, i) => {
    const r = Math.floor(i / 5), c = i % 5, flip = (i * 7) % 3 === 0;
    const tx = tex(0.95, 0.6, (g, w, h) => {
      g.fillStyle = flip ? "#fff" : (i % 2 ? SOFT : PINK); g.fillRect(0, 0, w, h);
      let fs = flip ? 30 : 70; g.font = `${fs}px Float`; while (flip && g.measureText(t).width > w - 20) g.font = `${--fs}px Float`;
      label(g, flip ? t : "?", w / 2, h / 2 + 4, fs, flip ? "Float" : "Later", flip ? INK : (i % 2 ? INK : "#fff"), "center");
    });
    add(box(0.95, 0.6, 0.08), faced(tx, "#fff"), -5.2 + c * 1.12, 2.05 - r * 0.75, flip ? -3.82 : -3.96, { ry: flip ? 0.25 : 0 });
  });
  const screenTex = tex(3.6, 2, (g, w, h) => {
    g.fillStyle = INK; g.fillRect(0, 0, w, h); grid(g, w, h, "#232323", 60);
    label(g, "SEN TALK", w / 2, 150, 120, "Later", PINK, "center", "#000");
    label(g, "Routine tối giản 3 bước", w / 2, 260, 34, "Float", "#fff", "center");
    g.drawImage(A.mascot, w / 2 - 95, 300, 190, 262);
  });
  add(box(3.6, 2, 0.1), faced(screenTex, INK), 3.2, 1.95, -3.94);

  // left wall: brand panel
  const leftTex = tex(4.6, 3.2, (g, w, h) => {
    grid(g, w, h); g.fillStyle = PINK; g.fillRect(0, h - 120, w, 120);
    g.drawImage(A.logo, 60, 60, 420, 228);
    label(g, "Hiểu da mình,", 60, 360, 64); label(g, "đồng hành cùng nhau.", 60, 440, 64, "Later", PINK);
    g.drawImage(A.mascot, w - 300, h - 120 - 380, 276, 380);
    label(g, "SENVIE CLUB · SENVIE LAB", 60, h - 60, 40, "Float", "#fff");
  });
  add(box(4.6, 3.2, 0.2), faced(leftTex), -6.1, 1.72, -1.6, { ry: Math.PI / 2 });

  // gate + check-in desk
  add(box(0.45, 2.9, 0.5), pink, -5.1, 1.57, 3.7); add(box(0.45, 2.9, 0.5), pink, -2.5, 1.57, 3.7);
  const beamTex = tex(3.1, 0.75, (g, w, h) => { g.fillStyle = PINK; g.fillRect(0, 0, w, h); label(g, "SEN QUEST", w / 2, h / 2 + 6, 80, "Later", "#fff", "center", INK); });
  add(box(3.1, 0.75, 0.55), faced(beamTex, PINK), -3.8, 3.3, 3.7);
  const deskTex = tex(1.8, 1, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); sticker(g, "CHECK-IN", w / 2, h / 2, 46, YELLOW, -0.03); });
  add(box(1.8, 1, 0.6), faced(deskTex, "#fff"), -4.9, 0.62, 1.7, { ry: Math.PI / 2 - 0.0001 });

  // zone 1: mirror counter
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.95, 32), white, -3.6, 0.6, -0.4);
  add(box(2.6, 0.95, 0.9), white, -2.3, 0.6, -0.4); add(box(2.8, 0.06, 1.0), mat(YELLOW), -2.3, 1.1, -0.4);
  for (let i = 0; i < 3; i++) {
    const mx = -3.2 + i * 0.9;
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 40), mat("#cfd8dc", { metalness: 0.9, roughness: 0.12 }), mx, 1.55, -0.62).rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(0.33, 0.03, 12, 48), pink, mx, 1.55, -0.6, { edges: false });
    add(box(0.06, 0.4, 0.06), ink, mx, 1.25, -0.62, { edges: false });
  }
  const counterSign = tex(1.9, 0.4, (g, w, h) => { g.fillStyle = YELLOW; g.fillRect(0, 0, w, h); label(g, "ZONE 1 · NHẬN RA", w / 2, h / 2 + 4, 44, "Later", INK, "center"); });
  add(box(1.9, 0.4, 0.05), faced(counterSign, YELLOW), -2.4, 0.6, 0.08);

  // zone 3: Sen Talk stage, stools, ring
  add(new THREE.CylinderGeometry(1.9, 1.9, 0.18, 64), mat(LIME), 3.2, 0.21, -2.4);
  STOOLS.forEach(([x, z], i) => add(new THREE.CylinderGeometry(0.22, 0.2, 0.45, 24), i % 2 ? pink : mat(LIME), x, 0.35, z));
  const ringTex = tex(16.3, 0.6, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); for (let x = 20; x < w; x += 640) label(g, "SEN TALK ✦", x, h / 2 + 6, 80, "Later", PINK); }, 100);
  add(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 72, 1, true), [new THREE.MeshStandardMaterial({ map: ringTex })], 3.2, 3.75, -2.2, { cast: false });
  add(new THREE.CylinderGeometry(2.58, 2.58, 0.6, 72, 1, true), mat(PINK, { side: THREE.BackSide }), 3.2, 3.75, -2.2, { cast: false, edges: false });

  // end: mailbox, note board, photobooth, standee, totem
  const mailTex = tex(0.8, 1.4, (g, w) => { g.fillStyle = PINK; g.fillRect(0, 0, w, 280); g.fillStyle = INK; g.fillRect(w * 0.15, 160, w * 0.7, 26); label(g, "HỘP THƯ", w / 2, 60, 40, "Later", "#fff", "center"); label(g, "BÉ SEN", w / 2, 110, 40, "Later", YELLOW, "center"); label(g, "Tra 3 chìa vào đây", w / 2, 240, 20, "Float", "#fff", "center"); });
  add(box(0.8, 1.4, 0.7), faced(mailTex, PINK), 2.0, 0.82, 3.3);
  const noteTex = tex(2.2, 1.8, (g, w) => {
    grid(g, w, 360, "#fff"); const cols = [YELLOW, SOFT, LIME, "#49c4da"];
    ["Mụn có lây không?", "Da dầu dùng gì?", "Mấy tuổi dưỡng da?", "Có nên nặn mụn?", "Tắm xong hay ngứa", "Sao mũi nhiều đầu đen?", "Chống nắng loại nào?", "Rửa mặt mấy lần?", "Mụn lưng thì sao?"].forEach((t, i) => {
      const x = 40 + (i % 3) * 140, y = 40 + Math.floor(i / 3) * 112; g.save(); g.translate(x + 60, y + 50); g.rotate(((i * 37) % 9 - 4) / 60); g.fillStyle = cols[i % 4]; g.fillRect(-62, -48, 124, 96);
      const ws = t.split(" "), k = Math.ceil(ws.length / 2); label(g, ws.slice(0, k).join(" "), 0, -12, 15, "Float", INK, "center"); label(g, ws.slice(k).join(" "), 0, 12, 15, "Float", INK, "center"); g.restore();
    });
  });
  { const f = faced(noteTex, "#fff"); f[5] = f[4]; add(box(2.2, 1.8, 0.06), f, 4.4, 1.4, 3.75, { ry: Math.PI }); }
  const fx = 5.7, fz = 0.6;
  [[2.95, 0.3], [0.55, 0.7]].forEach(([y, h]) => add(box(0.18, h, 2.4), white, fx, y, fz));
  add(box(0.18, 2.1, 0.25), white, fx, 1.85, fz - 1.075); add(box(0.18, 2.1, 0.25), white, fx, 1.85, fz + 1.075);
  add(box(0.05, 2.6, 2.4), mat(YELLOW), fx + 0.25, 1.6, fz, { edges: false });
  const mt = new THREE.CanvasTexture(A.mascot); mt.colorSpace = THREE.SRGBColorSpace;
  const standee = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.66), new THREE.MeshStandardMaterial({ map: mt, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  standee.position.set(1.2, 0.96, 3.3); standee.rotation.y = 0.2; standee.castShadow = true; scene.add(standee);
  const totTex = tex(0.8, 3.6, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.drawImage(A.logo, -330, -90, 660, 180); g.restore(); g.fillStyle = PINK; g.fillRect(0, h - 90, w, 90); });
  add(box(0.8, 3.6, 0.8), faced(totTex, "#fff"), -0.4, 1.92, 3.6);

  // a few visitors for scale, kept out of the player's sight lines
  [[-4.6, -0.2, 0], [-5.0, -2.9, 2], [4.8, -0.8, 1], [1.6, -2.8, 3], [5.0, 2.6, 0]].forEach(([x, z, c]) => {
    const col = ["#9aa3ad", "#b8a99a", "#8f9e8b", "#a99ab8"][c];
    add(new THREE.CapsuleGeometry(0.19, 0.95, 6, 16), mat(col), x, 0.8, z, { edges: false });
    add(new THREE.SphereGeometry(0.14, 20, 16), mat(col), x, 1.58, z, { edges: false });
  });
}
