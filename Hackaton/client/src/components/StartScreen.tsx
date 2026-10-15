import type { StatusResponse } from '../../../shared/types';
import { getRecognitionCtor } from '../hooks/useSpeechRecognition';
import { Icon } from './Icon';

interface Props {
  status: StatusResponse | null;
  statusError: string | null;
  onStart: (withVoice: boolean) => void;
}

export function StartScreen({ status, statusError, onStart }: Props) {
  const localSpeech = !!status?.speech?.stt;
  const speechSupported = localSpeech || getRecognitionCtor() !== null;
  const count = status?.dataset.count ?? 0;

  return (
    <section className="start" aria-labelledby="start-title">
      <div className="start-hero">
        <p className="eyebrow">Voor hbo-studenten</p>
        <h1 id="start-title">Vind de minor die bij jou past</h1>
        <p className="lead">
          Vertel in een kort gesprek wat je leuk vindt, wat je hebt gedaan en waar je naartoe wilt. Je krijgt een lijst met
          minoren uit Kies op Maat, gerangschikt van beste naar minder goede match, met uitleg waarom.
        </p>
        <div className="start-actions">
          <button type="button" className="btn btn-primary btn-xl" onClick={() => onStart(true)}>
            <Icon name="mic" /> Start spraakgesprek
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onStart(false)}>
            <Icon name="keyboard" /> Liever typen
          </button>
        </div>
        {!speechSupported && (
          <p className="notice notice-warn" role="status">
            <Icon name="warn" /> Deze browser ondersteunt geen spraakherkenning. Je kunt het gesprek wel typen. Voor spraak:
            gebruik Chrome, Edge of Safari.
          </p>
        )}
        {statusError && (
          <p className="notice notice-error" role="alert">
            <Icon name="warn" /> {statusError}
          </p>
        )}
        {status && count === 0 && (
          <p className="notice notice-warn" role="status">
            <Icon name="warn" /> Er zijn nog geen minorgegevens geïmporteerd. Je kunt het gesprek voeren, maar er komen pas
            aanbevelingen als de beheerder gegevens van Kies op Maat heeft geïmporteerd.{' '}
            <a href="/opslaan.html">Zo sla je de pagina's op</a>.
          </p>
        )}
      </div>

      <div className="start-info">
        <article className="info-card">
          <h2>Je praat met een AI</h2>
          <p>
            De gesprekspartner is een AI-assistent, geen mens. De assistent stelt vragen; welke minoren passen wordt daarna
            berekend uit echte gegevens van Kies op Maat. Er worden geen minoren verzonnen.
          </p>
        </article>
        <article className="info-card">
          <h2>Privacy</h2>
          <ul>
            <li>Je gesprek wordt niet opgeslagen: niet op de server en niet in je browser. Sluit of herlaad je de pagina, dan is het weg.</li>
            <li>We vragen alleen naar je interesses, opleiding, ervaring en plannen. Je naam of contactgegevens zijn niet nodig.</li>
            {localSpeech ? (
              <li>Je stem wordt op de server van deze app omgezet naar tekst (Whisper) en daarna meteen weggegooid. Er gaat geen audio naar Google of andere diensten.</li>
            ) : (
              <li>
                Let op: de spraakherkenning van Chrome en Edge stuurt je stem naar de spraakdienst van Google of Microsoft. Wil je dat
                niet, kies dan voor typen.
              </li>
            )}
            {status?.llm.configured && (
              <li>Je getypte of herkende tekst wordt voor het gesprek naar een AI-taalmodel gestuurd ({status.llm.provider}), niet opgeslagen door deze app.</li>
            )}
          </ul>
        </article>
        <article className="info-card">
          <h2>Gegevens</h2>
          <p>
            {status
              ? count > 0
                ? `${count} minoren uit Kies op Maat beschikbaar${status.dataset.newestRetrievedAt ? `, opgehaald op ${new Date(status.dataset.newestRetrievedAt).toLocaleDateString('nl-NL')}` : ''}.`
                : 'Nog geen minorgegevens beschikbaar.'
              : 'Gegevens laden…'}{' '}
            Gesprek: {status ? (status.llm.configured ? `AI-taalmodel (${status.llm.model})` : 'ingebouwde gespreksleider (geen extern taalmodel)') : '…'}.
            {status && ` Spraak: ${localSpeech ? 'lokaal (Whisper en Piper)' : 'via de browser'}.`}
          </p>
        </article>
      </div>
    </section>
  );
}
