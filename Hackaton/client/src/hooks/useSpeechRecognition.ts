import { useCallback, useEffect, useRef, useState } from 'react';

// Minimale typen voor de Web Speech API (nog niet in de standaard DOM-typen).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const RECOGNITION_ERRORS: Record<string, string> = {
  'not-allowed': 'Je browser geeft geen toegang tot de microfoon. Sta microfoongebruik toe via het slotje in de adresbalk, of typ je antwoord.',
  'service-not-allowed': 'Spraakherkenning is in deze browser uitgeschakeld. Typ je antwoord of gebruik Chrome of Edge.',
  'no-speech': 'Ik hoorde niets. Druk op de microfoon en probeer het nog eens, of typ je antwoord.',
  'audio-capture': 'Er is geen werkende microfoon gevonden. Controleer je microfoon of typ je antwoord.',
  network: 'Spraakherkenning lukt niet: de spraakdienst van deze browser is niet bereikbaar. Chromium en sommige andere browsers hebben die dienst niet; gebruik Chrome of Edge, laat lokale spraak installeren (npm run setup:speech), of typ je antwoord.',
  'language-not-supported': 'Nederlandse spraakherkenning wordt in deze browser niet ondersteund. Typ je antwoord.',
  aborted: '',
};

export interface RecognitionState {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
  clearError: () => void;
}

/** Nederlandse spraakherkenning. Roept onFinal aan met de herkende zin zodra de student stopt met praten. */
export function useSpeechRecognition(onFinal: (text: string) => void, lang = 'nl-NL'): RecognitionState {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const interimRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Spraakherkenning wordt niet ondersteund in deze browser. Gebruik Chrome, Edge of Safari, of typ je antwoord.');
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    finalRef.current = '';
    interimRef.current = '';
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let fin = '';
      let tmp = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else tmp += r[0].transcript;
      }
      finalRef.current = fin;
      interimRef.current = tmp;
      setInterim((fin + ' ' + tmp).trim());
    };
    rec.onerror = (e) => {
      const msg = RECOGNITION_ERRORS[e.error] ?? `Spraakherkenning gaf een fout (${e.error}). Probeer het opnieuw of typ je antwoord.`;
      if (msg) setError(msg);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      if (recRef.current !== rec) return;
      recRef.current = null;
      const text = (finalRef.current || interimRef.current).trim();
      if (text) onFinalRef.current(text);
    };
    recRef.current = rec;
    setError(null);
    try {
      rec.start();
    } catch {
      setError('De microfoon kon niet worden gestart. Probeer het opnieuw of typ je antwoord.');
      recRef.current = null;
    }
  }, [lang]);

  /** Stop met luisteren en verwerk wat er tot nu toe gezegd is. */
  const stop = useCallback(() => recRef.current?.stop(), []);

  /** Stop met luisteren en gooi de opname weg. */
  const abort = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop, abort, clearError: () => setError(null) };
}
