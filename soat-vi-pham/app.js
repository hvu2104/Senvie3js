import { scan, SEV, RANK, SRC } from './rules.js';
import { hex2rgb, rgb2hex, rgb2lab, deltaE, chroma, palette, boxContrast, outsideSafe, isVertical, fmtTime } from './vision.js';
import { ocr, clip, asr, cos } from './models.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const once = (el, ev) => new Promise((ok, fail) => { el.addEventListener(ev, ok, { once: true }); el.addEventListener('error', () => fail(new Error('Không đọc được file')), { once: true }); });
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } } };

/* ---------- navigation ---------- */
document.querySelectorAll('.menu button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
function show(view) {
  document.querySelectorAll('.menu button').forEach((b) => b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== view));
  if (view === 'guide') renderGuide();
}

/* ---------- shared: issues + steps ---------- */
function issueBox() {
  const map = new Map();
  return {
    add(key, base, ev = {}) {
      const it = map.get(key) || { sev: base.sev, name: base.name, why: base.why, fix: base.fix, src: base.src, ai: base.ai, frames: [], quotes: [] };
      if (ev.frame && it.frames.length < 6) it.frames.push(ev.frame);
      if (ev.quote && it.quotes.length < 8 && !it.quotes.some((q) => q.text === ev.quote.text && q.where === ev.quote.where)) it.quotes.push(ev.quote);
      map.set(key, it);
    },
    list: () => [...map.values()].sort((a, b) => RANK[a.sev] - RANK[b.sev]),
  };
}
function renderIssues(el, list, filter = 'all') {
  const shown = list.filter((i) => filter === 'all' || i.sev === filter);
  el.innerHTML = shown.map((i) => `<article class="issue">
    <div class="head"><span class="pill ${i.sev}">${SEV[i.sev]}</span><b>${esc(i.name)}</b>${i.ai ? '<span class="ai">AI đoán, cần xem lại</span>' : ''}</div>
    ${i.quotes.length ? `<div class="quotes">${i.quotes.map((q) => `<div><time>${q.t != null ? fmtTime(q.t) : ''}</time><span><span class="muted">${esc(q.where)}:</span> “${esc(q.text)}”</span></div>`).join('')}</div>` : ''}
    ${i.frames.length ? `<div class="ev">${i.frames.map((f) => `<figure><img src="${f.img}" alt=""><figcaption>${esc(f.label)}</figcaption></figure>`).join('')}</div>` : ''}
    <p class="why">${esc(i.why)}</p>
    ${i.fix ? `<p class="fix"><b>Cách sửa:</b> ${esc(i.fix)}</p>` : ''}
    ${i.src ? `<a href="${i.src}" target="_blank" rel="noopener">Xem quy định →</a>` : ''}
  </article>`).join('') || (list.length ? '<p class="muted">Không có mục nào ở nhóm này.</p>' : '');
}
function renderVerdict(el, list) {
  const n = { block: 0, warn: 0, tip: 0 }; list.forEach((i) => n[i.sev]++);
  const top = n.block ? 'block' : n.warn ? 'warn' : n.tip ? 'tip' : 'ok';
  const title = { block: 'Chưa nên đăng', warn: 'Đăng được nhưng dễ bị hạn chế', tip: 'Đăng được, nên sửa thêm', ok: 'Không phát hiện lỗi' }[top];
  el.className = 'verdict ' + top;
  el.innerHTML = `<strong>${title}</strong><div class="counts">${['block', 'warn', 'tip'].map((s) => `<span class="pill ${s}">${n[s]} ${SEV[s]}</span>`).join('')}</div>`;
  return { title, n };
}
function steps(el, names) {
  el.innerHTML = names.map(([id, label]) => `<div class="step" data-s="${id}"><span class="dot"></span><span>${label}</span><small></small></div>`).join('');
  return (id, state, note = '') => { const s = el.querySelector(`[data-s="${id}"]`); if (!s) return; if (state) s.className = 'step ' + state; s.querySelector('small').textContent = note; };
}
const progressNote = (set, id, label) => { const files = {}; return (p) => { if (p.status === 'progress') { files[p.file] = p.progress; const v = Object.values(files); set(id, 'run', `${label} ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}%`); } }; };

