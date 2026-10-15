import { useCallback, useEffect, useState } from 'react';
import { emptyProfile, initialState, type ChatMessage, type ConversationState, type ScoringMethod, type StatusResponse, type StudentProfile } from '../../shared/types';
import { ConversationScreen } from './components/ConversationScreen';
import { Header } from './components/Header';
import { MethodDialog } from './components/MethodDialog';
import { ResultsScreen } from './components/ResultsScreen';
import { StartScreen } from './components/StartScreen';
import { useLocalSynthesis } from './hooks/useLocalSynthesis';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { api } from './lib/api';

type Screen = 'start' | 'gesprek' | 'resultaten';

export interface Session {
  messages: ChatMessage[];
  profile: StudentProfile;
  state: ConversationState;
}

const newSession = (): Session => ({ messages: [], profile: emptyProfile(), state: initialState() });

/**
 * Alle gespreksgegevens leven alleen in het geheugen van dit tabblad. Er wordt
 * niets in localStorage, cookies of op de server opgeslagen; herladen = weg.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [session, setSession] = useState<Session>(newSession);
  const [sessionKey, setSessionKey] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const [method, setMethod] = useState<ScoringMethod | undefined>();
  const browserTts = useSpeechSynthesis();
  const localTts = useLocalSynthesis(!!status?.speech?.tts, status?.speech?.voice ?? null);
  // Lokale Piper-stem (server) heeft voorrang; anders de stem van de browser.
  const tts = status?.speech?.tts ? localTts : browserTts;

  useEffect(() => {
    api.status().then(setStatus, (e: Error) => setStatusError(e.message));
  }, []);

  const restart = useCallback(() => {
    tts.cancel();
    setSession(newSession());
    setSessionKey((k) => k + 1);
    setScreen('start');
    window.scrollTo({ top: 0 });
  }, [tts]);

  const start = (withVoice: boolean) => {
    setVoiceOn(withVoice);
    setSession(newSession());
    setSessionKey((k) => k + 1);
    setScreen('gesprek');
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Naar de inhoud
      </a>
      <Header onRestart={screen === 'start' ? undefined : restart} onMethod={() => setShowMethod(true)} />
      <main id="main" className="main">
        {screen === 'start' && <StartScreen status={status} statusError={statusError} onStart={start} />}
        {screen === 'gesprek' && (
          <ConversationScreen
            key={sessionKey}
            session={session}
            setSession={setSession}
            voiceOn={voiceOn}
            setVoiceOn={setVoiceOn}
            localStt={!!status?.speech?.stt}
            tts={tts}
            onResults={() => setScreen('resultaten')}
            onRestart={restart}
          />
        )}
        {screen === 'resultaten' && (
          <ResultsScreen
            profile={session.profile}
            voiceOn={voiceOn}
            tts={tts}
            onBack={() => setScreen('gesprek')}
            onRestart={restart}
            onMethod={() => setShowMethod(true)}
            onMethodLoaded={setMethod}
          />
        )}
      </main>
      <footer className="footer">
        <p>
          Minoren in de buurt is een AI-hulpmiddel en geeft geen bindend studieadvies. Minorgegevens komen van{' '}
          <a href="https://www.kiesopmaat.nl/modules/" target="_blank" rel="noopener noreferrer">
            Kies op Maat
          </a>
          ; controleer altijd de officiële pagina en overleg met je studieadviseur.
        </p>
      </footer>
      {showMethod && <MethodDialog method={method} onClose={() => setShowMethod(false)} />}
    </div>
  );
}
