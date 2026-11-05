// Lazy loaders for the in-browser models. Each loads once and is cached by the browser afterwards.
const TF_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const CLIP_ID = 'Xenova/clip-vit-base-patch32';

let tfP, tessP, clipP;
// a failed download must not stay cached, so the next run retries
const retry = (p, reset) => p.catch((e) => { reset(); throw e; });
const tf = () => tfP ??= import(TF_URL).then((m) => { m.env.allowLocalModels = false; return m; });
const script = (src) => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Không tải được ' + src)); document.head.append(s); });

export function ocr() {
  return tessP ??= retry(script(TESS_URL).then(() => window.Tesseract.createWorker('vie+eng')), () => (tessP = null));
}

const rows = (t) => {
  const [n, d] = t.dims, out = [];
  for (let i = 0; i < n; i++) {
    const v = t.data.slice(i * d, (i + 1) * d), len = Math.hypot(...v);
    out.push(v.map((x) => x / len));
  }
  return out;
};
export const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

export function clip(onProgress) {
  return clipP ??= retry(tf().then(async (m) => {
    // fresh options per call: from_pretrained writes the model file name into the object it is given
    const o = () => ({ quantized: true, progress_callback: onProgress });
    // sequential: parallel downloads from the HF CDN intermittently failed with "Failed to fetch"
    const tok = await m.AutoTokenizer.from_pretrained(CLIP_ID, o()), proc = await m.AutoProcessor.from_pretrained(CLIP_ID, o());
    const text = await m.CLIPTextModelWithProjection.from_pretrained(CLIP_ID, o()), vision = await m.CLIPVisionModelWithProjection.from_pretrained(CLIP_ID, o());
    return {
      async images(urls) {
        const out = [];
        for (let i = 0; i < urls.length; i += 4) {
          const imgs = await Promise.all(urls.slice(i, i + 4).map((u) => m.RawImage.read(u)));
          out.push(...rows((await vision(await proc(imgs))).image_embeds));
        }
        return out;
      },
      async texts(list) { return rows((await text(tok(list, { padding: true, truncation: true }))).text_embeds); },
    };
  }), () => (clipP = null));
}

// Returns transcribe(audio, opts) backed by asr-worker.js; the worker keeps the model loaded between runs.
let worker, seq = 0;
export async function asr(onProgress) {
  worker ??= new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
  return (audio, opts) => new Promise((ok, fail) => {
    const id = ++seq;
    const on = ({ data }) => {
      if (data.id !== id) return;
      if (data.progress) return onProgress?.(data.progress);
      worker.removeEventListener('message', on);
      data.error ? fail(new Error(data.error)) : ok(data.out);
    };
    worker.addEventListener('message', on);
    worker.postMessage({ id, audio, opts });
  });
}
