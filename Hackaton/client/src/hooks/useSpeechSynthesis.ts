import { useCallback, useEffect, useRef, useState } from 'react';

/** Splitst tekst in zinnen van max. ~180 tekens; lange uitingen worden in Chrome soms afgekapt. */
export function chunkText(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      chunks.push(cur.trim());
      cur = '';
    }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function pickDutchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const nl = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('nl'));
  return nl.find((v) => /nl-nl/i.test(v.lang) && /google|natural|online/i.test(v.name)) ?? nl.find((v) => /nl-nl/i.test(v.lang)) ?? nl[0] ?? null;
}

export interface SynthesisState {
  supported: boolean;
  speaking: boolean;
  voiceName: string | null;
  /** false als er wel spraak is maar geen Nederlandse stem. */
  hasDutchVoice: boolean;
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
}

/** Tekst-naar-spraak met een Nederlandse stem van het besturingssysteem/de browser. */
export function useSpeechSynthesis(): SynthesisState {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        setVoice(pickDutchVoice(voices));
        setVoicesLoaded(true);
      }
    };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    const t = setTimeout(() => setVoicesLoaded(true), 1500);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load);
      clearTimeout(t);
    };
  }, [supported]);

  const cancel = useCallback(() => {
    generation.current++;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!supported || !voice) {
        onEnd?.();
        return;
      }
      const gen = ++generation.current;
      window.speechSynthesis.cancel();
      const chunks = chunkText(text);
      setSpeaking(true);
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = voice.lang;
        u.voice = voice;
        u.rate = 1.02;
        const last = i === chunks.length - 1;
        u.onend = () => {
          if (last && gen === generation.current) {
            setSpeaking(false);
            onEnd?.();
          }
        };
        u.onerror = (e) => {
          // 'interrupted'/'canceled' = bewust onderbroken door de student
          if (gen === generation.current && last) {
            setSpeaking(false);
            if (e.error !== 'interrupted' && e.error !== 'canceled') onEnd?.();
          }
        };
        window.speechSynthesis.speak(u);
      });
    },
    [supported, voice],
  );

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, speaking, voiceName: voice?.name ?? null, hasDutchVoice: !supported || !voicesLoaded || !!voice, speak, cancel };
}
