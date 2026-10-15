import { useCallback, useEffect, useRef, useState } from 'react';
import { chunkText, type SynthesisState } from './useSpeechSynthesis';

/**
 * Voorlezen met de Nederlandse Piper-stem van de eigen server (/api/tts).
 * Zinnen worden los opgehaald; de volgende zin wordt al gemaakt terwijl de vorige speelt.
 */
export function useLocalSynthesis(enabled: boolean, voiceName: string | null): SynthesisState {
  const [speaking, setSpeaking] = useState(false);
  const generation = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  const cleanup = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
  }, []);

  const cancel = useCallback(() => {
    generation.current++;
    cleanup();
    setSpeaking(false);
  }, [cleanup]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      cleanup();
      const gen = ++generation.current;
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      const chunks = chunkText(text);
      const fetchChunk = (t: string) =>
        fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }), signal: ctrl.signal }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        });
      const done = () => {
        if (gen !== generation.current) return;
        setSpeaking(false);
        onEnd?.();
      };
      setSpeaking(true);
      let pending = fetchChunk(chunks[0]);
      const playNext = async (i: number) => {
        try {
          const blob = await pending;
          if (gen !== generation.current) return;
          if (i + 1 < chunks.length) pending = fetchChunk(chunks[i + 1]);
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => (i + 1 < chunks.length ? void playNext(i + 1) : done());
          await audio.play();
        } catch (err) {
          // Afgebroken of afspelen geblokkeerd: tekst staat er al, dus gewoon doorgaan.
          if ((err as Error).name !== 'AbortError') done();
        }
      };
      void playNext(0);
    },
    [cleanup],
  );

  useEffect(() => cleanup, [cleanup]);

  return { supported: enabled, speaking, voiceName, hasDutchVoice: true, speak, cancel };
}
