import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Map met lokale spraakbestanden (Piper-binary, stemmen, Whisper-model). Staat in .gitignore. */
export const SPEECH_DIR = path.resolve(process.env.SPEECH_DIR ?? path.join(here, '../../speech'));
export const PIPER_BIN = path.join(SPEECH_DIR, 'piper', 'piper');
export const VOICES_DIR = path.join(SPEECH_DIR, 'voices');
export const MODELS_DIR = path.join(SPEECH_DIR, 'models');

export const PIPER_VOICE = process.env.PIPER_VOICE ?? 'nl_NL-pim-medium';
/** Spreektempo van de stem (1 = normaal). */
export const PIPER_SPEED = Math.min(1.6, Math.max(0.6, Number(process.env.PIPER_SPEED ?? 1.12)));
export const STT_MODEL = process.env.STT_MODEL ?? 'onnx-community/whisper-small';

export const voicePath = (voice = PIPER_VOICE) => path.join(VOICES_DIR, `${voice}.onnx`);

/** 'auto' = gebruik lokale spraak als de bestanden aanwezig zijn; 'off' = altijd de browser. */
export const LOCAL_SPEECH = (process.env.LOCAL_SPEECH ?? 'auto').toLowerCase() !== 'off';

export function ttsInstalled(): boolean {
  return LOCAL_SPEECH && fs.existsSync(PIPER_BIN) && fs.existsSync(voicePath()) && fs.existsSync(voicePath() + '.json');
}

export function sttInstalled(): boolean {
  return LOCAL_SPEECH && fs.existsSync(path.join(MODELS_DIR, STT_MODEL));
}
