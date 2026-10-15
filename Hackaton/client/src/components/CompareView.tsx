import { useEffect, useRef, type ReactNode } from 'react';
import type { Recommendation } from '../../../shared/types';
import { Icon } from './Icon';

const unknown = <span className="unknown">onbekend</span>;

const ROWS: Array<[string, (r: Recommendation) => ReactNode]> = [
  ['Onderwijsinstelling', (r) => r.minor.institution ?? unknown],
  ['Plaats in ranglijst', (r) => `#${r.rank}`],
  ['Matchscore', (r) => `${r.matchScore}/100`],
  ['Informatiezekerheid', (r) => `${r.certaintyScore}/100`],
  ['Studiepunten', (r) => (r.minor.ects != null ? `${r.minor.ects} EC` : unknown)],
  ['Voertaal', (r) => r.minor.language ?? unknown],
  ['Periode', (r) => r.minor.period ?? unknown],
  ['Locatie', (r) => r.minor.location ?? unknown],
  ['Waarom het past', (r) => (r.reasons.length ? <ul>{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul> : unknown)],
  ['Aandachtspunten', (r) => (r.warnings.length ? <ul>{r.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="muted">geen</span>)],
  ['Toelatingseisen', (r) => r.minor.admission ?? unknown],
  [
    'Link',
    (r) => (
      <a href={r.minor.url} target="_blank" rel="noopener noreferrer">
        Officiële pagina <Icon name="external" />
      </a>
    ),
  ],
];

export function CompareView({ items, onClose, onRemove }: { items: Recommendation[]; onClose: () => void; onRemove: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  return (
    <dialog ref={ref} className="dialog dialog-wide" aria-labelledby="compare-title" onClose={onClose} onCancel={onClose}>
      <div className="dialog-head">
        <h2 id="compare-title">Minoren vergelijken</h2>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Sluiten">
          <Icon name="close" />
        </button>
      </div>
      <div className="compare-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" className="sr-only-cell">
                Kenmerk
              </th>
              {items.map((r) => (
                <th scope="col" key={r.minor.id}>
                  <span>{r.minor.name}</span>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => onRemove(r.minor.id)}>
                    Verwijder
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, get]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {items.map((r) => (
                  <td key={r.minor.id}>{get(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}
