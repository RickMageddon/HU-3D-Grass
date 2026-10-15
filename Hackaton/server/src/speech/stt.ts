// Lokale Nederlandse spraakherkenning met Whisper (open source) via transformers.js.
// Audio wordt alleen in het geheugen verwerkt en nooit opgeslagen of gelogd.

import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { MODELS_DIR, STT_MODEL } from './paths.js';
import { decodeWav, resample } from './wav.js';

env.cacheDir = MODELS_DIR;
env.localModelPath = MODELS_DIR;

let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let ready = false;

export function sttReady(): boolean {
  return ready;
}

/** Laadt het model (en downloadt het de eerste keer). Veilig om vaker aan te roepen. */
export function loadStt(allowDownload = false): Promise<AutomaticSpeechRecognitionPipeline> {
  env.allowRemoteModels = allowDownload;
  loading ??= (pipeline('automatic-speech-recognition', STT_MODEL, { dtype: 'q8' }) as Promise<AutomaticSpeechRecognitionPipeline>).then(
    (p) => {
      ready = true;
      return p;
    },
    (err) => {
      loading = null;
      throw err;
    },
  );
  return loading;
}

/** Bekende "hallucinaties" van Whisper bij stilte of ruis. */
const HALLUCINATIONS = /ondertitel|ondertiteling|subtitles?|amara\.org|bedankt voor het (kijken|luisteren)|thanks for watching|tv gelderland|www\.|^\W*$/i;

export function cleanTranscript(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (HALLUCINATIONS.test(t)) return '';
  return t;
}

let queue: Promise<unknown> = Promise.resolve();

export async function transcribe(wav: Buffer): Promise<string> {
  const { samples, sampleRate } = decodeWav(wav);
  const audio = resample(samples, sampleRate, 16000);
  if (audio.length < 16000 * 0.3) return '';
  if (audio.length > 16000 * 60) throw new Error('Opname is te lang (maximaal 60 seconden).');
  const asr = await loadStt();
  // Eén herkenning tegelijk: voorkomt dat de CPU overbelast raakt.
  const run = queue.then(() => asr(audio, { language: 'dutch', task: 'transcribe' }));
  queue = run.catch(() => undefined);
  const result = (await run) as { text: string } | Array<{ text: string }>;
  return cleanTranscript(Array.isArray(result) ? result.map((r) => r.text).join(' ') : result.text);
}
