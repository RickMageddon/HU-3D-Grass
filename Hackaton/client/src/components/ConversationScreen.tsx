import { useCallback, useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { emptyProfile, initialState, TOPIC_IDS, type ChatResponse } from '../../../shared/types';
import type { Session } from '../App';
import { useLocalRecognition } from '../hooks/useLocalRecognition';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import type { SynthesisState } from '../hooks/useSpeechSynthesis';
import { api } from '../lib/api';
import { Icon } from './Icon';
import { MicButton, type MicStatus } from './MicButton';
import { TopicProgress } from './TopicProgress';
import { Transcript } from './Transcript';

interface Props {
  session: Session;
  setSession: Dispatch<SetStateAction<Session>>;
  voiceOn: boolean;
  setVoiceOn: (v: boolean) => void;
  /** Spraakherkenning via de eigen server (Whisper) in plaats van de browser. */
  localStt: boolean;
  tts: SynthesisState;
  onResults: () => void;
  onRestart: () => void;
}

export function ConversationScreen({ session, setSession, voiceOn, setVoiceOn, localStt, tts, onResults, onRestart }: Props) {
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [handsfree, setHandsfree] = useState(true);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const handsfreeRef = useRef(handsfree);
  handsfreeRef.current = handsfree;
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  const browserRec = useSpeechRecognition((text) => sendRef.current(text));
  const localRec = useLocalRecognition((text) => sendRef.current(text), localStt);
  const rec = localStt ? localRec : browserRec;
  const transcribing = localStt && localRec.transcribing;
  const canSpeak = voiceOn && tts.supported && tts.hasDutchVoice;
  const canListen = voiceOn && rec.supported;

  const afterReply = useCallback(
    (action: ChatResponse['action']) => {
      if (action === 'results') {
        setReady(true);
        return;
      }
      if (action === 'restart') return;
      if (canListen && handsfreeRef.current) rec.start();
      else inputRef.current?.focus({ preventScroll: true });
    },
    [canListen, rec],
  );

  const deliver = useCallback(
    (res: ChatResponse) => {
      const done = () => {
        afterReply(res.action);
        if (res.action === 'results' && canSpeak) onResults();
      };
      if (canSpeak) tts.speak(res.reply, done);
      else done();
    },
    [afterReply, canSpeak, onResults, tts],
  );

  const runTurn = useCallback(
    async (userText: string, base: Session) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setThinking(true);
      setError(null);
      setFailedText(null);
      try {
        const res = await api.chat({ history: base.messages, profile: base.profile, state: base.state, userText }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (res.action === 'restart') {
          restartConversation();
          return;
        }
        setSession((prev) => ({ messages: [...prev.messages, { role: 'assistant', text: res.reply }], profile: res.profile, state: res.state }));
        setNotice(res.notice ?? null);
        deliver(res);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        setFailedText(userText);
      } finally {
        if (abortRef.current === ctrl) setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deliver, setSession],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      tts.cancel();
      rec.abort();
      rec.clearError();
      const base = sessionRef.current;
      setSession({ ...base, messages: [...base.messages, { role: 'user', text }] });
      setDraft('');
      void runTurn(text, base);
    },
    [rec, runTurn, setSession, tts],
  );
  sendRef.current = send;

  const greet = useCallback(() => {
    const fresh: Session = { messages: [], profile: emptyProfile(), state: initialState() };
    setSession(fresh);
    setReady(false);
    void runTurn('', fresh);
  }, [runTurn, setSession]);

  function restartConversation() {
    tts.cancel();
    rec.abort();
    setError(null);
    setNotice(null);
    greet();
  }

  // Geen 'al gestart'-vlag: in StrictMode wordt het eerste verzoek in de cleanup
  // afgebroken en moet de tweede mount de opening opnieuw ophalen.
  useEffect(() => {
    if (sessionRef.current.messages.length === 0) greet();
    else inputRef.current?.focus();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape = onderbreek de assistent of stop met luisteren
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        tts.cancel();
        rec.abort();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rec, tts]);

  // Na een geweigerde microfoon niet steeds opnieuw automatisch proberen.
  useEffect(() => {
    if (rec.error && /microfoon|uitgeschakeld|ondersteund/i.test(rec.error)) setHandsfree(false);
  }, [rec.error]);

  const status: MicStatus = !canListen ? 'unsupported' : rec.listening ? 'listening' : thinking || transcribing ? 'thinking' : tts.speaking ? 'speaking' : 'idle';

  const onMic = () => {
    if (rec.listening) rec.stop();
    else {
      tts.cancel(); // onderbreken
      rec.clearError();
      rec.start();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const answered = TOPIC_IDS.filter((id) => session.profile.topics[id].status !== 'open').length;

  return (
    <section className="conversation" aria-labelledby="conv-title">
      <h1 id="conv-title" className="sr-only">
        Gesprek met de AI-assistent
      </h1>
      <TopicProgress profile={session.profile} current={session.state.currentTopic} />

      <div className="conv-panel">
        <Transcript messages={session.messages} thinking={thinking} />

        <div className="conv-status" aria-live="polite">
          {rec.listening && (
            <div className="recording" role="status">
              <span className="rec-dot" aria-hidden="true" />
              <span>
                <strong>Ik luister…</strong>{' '}
                {localStt ? <span className="muted">praat maar, ik stop vanzelf als je even stil bent</span> : rec.interim ? <q>{rec.interim}</q> : <span className="muted">praat maar</span>}
              </span>
              {localStt && (
                <span className="level" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.max(0.04, localRec.level)})` }} />
                </span>
              )}
            </div>
          )}
          {transcribing && (
            <div className="speaking" role="status">
              <span className="spinner spinner-small" aria-hidden="true" /> Ik zet je antwoord om naar tekst…
            </div>
          )}
          {tts.speaking && !rec.listening && (
            <div className="speaking" role="status">
              <Icon name="speaker" /> De assistent praat. Druk op de microfoon of Esc om te onderbreken.
            </div>
          )}
        </div>

        {(error || rec.error) && (
          <div className="notice notice-error" role="alert">
            <Icon name="warn" />
            <span>{error ?? rec.error}</span>
            {failedText && (
              <button type="button" className="btn btn-small" onClick={() => void runTurn(failedText, { ...sessionRef.current, messages: sessionRef.current.messages.slice(0, -1) })}>
                Opnieuw proberen
              </button>
            )}
          </div>
        )}
        {notice && (
          <p className="notice notice-info" role="status">
            <Icon name="info" /> {notice}
          </p>
        )}
        {voiceOn && !rec.supported && (
          <p className="notice notice-warn" role="status">
            <Icon name="warn" /> Spraakherkenning werkt niet in deze browser. Typ je antwoorden hieronder; de assistent kan wel blijven praten.
          </p>
        )}
        {voiceOn && tts.supported && !tts.hasDutchVoice && (
          <p className="notice notice-warn" role="status">
            <Icon name="warn" /> Er is geen Nederlandse stem op dit apparaat gevonden. De antwoorden worden alleen als tekst getoond.
          </p>
        )}

        {ready && (
          <div className="ready-card" role="status">
            <p>Ik heb genoeg informatie om minoren voor je te zoeken.</p>
            <button type="button" className="btn btn-primary" onClick={onResults}>
              Bekijk je aanbevelingen
            </button>
          </div>
        )}

        <div className="composer">
          {canListen && <MicButton status={status} onClick={onMic} disabled={thinking || transcribing} />}
          <form className="text-input" onSubmit={onSubmit}>
            <label htmlFor="answer" className="sr-only">
              Typ je antwoord
            </label>
            <input
              id="answer"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={canListen ? 'Of typ je antwoord…' : 'Typ je antwoord…'}
              autoComplete="off"
              maxLength={2000}
            />
            <button type="submit" className="btn btn-primary btn-icon" disabled={!draft.trim() || thinking} aria-label="Verstuur">
              <Icon name="send" />
            </button>
          </form>
        </div>

        <div className="conv-controls">
          <label className="toggle">
            <input
              type="checkbox"
              checked={voiceOn}
              onChange={(e) => {
                if (!e.target.checked) {
                  tts.cancel();
                  rec.abort();
                }
                setVoiceOn(e.target.checked);
              }}
            />
            <span>Spraak aan</span>
          </label>
          {canListen && (
            <label className="toggle">
              <input type="checkbox" checked={handsfree} onChange={(e) => setHandsfree(e.target.checked)} />
              <span>Automatisch luisteren na elke vraag</span>
            </label>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onResults} disabled={answered < 2}>
            Toon aanbevelingen{answered < 2 ? ' (beantwoord eerst 2 vragen)' : ''}
          </button>
          <button type="button" className="btn btn-ghost" onClick={restartConversation}>
            <Icon name="restart" /> Gesprek opnieuw
          </button>
          <button type="button" className="btn btn-ghost" onClick={onRestart}>
            Stoppen
          </button>
        </div>
      </div>
    </section>
  );
}
