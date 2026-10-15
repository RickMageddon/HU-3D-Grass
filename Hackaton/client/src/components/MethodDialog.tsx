import { useEffect, useRef } from 'react';
import { TOPIC_IDS, TOPIC_LABELS, type ScoringMethod } from '../../../shared/types';
import { Icon } from './Icon';

/** Standaardwaarden, gelijk aan server/src/match/score.ts; worden overschreven door de waarden uit de API. */
export const DEFAULT_METHOD: ScoringMethod = {
  topicWeights: { interesses: 0.22, opleiding: 0.1, vakken: 0.12, werkervaring: 0.08, ambities: 0.22, voorkeuren: 0.26 },
  fieldWeights: { titel: 3, beschrijving: 1 },
  conceptFactor: 0.8,
  saturation: 2.5,
  relevanceThreshold: 25,
  avoidPenalty: 0.5,
};

export function MethodDialog({ onClose, method = DEFAULT_METHOD }: { onClose: () => void; method?: ScoringMethod }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="method-title" onClose={onClose} onCancel={onClose}>
      <div className="dialog-head">
        <h2 id="method-title">Hoe werken de aanbevelingen?</h2>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Sluiten">
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body prose">
        <h3>1. Het gesprek</h3>
        <p>
          Een AI-assistent stelt je vragen over zes onderwerpen. Is er geen AI-taalmodel ingesteld, dan doet een ingebouwde
          gespreksleider dat met vaste regels. De assistent beveelt zelf geen minoren aan.
        </p>
        <h3>2. De gegevens</h3>
        <p>
          De minoren komen uit pagina's van <a href="https://www.kiesopmaat.nl/modules/" target="_blank" rel="noopener noreferrer">Kies op Maat</a>. Er wordt
          niets aangevuld of verzonnen. Wat ontbreekt, staat als <span className="unknown">onbekend</span> in de lijst.
        </p>
        <h3>3. Matchscore (0–100)</h3>
        <p>
          Voor elk onderwerp zoeken we de woorden die jij gebruikte in de titel en de beschrijving van de minor. We kijken ook
          naar verwante thema's, zodat bijvoorbeeld "programmeren" ook "software" vindt.
        </p>
        <ul>
          <li>
            Een woord in de titel telt {method.fieldWeights.titel}× zo zwaar als een woord in de beschrijving. Een verwant thema
            telt {method.conceptFactor}× zo zwaar als hetzelfde woord. Zeldzame woorden tellen zwaarder dan woorden die in bijna
            elke minor staan.
          </li>
          <li>
            Per onderwerp maken we daar een score van 0 tot 1 van: <code>1 − e^(−punten / {method.saturation})</code>. Een paar
            sterke overeenkomsten tellen dus veel, nog meer overeenkomsten voegen steeds minder toe.
          </li>
          <li>
            De matchscore is het gewogen gemiddelde over de onderwerpen die je hebt beantwoord:
            <ul>
              {TOPIC_IDS.map((id) => (
                <li key={id}>
                  {TOPIC_LABELS[id]}: {Math.round(method.topicWeights[id] * 100)}%
                </li>
              ))}
            </ul>
          </li>
          <li>
            Bevat een minor iets wat je liever niet wilt, dan wordt de score met {Math.round((1 - method.avoidPenalty) * 100)}%
            verlaagd.
          </li>
          <li>
            Een minor telt als relevant vanaf een matchscore van {method.relevanceThreshold}, en alleen als er een overeenkomst is
            met meer dan alleen je opleiding. Er is geen maximum aantal: alle relevante minoren worden getoond.
          </li>
        </ul>
        <h3>4. Informatiezekerheid (0–100)</h3>
        <p>Hiermee zie je hoe volledig en betrouwbaar de gegevens zijn waarop de match is gebaseerd. Er zijn punten te verdienen voor:</p>
        <ul>
          <li>een uitgebreide beschrijving (20), toelatingseisen (15) en de onderwijsinstelling (10);</li>
          <li>studiepunten, voertaal, en periode of locatie (elk 5);</li>
          <li>gegevens van de eigen minorpagina in plaats van alleen de overzichtslijst (10);</li>
          <li>hoe recent de gegevens zijn opgehaald (10);</li>
          <li>hoe volledig jouw profiel is (20).</li>
        </ul>
        <h3>5. Grenzen</h3>
        <p>
          Dit is een hulpmiddel en geen bindend advies. De woordvergelijking begrijpt geen context, de gegevens kunnen
          verouderd zijn en toelatingseisen worden niet automatisch gecontroleerd. Twijfel je, of is de zekerheid laag?
          Bespreek je keuze dan met je studieadviseur of decaan, en kijk altijd op de officiële minorpagina.
        </p>
      </div>
    </dialog>
  );
}