/* ---------- checklist (what AI can't see) ---------- */
const CHECKS = [
  { id: 'disc', q: 'Nhãn nội dung thương mại', opts: [['Đã bật', null], ['Chưa bật', 'block'], ['Không quảng bá', null]], why: 'Video quảng bá sản phẩm mà chưa bật nhãn “Nội dung thương mại” sẽ bị TikTok yêu cầu bật trong 24 giờ hoặc bị gỡ.', src: SRC.disc },
  { id: 'aigc', q: 'Nhãn nội dung AI', opts: [['Đã bật', null], ['Chưa bật', 'block'], ['Không dùng AI', null]], why: 'TikTok yêu cầu dán nhãn rõ ràng khi dùng AI để mô tả người hoặc cảnh giống thật.', src: SRC.cg },
  { id: 'minor', q: 'Người dưới 18 tuổi trong video', opts: [['Có đồng ý phụ huynh', null], ['Chưa có đồng ý', 'block'], ['Không có', null]], why: 'Quy định nội bộ của campaign: người dưới 18 tuổi phải có đồng ý bằng văn bản của phụ huynh.', src: null },
  { id: 'music', q: 'Nhạc nền', opts: [['Có license / CML', null], ['Nhạc trend cá nhân', 'block'], ['Không có nhạc', null]], why: 'Tài khoản doanh nghiệp dùng nhạc không có license có thể bị tắt tiếng hoặc gỡ video.', src: SRC.cg },
  { id: 'expert', q: 'Lời khuyên về da đã được chuyên gia duyệt', opts: [['Đã duyệt', null], ['Chưa duyệt', 'warn'], ['Không có lời khuyên', null]], why: 'Thông tin sai về sức khỏe có thể bị gỡ. Quy định nội bộ: mọi lời khuyên chăm da cần chuyên gia duyệt.', src: SRC.cg },
];
const answers = {};
function renderChecks() {
  let done = 0;
  $('checks').innerHTML = CHECKS.map((c) => {
    const a = answers[c.id], sev = a && c.opts.find(([l]) => l === a)[1];
    if (a && !sev) done++;
    return `<div class="t"><span class="ring ${a ? (sev ? 'bad' : 'ok') : ''}"></span><div><div class="q">${esc(c.q)}</div><div class="opts" role="group" aria-label="${esc(c.q)}">${c.opts.map(([l]) => `<button data-c="${c.id}" data-v="${esc(l)}" aria-pressed="${a === l}">${esc(l)}</button>`).join('')}</div></div></div>`;
  }).join('');
  $('ckCount').textContent = `${done}/${CHECKS.length} xong`;
  $('ckBar').innerHTML = CHECKS.map((_, i) => `<i style="flex:1;${i < done ? '' : 'background:transparent'}"></i>`).join('');
}
$('checks').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-c]'); if (!b) return;
  answers[b.dataset.c] = answers[b.dataset.c] === b.dataset.v ? undefined : b.dataset.v;
  renderChecks(); if (lastVideo) finishVideo(lastVideo);
});
function checklistIssues(box) {
  for (const c of CHECKS) {
    const a = answers[c.id], sev = a ? c.opts.find(([l]) => l === a)[1] : (c.opts.some(([, s]) => s === 'block') ? 'warn' : 'tip');
    if (sev) box.add('chk-' + c.id, { sev, name: a ? `${c.q}: ${a}` : `Chưa trả lời checklist: ${c.q}`, why: c.why, src: c.src });
  }
}
renderChecks();

