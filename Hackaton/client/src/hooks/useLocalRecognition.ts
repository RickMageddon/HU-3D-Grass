import { useCallback, useEffect, useRef, useState } from 'react';
import { RECOGNITION_ERRORS, type RecognitionState } from './useSpeechRecognition';

/**
 * Spraakherkenning via de eigen server (Whisper). Neemt op met de microfoon, detecteert
 * zelf wanneer de student klaar is met praten (stilte), en stuurt de opname als WAV naar
 * /api/stt. Werkt in elke moderne browser, ook Chromium en Firefox.
 */

const TARGET_RATE = 16000;
/** Stilte na spraak waarna de opname stopt. */
const END_SILENCE_MS = 1300;
const NO_SPEECH_MS = 8000;
const MAX_MS = 30000;

export function encodeWav16k(chunks: Float32Array[], inputRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    merged.set(c, o);
    o += c.length;
  }
  const ratio = inputRate / TARGET_RATE;
  const n = Math.floor(merged.length / ratio);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (off: number, s: string) => [...s].forEach((ch, i) => v.setUint8(off + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, TARGET_RATE, true);
  v.setUint32(28, TARGET_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const j = Math.floor(x);
    const f = x - j;
    const s = Math.max(-1, Math.min(1, merged[j] * (1 - f) + (merged[j + 1] ?? merged[j]) * f));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

interface Session {
  stream: MediaStream;
  ctx: AudioContext;
  node: ScriptProcessorNode;
  chunks: Float32Array[];
  startedAt: number;
  speechAt: number | null;
  lastVoiceAt: number;
  noiseFloor: number;
  frames: number;
  loudFrames: number;
  done: boolean;
}

export function useLocalRecognition(onFinal: (text: string) => void, enabled: boolean): RecognitionState & { level: number; transcribing: boolean } {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const fetchRef = useRef<AbortController | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const supported = enabled && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== 'undefined';

  const teardown = useCallback((s: Session) => {
    s.done = true;
    s.node.onaudioprocess = null;
    s.node.disconnect();
    s.stream.getTracks().forEach((t) => t.stop());
    void s.ctx.close().catch(() => undefined);
    if (sessionRef.current === s) sessionRef.current = null;
    setListening(false);
    setLevel(0);
  }, []);

  const finish = useCallback(
    async (s: Session, process: boolean) => {
      if (s.done) return;
      teardown(s);
      if (!process) return;
      if (s.speechAt === null) {
        setError(RECOGNITION_ERRORS['no-speech']);
        return;
      }
      const wav = encodeWav16k(s.chunks, s.ctx.sampleRate);
      const ctrl = new AbortController();
      fetchRef.current = ctrl;
      setTranscribing(true);
      setInterim('Even verwerken…');
      try {
        const res = await fetch('/api/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal: ctrl.signal });
        const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) throw new Error(body.error ?? `Spraakherkenning gaf een fout (HTTP ${res.status}).`);
        const text = (body.text ?? '').trim();
        if (text) onFinalRef.current(text);
        else setError('Ik verstond je niet goed. Probeer het nog eens, iets dichter bij de microfoon, of typ je antwoord.');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError((err as Error).message.includes('fetch') ? 'De server is niet bereikbaar voor spraakherkenning. Typ je antwoord.' : (err as Error).message);
      } finally {
        if (fetchRef.current === ctrl) fetchRef.current = null;
        setTranscribing(false);
        setInterim('');
      }
    },
    [teardown],
  );

  const start = useCallback(async () => {
    if (!supported) {
      setError('Opnemen wordt niet ondersteund in deze browser. Typ je antwoord.');
      return;
    }
    if (sessionRef.current || fetchRef.current) return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      const name = (err as Error).name;
      setError(name === 'NotAllowedError' || name === 'SecurityError' ? RECOGNITION_ERRORS['not-allowed'] : name === 'NotFoundError' || name === 'NotReadableError' ? RECOGNITION_ERRORS['audio-capture'] : 'De microfoon kon niet worden gestart. Probeer het opnieuw of typ je antwoord.');
      return;
    }
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    // ScriptProcessor is verouderd maar werkt in alle browsers zonder extra worklet-bestand.
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const now = performance.now();
    const s: Session = { stream, ctx, node, chunks: [], startedAt: now, speechAt: null, lastVoiceAt: now, noiseFloor: 0.005, frames: 0, loudFrames: 0, done: false };
    sessionRef.current = s;
    let lastLevelUpdate = 0;
    node.onaudioprocess = (e) => {
      if (s.done) return;
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      s.chunks.push(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const t = performance.now();
      s.frames++;
      // Ruisniveau schatten in de eerste ~0,4 s, daarna langzaam bijstellen tijdens stilte.
      if (s.frames <= 4) s.noiseFloor = Math.max(s.noiseFloor, rms);
      const threshold = Math.max(0.012, s.noiseFloor * 2.5);
      if (rms > threshold) {
        s.loudFrames++;
        s.lastVoiceAt = t;
        if (s.loudFrames >= 2 && s.speechAt === null) s.speechAt = t;
      } else {
        s.loudFrames = 0;
        if (s.speechAt === null) s.noiseFloor = s.noiseFloor * 0.95 + rms * 0.05;
      }
      if (t - lastLevelUpdate > 80) {
        lastLevelUpdate = t;
        setLevel(Math.min(1, rms / 0.12));
      }
      if (s.speechAt !== null && t - s.lastVoiceAt > END_SILENCE_MS) void finish(s, true);
      else if (s.speechAt === null && t - s.startedAt > NO_SPEECH_MS) void finish(s, true);
      else if (t - s.startedAt > MAX_MS) void finish(s, true);
    };
    src.connect(node);
    node.connect(ctx.destination);
    setListening(true);
  }, [finish, supported]);

  const stop = useCallback(() => {
    const s = sessionRef.current;
    if (s) void finish(s, true);
  }, [finish]);

  const abort = useCallback(() => {
    const s = sessionRef.current;
    if (s) void finish(s, false);
    fetchRef.current?.abort();
  }, [finish]);

  useEffect(
    () => () => {
      const s = sessionRef.current;
      if (s) teardown(s);
      fetchRef.current?.abort();
    },
    [teardown],
  );

  return {
    supported,
    listening,
    interim,
    error,
    level,
    transcribing,
    start: () => void start(),
    stop,
    abort,
    clearError: () => setError(null),
  };
}
