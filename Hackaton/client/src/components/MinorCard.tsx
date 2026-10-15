import { useId, useState } from 'react';
import type { Recommendation } from '../../../shared/types';
import { Icon } from './Icon';
import { ScoreMeter } from './ScoreMeter';

interface Props {
  rec: Recommendation;
  selected: boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
}

const unknown = <span className="unknown">onbekend</span>;

export function MinorCard({ rec, selected, compareDisabled, onToggleCompare }: Props) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const m = rec.minor;
  const desc = m.description ?? '';
  const short = desc.length > 320 ? desc.slice(0, 300).replace(/\s+\S*$/, '') + '…' : desc;

  return (
    <article className={`minor-card ${selected ? 'is-selected' : ''}`} aria-labelledby={`${detailsId}-title`}>
      <header className="minor-head">
        <span className="rank" aria-label={`Plaats ${rec.rank}`}>
          {rec.rank}
        </span>
        <div className="minor-title">
          <h3 id={`${detailsId}-title`}>{m.name}</h3>
          <p className="institution">{m.institution ?? <span className="unknown">Onderwijsinstelling onbekend</span>}</p>
        </div>
        <label className="compare-check">
          <input type="checkbox" checked={selected} disabled={!selected && compareDisabled} onChange={onToggleCompare} />
          <span>Vergelijk</span>
        </label>
      </header>

      <div className="minor-scores">
        <ScoreMeter label="Matchscore" value={rec.matchScore} hint="Hoe goed deze minor past bij wat je vertelde" />
        <ScoreMeter label="Informatiezekerheid" value={rec.certaintyScore} hint="Hoe volledig en betrouwbaar de gebruikte gegevens zijn" />
      </div>

      <section className="why">
        <h4>Waarom deze minor?</h4>
        <ul>
          {rec.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      {rec.warnings.length > 0 && (
        <ul className="warnings">
          {rec.warnings.map((w, i) => (
            <li key={i}>
              <Icon name="warn" /> {w}
            </li>
          ))}
        </ul>
      )}

      <dl className="facts">
        <div>
          <dt>Studiepunten</dt>
          <dd>{m.ects != null ? `${m.ects} EC` : unknown}</dd>
        </div>
        <div>
          <dt>Voertaal</dt>
          <dd>{m.language ?? unknown}</dd>
        </div>
        <div>
          <dt>Periode</dt>
          <dd>{m.period ?? unknown}</dd>
        </div>
        <div>
          <dt>Locatie</dt>
          <dd>{m.location ?? unknown}</dd>
        </div>
      </dl>

      <section>
        <h4>Beschrijving</h4>
        {desc ? <p className="desc">{open ? desc : short}</p> : <p className="unknown">Geen beschrijving beschikbaar in de gegevens.</p>}
      </section>

      {open && (
        <div id={detailsId} className="minor-details">
          <section>
            <h4>Toelatingseisen</h4>
            {m.admission ? <p>{m.admission}</p> : <p className="unknown">Niet gevonden in de gegevens. Controleer de officiële pagina.</p>}
          </section>
          <section>
            <h4>Zo is de matchscore berekend</h4>
            <table className="breakdown">
              <thead>
                <tr>
                  <th scope="col">Onderwerp</th>
                  <th scope="col">Gewicht</th>
                  <th scope="col">Score</th>
                  <th scope="col">Overeenkomsten</th>
                </tr>
              </thead>
              <tbody>
                {rec.contributions.map((c) => (
                  <tr key={c.topic}>
                    <th scope="row">{c.label}</th>
                    <td>{Math.round(c.weight * 100)}%</td>
                    <td>{Math.round(c.score * 100)}</td>
                    <td>{c.matchedTerms.length ? c.matchedTerms.join(', ') : <span className="muted">geen</span>}</td>
                  </tr>
                ))}
                {rec.contributions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Er is nog niets bekend om te vergelijken.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {rec.avoidHits.length > 0 && <p className="muted">Gehalveerd omdat de minor gaat over iets wat je liever niet wilt: {rec.avoidHits.join(', ')}.</p>}
          </section>
          <section>
            <h4>Zo is de informatiezekerheid berekend</h4>
            <ul className="certainty-list">
              {rec.certainty.map((c, i) => (
                <li key={i} className={c.ok ? 'ok' : 'missing'}>
                  <Icon name={c.ok ? 'check' : 'warn'} /> {c.label}
                  <span className="pts">
                    {c.points}/{c.maxPoints}
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted small">
              Bron: {m.source.kind === 'detail' ? 'eigen minorpagina' : 'overzichtslijst'} op Kies op Maat, opgehaald{' '}
              {new Date(m.source.retrievedAt).toLocaleDateString('nl-NL')}.
            </p>
          </section>
        </div>
      )}

      <footer className="minor-foot">
        <button type="button" className="btn btn-ghost" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(!open)}>
          {open ? 'Minder tonen' : 'Toelatingseisen en scoreberekening'}
        </button>
        <a className="btn btn-secondary" href={m.url} target="_blank" rel="noopener noreferrer">
          Officiële pagina <Icon name="external" />
          <span className="sr-only">(opent in nieuw tabblad)</span>
        </a>
      </footer>
    </article>
  );
}