/* ---------- video ---------- */
const RISKS = [
  { id: 'beforeafter', p: 'a side by side before and after comparison photo of a face', name: 'Có thể là ảnh before/after', why: 'Before/after dễ bị coi là hứa kết quả, vi phạm luật quảng cáo mỹ phẩm.', fix: 'Bỏ cảnh so sánh, chỉ giữ cảnh dùng sản phẩm.', src: SRC.nd342 },
  { id: 'closeup', p: 'an extreme close-up photo of inflamed acne or a skin wound', name: 'Có thể là cận mụn viêm hoặc vết thương', why: 'Cận tổn thương da có thể bị xếp vào nội dung gây khó chịu và sai tone “không phán xét”.', fix: 'Quay ở cỡ trung, che bằng sticker hoặc patch.', src: SRC.cg },
  { id: 'exposure', p: 'a person wearing only underwear or a swimsuit', name: 'Có thể hở cơ thể', why: 'Phơi bày cơ thể, nhất là với người dưới 18 tuổi, bị TikTok hạn chế hoặc gỡ.', fix: 'Quay từ vai trở lên khi chăm da.', src: SRC.cg },
  { id: 'medical', p: 'medicine pills, a syringe or a doctor in a hospital', name: 'Hình ảnh thuốc hoặc bối cảnh y tế', why: 'Hình ảnh thuốc, bệnh viện làm mỹ phẩm trông như thuốc chữa bệnh.', fix: 'Đổi sang bối cảnh phòng tắm, phòng ngủ.', src: SRC.ads },
];
const NEUTRAL = ['a person applying skincare at home', 'a skincare product bottle on a table', 'a person talking to the camera', 'a cute 3d cartoon character', 'a bedroom or bathroom interior', 'text on a colorful background', 'friends smiling together', 'a person washing their face at a sink', 'an exhibition with pastel decorations'];
const WATERMARK = /\b(veo|gemini|tiktok|capcut|kling|runway|seedance|hailuo|pika|sora)\b|@[\w.]{3,}/i;

let vFileObj = null, lastVideo = null, vFilter = 'all';
function pickVideo(f) {
  if (!f || !f.type.startsWith('video')) return;
  vFileObj = f; $('vDrop').firstChild.textContent = f.name;
  $('vPreview').src = URL.createObjectURL(f); $('vMediaCard').hidden = false; $('vRun').disabled = false; $('vHint').textContent = '';
  $('vSteps').innerHTML = '';
  once($('vPreview'), 'loadedmetadata').then(() => {
    const v = $('vPreview');
    $('vMeta').innerHTML = [['Tên file', f.name], ['Kích thước', `${v.videoWidth} × ${v.videoHeight}`], ['Tỷ lệ', isVertical(v.videoWidth, v.videoHeight) ? '9:16' : (v.videoWidth / v.videoHeight).toFixed(2)], ['Thời lượng', fmtTime(v.duration)], ['Dung lượng', (f.size / 1048576).toFixed(1) + ' MB']]
      .map(([k, val]) => `<div><span>${k}</span>${esc(val)}</div>`).join('');
  }).catch(() => ($('vHint').textContent = 'Trình duyệt không đọc được video này. Thử xuất lại sang mp4 (H.264).'));
}
$('vFile').addEventListener('change', (e) => pickVideo(e.target.files[0]));
$('vPlus').addEventListener('click', () => $('vFile').click());
for (const [drop, pick] of [['vDrop', pickVideo], ['dDrop', (f) => pickDesign(f)]]) {
  $(drop).addEventListener('dragover', (e) => { e.preventDefault(); $(drop).classList.add('over'); });
  $(drop).addEventListener('dragleave', () => $(drop).classList.remove('over'));
  $(drop).addEventListener('drop', (e) => { e.preventDefault(); $(drop).classList.remove('over'); pick(e.dataTransfer.files[0]); });
}

async function grabFrames(file, onEach) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(file);
  await once(v, 'loadedmetadata');
  const every = Math.max(2, v.duration / 20), frames = [];
  const W = Math.min(720, v.videoWidth), H = Math.round(W * v.videoHeight / v.videoWidth);
  for (let t = Math.min(0.5, v.duration / 2); t < v.duration; t += every) {
    v.currentTime = t; await once(v, 'seeked');
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(v, 0, 0, W, H);
    frames.push({ t, canvas: c, img: c.toDataURL('image/jpeg', 0.8) }); onEach(frames.length);
  }
  URL.revokeObjectURL(v.src);
  return { frames, w: v.videoWidth, h: v.videoHeight, dur: v.duration };
}

