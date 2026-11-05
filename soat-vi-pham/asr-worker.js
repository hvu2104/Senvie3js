// Runs Whisper off the main thread: whisper-small takes ~4x real time in wasm and would freeze the page.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
env.allowLocalModels = false;
let pipe;
self.onmessage = async ({ data: { id, audio, opts } }) => {
  try {
    pipe ??= await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', { quantized: true, progress_callback: (p) => self.postMessage({ id, progress: p }) });
    self.postMessage({ id, out: await pipe(audio, opts) });
  } catch (e) { pipe = null; self.postMessage({ id, error: e.message }); }
};
