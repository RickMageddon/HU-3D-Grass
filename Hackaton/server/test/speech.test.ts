import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { buildCorpus } from '../src/match/score.js';
import { datasetInfo } from '../src/minors/store.js';
import { sttInstalled, ttsInstalled } from '../src/speech/paths.js';
import { cleanTranscript, transcribe } from '../src/speech/stt.js';
import { speakable, synthesize } from '../src/speech/tts.js';
import { decodeWav, encodeWav, resample } from '../src/speech/wav.js';

describe('WAV-hulpfuncties', () => {
  it('codeert en decodeert PCM16 zonder verlies van lengte', () => {
    const pcm = Buffer.alloc(16000 * 2);
    for (let i = 0; i < 16000; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 10) * 10000), i * 2);
    const { samples, sampleRate } = decodeWav(encodeWav(pcm, 16000));
    expect(sampleRate).toBe(16000);
    expect(samples.length).toBe(16000);
    expect(resample(samples, 16000, 8000).length).toBe(8000);
  });
  it('weigert geen-WAV', () => {
    expect(() => decodeWav(Buffer.from('x'.repeat(100)))).toThrow(/WAV/);
  });
  it('filtert bekende Whisper-hallucinaties bij stilte', () => {
    expect(cleanTranscript(' Ondertiteling door de Amara.org gemeenschap')).toBe('');
    expect(cleanTranscript(' Ik hou van sport. ')).toBe('Ik hou van sport.');
  });
  it('maakt tekst voorleesbaar', () => {
    expect(speakable('**[TEST] Game Design**\nis leuk')).toBe('Game Design is leuk');
  });
});

describe.runIf(sttInstalled() && ttsInstalled())('lokale spraak (Piper → Whisper)', () => {
  it(
    'herkent een door Piper uitgesproken Nederlandse zin',
    async () => {
      const wav = await synthesize('Ik studeer verpleegkunde en ik wil later in de zorg werken.');
      const text = (await transcribe(wav)).toLowerCase();
      expect(text).toMatch(/verpleegkunde/);
      expect(text).toMatch(/zorg/);
    },
    120_000,
  );

  it(
    'API: /api/tts geeft WAV en /api/stt geeft tekst',
    async () => {
      const server = createApp({ minors: [], corpus: buildCorpus([]), info: datasetInfo([]), file: 'test' }).listen(0);
      await new Promise((r) => server.once('listening', r));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      try {
        const status = await (await fetch(base + '/api/status')).json();
        expect(status.speech).toMatchObject({ stt: true, tts: true });
        const tts = await fetch(base + '/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Ik hou van muziek en games.' }) });
        expect(tts.headers.get('content-type')).toBe('audio/wav');
        const wav = Buffer.from(await tts.arrayBuffer());
        const stt = await fetch(base + '/api/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav });
        const { text } = (await stt.json()) as { text: string };
        expect(text.toLowerCase()).toMatch(/muziek/);
      } finally {
        server.close();
      }
    },
    120_000,
  );
});