async function readLines(canvas) {
  const { data } = await (await ocr()).recognize(canvas);
  // drop OCR noise from textures: needs a 3+ letter word and mostly letters
  const real = (t) => /\p{L}{3,}/u.test(t) && (t.match(/[\p{L}\s]/gu) || []).length / t.length > 0.7;
  return (data.lines || []).map((l) => ({ text: l.text.trim(), conf: l.confidence, bbox: l.bbox })).filter((l) => l.conf >= 60 && real(l.text));
}

async function audioOf(file) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const n = Math.min(buf.length, 16000 * 240), out = new Float32Array(n);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) out[i] += d[i] / buf.numberOfChannels; }
    return out;
  } finally { ctx.close(); }
}

$('vRun').addEventListener('click', async () => {
  if (!vFileObj) return;
  $('vRun').disabled = true; $('vIssues').innerHTML = ''; $('vTabs').hidden = true; $('vRead').hidden = true;
  const set = steps($('vSteps'), [['frames', 'Cắt khung hình'], ['ocr', 'Đọc chữ trên hình'], ['asr', 'Nghe lời thoại'], ['clip', 'Nhận diện hình ảnh rủi ro'], ['text', 'Soát caption và tổng hợp']]);
  const R = { meta: null, ocr: [], asr: [], clipHits: [], errors: [] };
  try {
    set('frames', 'run');
    const g = await grabFrames(vFileObj, (n) => set('frames', 'run', `${n} khung`));
    R.meta = g; set('frames', 'done', `${g.frames.length} khung`);

    if ($('optOcr').checked) {
      set('ocr', 'run', 'Tải model…');
      try {
        for (const [i, f] of g.frames.entries()) { set('ocr', 'run', `Khung ${i + 1}/${g.frames.length}`); for (const l of await readLines(f.canvas)) R.ocr.push({ ...l, t: f.t, frame: f }); }
        set('ocr', 'done', `${new Set(R.ocr.map((l) => l.text.toLowerCase())).size} dòng chữ`);
      } catch (e) { set('ocr', 'err', e.message); R.errors.push('OCR: ' + e.message); }
    } else set('ocr', 'skip', 'Bỏ qua');

    if ($('optAsr').checked) {
      set('asr', 'run', 'Đọc âm thanh…');
      try {
        const audio = await audioOf(vFileObj);
        const pipe = await asr(progressNote(set, 'asr', 'Tải model'));
        set('asr', 'run', 'Đang nghe…');
        const out = await pipe(audio, { language: 'vietnamese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
        R.asr = (out.chunks || [{ timestamp: [0], text: out.text }]).map((c) => ({ t: c.timestamp[0] ?? 0, text: c.text.trim() })).filter((c) => c.text);
        set('asr', 'done', `${R.asr.length} đoạn`);
      } catch (e) { set('asr', /decode|audio/i.test(e.message) ? 'skip' : 'err', /decode|audio/i.test(e.message) ? 'Không có âm thanh' : e.message); if (!/decode|audio/i.test(e.message)) R.errors.push('Lời thoại: ' + e.message); }
    } else set('asr', 'skip', 'Bỏ qua');

    if ($('optClip').checked) {
      set('clip', 'run', 'Tải model…');
      try {
        const m = await clip(progressNote(set, 'clip', 'Tải model'));
        const labels = [...RISKS.map((r) => r.p), ...NEUTRAL];
        const te = await m.texts(labels);
        set('clip', 'run', 'Đang xem khung hình…');
        const ie = await m.images(g.frames.map((f) => f.img));
        ie.forEach((v, i) => {
          const logits = te.map((t) => 100 * cos(v, t)), mx = Math.max(...logits), ex = logits.map((l) => Math.exp(l - mx)), sum = ex.reduce((a, b) => a + b, 0);
          const probs = ex.map((x) => x / sum), top = probs.indexOf(Math.max(...probs));
          if (top < RISKS.length && probs[top] >= 0.4) R.clipHits.push({ risk: RISKS[top], p: probs[top], frame: g.frames[i] });
        });
        set('clip', 'done', R.clipHits.length ? `${R.clipHits.length} khung đáng ngờ` : 'Không thấy');
      } catch (e) { set('clip', 'err', e.message); R.errors.push('Hình ảnh: ' + e.message); }
    } else set('clip', 'skip', 'Bỏ qua');

    set('text', 'run'); lastVideo = R; finishVideo(R); set('text', 'done');
  } catch (e) { set('frames', 'err', e.message); }
  $('vRun').disabled = false;
});

function finishVideo(R) {
  const box = issueBox(), g = R.meta;
  if (g) {
    if (!isVertical(g.w, g.h)) box.add('ratio', { sev: 'warn', name: `Khung hình ${g.w}×${g.h}, không phải 9:16`, why: 'Video không dọc 9:16 sẽ có viền đen hoặc bị cắt trên TikTok và Reels.', fix: 'Xuất lại ở 1080×1920.' });
    else if (g.h < 1280) box.add('res', { sev: 'tip', name: `Độ phân giải thấp (${g.w}×${g.h})`, why: 'Video dưới 720p nhìn mờ trên điện thoại.', fix: 'Xuất ở 1080×1920.' });
    if (g.dur > 60) box.add('dur', { sev: 'tip', name: `Video dài ${fmtTime(g.dur)}`, why: 'Guideline campaign: video sản phẩm 7–15s, video kiến thức tối đa 60s.', fix: 'Cắt gọn hoặc chia thành series.' });
  }
  const seen = new Set();
  for (const l of R.ocr) {
    const key = l.text.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
    const frame = { img: l.frame.img, label: `${fmtTime(l.t)} · ${l.text.slice(0, 40)}` };
    if (WATERMARK.test(l.text)) { box.add('watermark', { sev: 'warn', name: 'Có thể còn watermark hoặc tên tài khoản khác', why: 'Watermark của công cụ AI hoặc nền tảng khác làm video bị coi là không nguyên bản và giảm đề xuất.', fix: 'Crop hoặc che góc có logo trước khi xuất.', src: SRC.fyf }, { frame }); continue; }
    for (const h of scan(l.text)) box.add(h.rule.id, h.rule, { quote: { t: l.t, where: 'Chữ trên hình', text: l.text }, frame });
    const zones = isVertical(g.w, g.h) ? outsideSafe(l.bbox, l.frame.canvas.width, l.frame.canvas.height) : [];
    if (zones.length) box.add('safezone', { sev: 'tip', name: 'Chữ nằm ngoài safe zone', why: 'Chữ ở các vùng này bị nút, caption hoặc tên tài khoản của TikTok che.', fix: 'Dời chữ vào khoảng giữa khung, cách mép dưới khoảng 25%.' }, { frame: { img: l.frame.img, label: `${fmtTime(l.t)} · ${zones.join(', ')}` } });
  }
  // shortcut: patches Whisper's usual Vietnamese slips before scanning; extend the list as new ones show up in tests
  const heard = (t) => t.replace(/mụng/gi, 'mụn').replace(/\blinh\s+bi[oô]\b/gi, 'link bio');
  for (const c of R.asr) for (const h of scan(heard(c.text))) box.add(h.rule.id, h.rule, { quote: { t: c.t, where: 'Lời thoại', text: c.text } });
  for (const h of R.clipHits) box.add('clip-' + h.risk.id, { ...h.risk, sev: 'warn', ai: true }, { frame: { img: h.frame.img, label: `${fmtTime(h.frame.t)} · ${Math.round(h.p * 100)}%` } });
  const cap = $('vCaption').value;
  for (const h of scan(cap)) box.add(h.rule.id, h.rule, { quote: { where: 'Caption', text: cap.slice(h.start, h.end) } });
  const tags = (cap.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  if (tags > 5) box.add('tags', { sev: 'tip', name: `Caption có ${tags} hashtag`, why: 'Nên giữ 3–5 hashtag liên quan, nhiều hơn dễ trông như spam.', fix: '#GiaiMaLanDa #SenvieLab + 1–3 hashtag chủ đề.' });
  for (const e of R.errors) box.add('err-' + e, { sev: 'tip', name: 'Một bước soát bị lỗi', why: e + '. Kết quả phần này chưa đầy đủ, hãy kiểm tra thủ công.' });
  checklistIssues(box);

  const list = box.list();
  const v = renderVerdict($('vVerdict'), list);
  renderIssues($('vIssues'), list, vFilter); $('vTabs').hidden = false;
  $('vRead').hidden = false;
  $('vOcrText').textContent = [...new Map(R.ocr.map((l) => [l.text.toLowerCase(), `${fmtTime(l.t)}  ${l.text}`])).values()].join('\n') || '(không đọc được chữ nào)';
  $('vAsrText').textContent = R.asr.map((c) => `${fmtTime(c.t)}  ${c.text}`).join('\n') || '(không có lời thoại)';
  $('vCopy').disabled = false;
  $('vCopy').onclick = () => copy(`Soát video "${vFileObj?.name}": ${v.title}\n${v.n.block} Chặn · ${v.n.warn} Cảnh báo · ${v.n.tip} Gợi ý\n\n` +
    list.map((i) => `[${SEV[i.sev]}] ${i.name}${i.ai ? ' (AI đoán)' : ''}\n${i.quotes.map((q) => `  ${q.t != null ? fmtTime(q.t) + ' ' : ''}${q.where}: "${q.text}"`).join('\n')}${i.quotes.length ? '\n' : ''}  ${i.why}${i.fix ? '\n  Cách sửa: ' + i.fix : ''}`).join('\n\n'), $('vToast'));
}
$('vTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !lastVideo) return;
  vFilter = b.dataset.f; $('vTabs').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  finishVideo(lastVideo);
});
function copy(text, toast) {
  const done = (m) => { toast.textContent = m; setTimeout(() => (toast.textContent = ''), 2500); };
  navigator.clipboard.writeText(text).then(() => done('Đã sao chép báo cáo'), () => done('Trình duyệt chặn sao chép tự động'));
}

/* ---------- guideline (admin) ---------- */
// The team's guideline is guideline.json in the repo; edits here stay a draft on this browser until the file is pushed.
const toastMsg = (el, m) => { el.textContent = m; setTimeout(() => (el.textContent = ''), 4000); };
let shared = { palette: [], refs: [] }, guide = shared;
const ready = fetch('guideline.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((g) => { shared = g; }).catch(() => toastMsg($('gToast'), 'Không tải được guideline.json, đang dùng palette trống.'))
  .finally(() => { guide = store.get('svl-guide-draft', null) ?? structuredClone(shared); renderGuide(); });
const saveGuide = () => { if (!store.set('svl-guide-draft', guide)) toastMsg($('gToast'), 'Bộ nhớ trình duyệt đầy, hãy bớt ảnh mẫu hoặc tải file guideline về ngay.'); };
const refEmb = new Map();

function renderGuide() {
  $('gDraft').hidden = !store.get('svl-guide-draft', null);
  $('gSw').innerHTML = guide.palette.map((c, i) => `<div class="sw"><i style="background:${c.hex}"><button data-del="${i}" aria-label="Xoá ${esc(c.name)}">×</button></i><b>${esc(c.name)}</b><span>${c.hex}</span></div>`).join('');
  $('gRefs').innerHTML = guide.refs.map((r) => `<figure><img src="${r.url}" alt="Ảnh mẫu"><button data-ref="${r.id}" aria-label="Xoá ảnh mẫu">×</button></figure>`).join('') || '<p class="muted">Chưa có ảnh mẫu.</p>';
  $('gRefCount').textContent = `${guide.refs.length} ảnh · cập nhật ${shared.updated ?? '–'}`;
}
$('gSw').addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (!b) return; guide.palette.splice(+b.dataset.del, 1); saveGuide(); renderGuide(); });
$('gRefs').addEventListener('click', (e) => { const b = e.target.closest('[data-ref]'); if (!b) return; guide.refs = guide.refs.filter((r) => r.id !== b.dataset.ref); saveGuide(); renderGuide(); });
$('gAdd').addEventListener('click', () => {
  const hex = $('gHex').value.trim().toUpperCase().replace(/^([^#])/, '#$1');
  if (!/^#[0-9A-F]{6}$/.test(hex)) return toastMsg($('gToast'), 'Mã màu cần đúng dạng #RRGGBB, ví dụ #E4407B.');
  guide.palette.push({ name: $('gName').value.trim() || hex, hex }); $('gName').value = $('gHex').value = ''; saveGuide(); renderGuide();
});
const loadImg = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('Không đọc được ảnh')); i.src = src; });
const fileUrl = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
function shrink(img, max) { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; }
$('gRefFile').addEventListener('change', async (e) => {
  for (const f of e.target.files) { const img = await loadImg(await fileUrl(f)); guide.refs.push({ id: Math.random().toString(36).slice(2), url: shrink(img, 336).toDataURL('image/jpeg', 0.85) }); }
  e.target.value = ''; saveGuide(); renderGuide();
});
$('gExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ ...guide, updated: new Date().toISOString().slice(0, 10) }, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'guideline.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toastMsg($('gToast'), 'Đã tải guideline.json. Thay file cùng tên trong repo rồi push, sau đó bấm Bỏ nháp.');
});
$('gDiscard').addEventListener('click', () => { try { localStorage.removeItem('svl-guide-draft'); } catch {} guide = structuredClone(shared); renderGuide(); toastMsg($('gToast'), 'Đã quay về guideline đang áp dụng cho team.'); });

/* ---------- design ---------- */
let dFileObj = null;
$('dFile').addEventListener('change', (e) => pickDesign(e.target.files[0]));
$('dPlus').addEventListener('click', () => $('dFile').click());
async function pickDesign(f) {
  if (!f || !f.type.startsWith('image')) return;
  dFileObj = f; $('dDrop').firstChild.textContent = f.name;
  const img = await loadImg(await fileUrl(f));
  $('dPreview').src = img.src; $('dMediaCard').hidden = false;
  $('dMeta').innerHTML = [['Tên file', f.name], ['Kích thước', `${img.width} × ${img.height}`], ['Tỷ lệ', isVertical(img.width, img.height) ? '9:16' : (img.width / img.height).toFixed(2)]].map(([k, v]) => `<div><span>${k}</span>${esc(v)}</div>`).join('');
  checkDesign(img);
}

async function checkDesign(img) {
  await ready;
  const set = steps($('dSteps'), [['pal', 'So màu với palette'], ['style', 'So phong cách với ảnh mẫu'], ['ocr', 'Đọc chữ, độ tương phản, safe zone']]);
  const box = issueBox();
  $('dIssues').innerHTML = ''; $('dStyle').textContent = $('dCover').textContent = '–';

  set('pal', 'run');
  const small = shrink(img, 120), clusters = palette(small.getContext('2d').getImageData(0, 0, small.width, small.height));
  const pal = guide.palette.map((c) => ({ ...c, lab: rgb2lab(hex2rgb(c.hex)) }));
  let colored = 0, matched = 0;
  const rows = clusters.map((c) => {
    const neutral = chroma(c.lab) < 10;
    const near = pal.reduce((b, p) => { const d = deltaE(c.lab, p.lab); return d < b.d ? { d, p } : b; }, { d: Infinity, p: null });
    const ok = neutral || near.d < 15;
    if (!neutral) { colored += c.share; if (ok) matched += c.share; }
    return { ...c, neutral, near, ok };
  });
  $('dPalette').hidden = false;
  $('dSw').innerHTML = rows.map((r) => `<div class="sw ${r.ok ? '' : 'miss'}"><i style="background:${rgb2hex(r.rgb)}"></i><b>${rgb2hex(r.rgb)} · ${Math.round(r.share * 100)}%</b><span>${r.neutral ? 'Trung tính' : r.near.p ? `gần ${esc(r.near.p.name)} (ΔE ${Math.round(r.near.d)})` : ''}</span></div>`).join('');
  const cover = colored ? Math.round(matched / colored * 100) : 100;
  $('dCover').textContent = cover;
  const off = rows.filter((r) => !r.ok).map((r) => `${rgb2hex(r.rgb)} (${Math.round(r.share * 100)}%)`);
  if (cover < 40) box.add('pal', { sev: 'warn', name: `Chỉ ${cover}% màu nằm trong palette`, why: `Các màu lệch: ${off.join(', ')}. Ảnh không ăn khớp với bộ màu campaign.`, fix: 'Đổi các mảng màu lớn sang màu primary của phase.' });
  else if (cover < 70 || rows.some((r) => !r.ok && r.share >= 0.1)) box.add('pal', { sev: 'tip', name: `${cover}% màu nằm trong palette, có mảng màu lớn lệch`, why: `Các màu lệch: ${off.join(', ')}.`, fix: 'Kiểm tra lại các mảng màu này, ảnh chụp người thật có thể lệch do màu da.' });
  set('pal', 'done', `${cover}% khớp`);

  if (guide.refs.length) {
    set('style', 'run', 'Tải model…');
    try {
      const m = await clip(progressNote(set, 'style', 'Tải model'));
      const need = guide.refs.filter((r) => !refEmb.has(r.id));
      if (need.length) (await m.images(need.map((r) => r.url))).forEach((v, i) => refEmb.set(need[i].id, v));
      const [me] = await m.images([shrink(img, 448).toDataURL('image/jpeg', 0.9)]);
      const sims = guide.refs.map((r) => cos(me, refEmb.get(r.id))).sort((a, b) => b - a);
      const top = sims.slice(0, 3), avg = top.reduce((a, b) => a + b, 0) / top.length;
      // shortcut: CLIP cosine 0.60 ≈ unrelated, 0.90 ≈ same series; recalibrate once there are approved/rejected examples
      const score = Math.max(0, Math.min(100, Math.round((avg - 0.6) / 0.3 * 100)));
      $('dStyle').textContent = score; $('dRefNote').textContent = `So với ${guide.refs.length} ảnh mẫu, lấy trung bình 3 ảnh giống nhất.`;
      if (score < 50) box.add('style', { sev: 'warn', ai: true, name: `Phong cách khác ảnh mẫu (${score}/100)`, why: 'Bố cục, màu hoặc chất liệu hình khác xa các thiết kế đã duyệt.', fix: 'Đặt cạnh ảnh mẫu để so; kiểm tra màu nền, kiểu hình minh hoạ, nhân vật.' });
      else if (score < 70) box.add('style', { sev: 'tip', ai: true, name: `Phong cách khá gần ảnh mẫu (${score}/100)`, why: 'Có nét giống bộ ảnh mẫu nhưng chưa đồng bộ hẳn.' });
      set('style', 'done', `${score}/100`);
    } catch (e) { set('style', 'err', e.message); }
  } else { set('style', 'skip', 'Chưa có ảnh mẫu'); $('dRefNote').textContent = 'Vào Guideline thương hiệu để upload ảnh mẫu.'; }

  set('ocr', 'run', 'Tải model…');
  try {
    const big = shrink(img, 1440), data = big.getContext('2d').getImageData(0, 0, big.width, big.height);
    const lines = await readLines(big);
    for (const l of lines) {
      for (const h of scan(l.text)) box.add(h.rule.id, h.rule, { quote: { where: 'Chữ trên ảnh', text: l.text } });
      const ratio = boxContrast(data, l.bbox);
      if (ratio && ratio < 3) box.add('contrast', { sev: 'warn', name: 'Chữ khó đọc do tương phản thấp', why: 'Tương phản chữ và nền dưới 3:1 (ước tính). Chữ pastel trên nền pastel gần như không đọc được khi in hoặc xem ngoài trời.', fix: 'Dùng Tím than #2B2340 trên nền sáng, Kem #FFF6EC trên nền tối.' }, { quote: { where: `Tương phản ${ratio.toFixed(1)}:1`, text: l.text } });
      const zones = isVertical(img.width, img.height) ? outsideSafe(l.bbox, big.width, big.height) : [];
      if (zones.length) box.add('safezone', { sev: 'tip', name: 'Chữ nằm ngoài safe zone', why: 'Ảnh 9:16 đăng TikTok/Reels: chữ ở các vùng này bị giao diện che.', fix: 'Dời chữ vào khoảng giữa khung.' }, { quote: { where: zones.join(', '), text: l.text } });
    }
    set('ocr', 'done', `${lines.length} dòng chữ`);
  } catch (e) { set('ocr', 'err', e.message); }

  const list = box.list();
  renderVerdict($('dVerdict'), list);
  renderIssues($('dIssues'), list);
}
