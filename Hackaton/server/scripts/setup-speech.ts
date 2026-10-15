// Installeert lokale, open-source spraak: Piper (Nederlandse stem) en Whisper (herkenning).
// Gebruik: npm run setup:speech      (eenmalig, ~400 MB download)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadStt } from '../src/speech/stt.js';
import { MODELS_DIR, PIPER_BIN, PIPER_VOICE, SPEECH_DIR, STT_MODEL, VOICES_DIR, voicePath } from '../src/speech/paths.js';
import { synthesize } from '../src/speech/tts.js';

const PIPER_URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz';
const VOICES_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

async function download(url: string, dest: string) {
  if (fs.existsSync(dest)) return console.log(`  ✓ ${path.relative(SPEECH_DIR, dest)} (al aanwezig)`);
  console.log(`  ↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download mislukt (${res.status}): ${url}`);
  fs.writeFileSync(dest + '.part', Buffer.from(await res.arrayBuffer()));
  fs.renameSync(dest + '.part', dest);
}

function voiceUrl(voice: string): string {
  // nl_NL-pim-medium → nl/nl_NL/pim/medium/nl_NL-pim-medium.onnx
  const [locale, name, quality] = voice.split('-');
  return `${VOICES_URL}/${locale.split('_')[0]}/${locale}/${name}/${quality}/${voice}.onnx`;
}

fs.mkdirSync(VOICES_DIR, { recursive: true });
fs.mkdirSync(MODELS_DIR, { recursive: true });

console.log('1/3 Piper (tekst-naar-spraak)');
if (process.platform !== 'linux' || process.arch !== 'x64') {
  console.log(`  ! Automatische installatie ondersteunt alleen Linux x64. Download Piper zelf van https://github.com/rhasspy/piper/releases en zet de map op ${path.dirname(PIPER_BIN)}.`);
} else if (!fs.existsSync(PIPER_BIN)) {
  const tgz = path.join(SPEECH_DIR, 'piper.tar.gz');
  await download(PIPER_URL, tgz);
  execFileSync('tar', ['xzf', tgz, '-C', SPEECH_DIR]);
  fs.rmSync(tgz);
  console.log('  ✓ piper uitgepakt');
} else console.log('  ✓ piper (al aanwezig)');

console.log(`2/3 Nederlandse stem: ${PIPER_VOICE}`);
await download(voiceUrl(PIPER_VOICE), voicePath());
await download(voiceUrl(PIPER_VOICE) + '.json', voicePath() + '.json');
const wav = await synthesize('Hallo, de Nederlandse stem werkt.');
console.log(`  ✓ testzin uitgesproken (${Math.round(wav.length / 1024)} kB audio)`);

console.log(`3/3 Whisper-model voor spraakherkenning: ${STT_MODEL}`);
await loadStt(true);
console.log('  ✓ model geladen');

console.log(`\nKlaar. Lokale spraak staat in ${SPEECH_DIR}. Herstart de server (npm run dev).`);
