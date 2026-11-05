// Pure image helpers: colour distance, palette extraction, contrast, safe zone.
export const hex2rgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

export function rgb2lab([r, g, b]) {
  const lin = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// shortcut: CIE76 distance, good enough to tell "same swatch" from "different swatch"; upgrade to CIEDE2000 if borderline cases matter
export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const chroma = (lab) => Math.hypot(lab[1], lab[2]);

// k-means in Lab on a downscaled copy; returns clusters sorted by share
export function palette(imageData, k = 6) {
  const px = [];
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push([d[i], d[i + 1], d[i + 2]]);
  if (!px.length) return [];
  const labs = px.map(rgb2lab);
  let cents = Array.from({ length: k }, (_, j) => labs[Math.floor((j + 0.5) * labs.length / k)]);
  let assign = new Array(labs.length).fill(0);
  for (let it = 0; it < 10; it++) {
    assign = labs.map((p) => { let bi = 0, bd = Infinity; cents.forEach((c, j) => { const dd = deltaE(p, c); if (dd < bd) { bd = dd; bi = j; } }); return bi; });
    cents = cents.map((c, j) => {
      let n = 0, s = [0, 0, 0];
      assign.forEach((a, i) => { if (a === j) { n++; s[0] += labs[i][0]; s[1] += labs[i][1]; s[2] += labs[i][2]; } });
      return n ? s.map((v) => v / n) : c;
    });
  }
  const out = cents.map((lab, j) => {
    let n = 0, s = [0, 0, 0];
    assign.forEach((a, i) => { if (a === j) { n++; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; } });
    return { lab, rgb: n ? s.map((v) => v / n) : [0, 0, 0], share: n / px.length };
  }).filter((c) => c.share > 0.01);
  return out.sort((a, b) => b.share - a.share);
}

export const relLum = ([r, g, b]) => {
  const c = (v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
export const contrast = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// shortcut: estimates text contrast from the darkest and lightest 10% of pixels in the text box; real fg/bg segmentation would be more exact
export function boxContrast(imageData, { x0, y0, x1, y1 }) {
  const { width, data } = imageData, px = [];
  for (let y = Math.max(0, y0); y < y1; y += 1) for (let x = Math.max(0, x0); x < x1; x += 1) {
    const i = (y * width + x) * 4; if (i + 2 < data.length) px.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (px.length < 20) return null;
  px.sort((a, b) => relLum(a) - relLum(b));
  const pick = (from, to) => { const s = px.slice(from, to); return [0, 1, 2].map((c) => s.reduce((t, p) => t + p[c], 0) / s.length); };
  const n = px.length, cut = Math.max(1, Math.floor(n * 0.1));
  return contrast(pick(0, cut), pick(n - cut, n));
}

// TikTok/Reels UI covers the top bar, the caption area and the right-hand buttons
export const SAFE = { top: 0.12, bottom: 0.22, right: 0.15 };
export function outsideSafe({ x0, y0, x1, y1 }, w, h) {
  const zones = [];
  if (y0 / h < SAFE.top) zones.push('thanh trên cùng');
  if (y1 / h > 1 - SAFE.bottom) zones.push('vùng caption phía dưới');
  if (x1 / w > 1 - SAFE.right) zones.push('cột nút bên phải');
  return zones;
}
export const isVertical = (w, h) => Math.abs(w / h - 9 / 16) < 0.03;

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

{
  console.assert(rgb2hex(hex2rgb('#E4407B')) === '#E4407B', 'hex roundtrip');
  console.assert(deltaE(rgb2lab([255, 255, 255]), [100, 0, 0]) < 0.5, 'white is L100');
  console.assert(Math.abs(contrast([0, 0, 0], [255, 255, 255]) - 21) < 0.01, 'contrast 21:1');
  console.assert(outsideSafe({ x0: 100, y0: 1700, x1: 400, y1: 1800 }, 1080, 1920).includes('vùng caption phía dưới'), 'bottom zone');
  console.assert(!outsideSafe({ x0: 100, y0: 600, x1: 700, y1: 700 }, 1080, 1920).length, 'centre is safe');
}
