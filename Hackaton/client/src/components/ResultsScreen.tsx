import { useEffect, useMemo, useRef, useState } from 'react';
import { TOPIC_IDS, TOPIC_LABELS, type RecommendResponse, type ScoringMethod, type StudentProfile } from '../../../shared/types';
import type { SynthesisState } from '../hooks/useSpeechSynthesis';
import { api } from '../lib/api';
import { CompareView } from './CompareView';
import { Icon } from './Icon';
import { MinorCard } from './MinorCard';

interface Props {
  profile: StudentProfile;
  voiceOn: boolean;
  tts: SynthesisState;
  onBack: () => void;
  onRestart: () => void;
  onMethod: () => void;
  onMethodLoaded: (m: ScoringMethod) => void;
}

const MAX_COMPARE = 4;
type Sort = 'match' | 'zekerheid' | 'naam';

export function summaryText(data: RecommendResponse): string {
  const rel = data.results.filter((r) => r.relevant);
  if (data.dataset.count === 0) return 'Er zijn nog geen minorgegevens geïmporteerd, dus ik kan nog geen minoren aanbevelen. Een studieadviseur kan je helpen met het actuele aanbod.';
  if (rel.length === 0) return 'Ik heb geen minor gevonden die duidelijk bij je past. Bekijk de minder passende minoren of bespreek je wensen met een studieadviseur.';
  const top = rel[0];
  const inst = top.minor.institution ? ` van ${top.minor.institution}` : '';
  return (
    `Ik heb ${rel.length} ${rel.length === 1 ? 'passende minor' : 'passende minoren'} gevonden. ` +
    `De beste match is ${top.minor.name}${inst}, met een matchscore van ${top.matchScore}. ` +
    (data.adviseCounselor ? 'Ik raad je aan je keuze ook met een studieadviseur te bespreken.' : 'Bekijk de lijst voor de uitleg per minor.')
  );
}

export function ResultsScreen({ profile, voiceOn, tts, onBack, onRestart, onMethod, onMethodLoaded }: Props) {
  const [data, setData] = useState<RecommendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState('');
  const [institution, setInstitution] = useState('alle');
  const [language, setLanguage] = useState('alle');
  const [minMatch, setMinMatch] = useState(0);
  const [minCertainty, setMinCertainty] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<Sort>('match');
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    api.recommend(profile, ctrl.signal).then(
      (res) => {
        setData(res);
        onMethodLoaded(res.method);
        headingRef.current?.focus();
        if (voiceOn && tts.supported && tts.hasDutchVoice) tts.speak(summaryText(res));
      },
      (e: Error) => e.name !== 'AbortError' && setError(e.message),
    );
    return () => {
      ctrl.abort();
      tts.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, attempt]);

  const institutions = useMemo(() => [...new Set((data?.results ?? []).map((r) => r.minor.institution).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'nl')), [data]);
  const languages = useMemo(() => [...new Set((data?.results ?? []).map((r) => r.minor.language).filter((x): x is string => !!x))].sort(), [data]);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const list = data.results.filter(
      (r) =>
        (showAll || r.relevant) &&
        r.matchScore >= minMatch &&
        r.certaintyScore >= minCertainty &&
        (institution === 'alle' || r.minor.institution === institution) &&
        (language === 'alle' || r.minor.language === language) &&
        (!needle || `${r.minor.name} ${r.minor.institution ?? ''} ${r.minor.description ?? ''}`.toLowerCase().includes(needle)),
    );
    if (sort === 'zekerheid') return [...list].sort((a, b) => b.certaintyScore - a.certaintyScore || a.rank - b.rank);
    if (sort === 'naam') return [...list].sort((a, b) => a.minor.name.localeCompare(b.minor.name, 'nl'));
    return list;
  }, [data, q, institution, language, minMatch, minCertainty, showAll, sort]);

  const relevantCount = data?.results.filter((r) => r.relevant).length ?? 0;
  const compareItems = (data?.results ?? []).filter((r) => compare.includes(r.minor.id));
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX_COMPARE ? [...c, id] : c));
  const resetFilters = () => {
    setQ('');
    setInstitution('alle');
    setLanguage('alle');
    setMinMatch(0);
    setMinCertainty(0);
    setSort('match');
  };

  if (error) {
    return (
      <section className="results">
        <div className="notice notice-error" role="alert">
          <Icon name="warn" /> {error}
          <button type="button" className="btn btn-small" onClick={() => setAttempt((a) => a + 1)}>
            Opnieuw proberen
          </button>
        </div>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="results loading" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <p role="status">Minoren zoeken en scores berekenen…</p>
      </section>
    );
  }

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results-head">
        <div>
          <h1 id="results-title" ref={headingRef} tabIndex={-1}>
            Jouw minoren
          </h1>
          <p className="lead" aria-live="polite">
            {summaryText(data)}
          </p>
        </div>
        <div className="results-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <Icon name="back" /> Terug naar gesprek
          </button>
          <button type="button" className="btn btn-ghost" onClick={onMethod}>
            <Icon name="info" /> Hoe werken de scores?
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRestart}>
            <Icon name="restart" /> Opnieuw beginnen
          </button>
        </div>
      </div>

      {data.adviseCounselor && (
        <div className="notice notice-advice" role="note">
          <Icon name="info" />
          <span>
            <strong>Advies: praat met een studieadviseur.</strong> {data.counselorReason}
          </span>
        </div>
      )}

      <details className="profile-summary">
        <summary>Wat ik van je heb begrepen ({Math.round(data.profileCompleteness * 100)}% van je profiel)</summary>
        <dl>
          {TOPIC_IDS.map((id) => (
            <div key={id}>
              <dt>{TOPIC_LABELS[id]}</dt>
              <dd>
                {profile.topics[id].text ? profile.topics[id].text.split(' | ').filter(Boolean).join('; ') : <span className="unknown">{profile.topics[id].status === 'onzeker' ? 'je twijfelde nog' : profile.topics[id].status === 'overgeslagen' ? 'overgeslagen' : 'niet besproken'}</span>}
              </dd>
            </div>
          ))}
          {profile.avoid.length > 0 && (
            <div>
              <dt>Liever niet</dt>
              <dd>{profile.avoid.join(', ')}</dd>
            </div>
          )}
        </dl>
        <p className="muted small">Klopt dit niet? Ga terug naar het gesprek en vertel het de assistent.</p>
      </details>

      {data.dataset.count === 0 ? (
        <div className="empty">
          <h2>Nog geen minorgegevens</h2>
          <p>
            De beheerder van deze app heeft nog geen gegevens van Kies op Maat geïmporteerd. Daarom kan ik geen minoren aanbevelen.
            Ik verzin geen minoren. Bekijk zelf het aanbod op{' '}
            <a href={data.dataset.sourceUrl} target="_blank" rel="noopener noreferrer">
              kiesopmaat.nl
            </a>{' '}
            of vraag je studieadviseur.
          </p>
        </div>
      ) : (
        <>
          <form className="filters" aria-label="Filters" onSubmit={(e) => e.preventDefault()}>
            <div className="field field-grow">
              <label htmlFor="f-q">Zoeken</label>
              <input id="f-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam, instelling of onderwerp" />
            </div>
            <div className="field">
              <label htmlFor="f-inst">Instelling</label>
              <select id="f-inst" value={institution} onChange={(e) => setInstitution(e.target.value)}>
                <option value="alle">Alle instellingen</option>
                {institutions.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-lang">Voertaal</label>
              <select id="f-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="alle">Alle talen</option>
                {languages.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-sort">Sorteren op</label>
              <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="match">Beste match</option>
                <option value="zekerheid">Informatiezekerheid</option>
                <option value="naam">Naam (A–Z)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-match">Min. matchscore: {minMatch}</label>
              <input id="f-match" type="range" min={0} max={100} step={5} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="f-cert">Min. zekerheid: {minCertainty}</label>
              <input id="f-cert" type="range" min={0} max={100} step={5} value={minCertainty} onChange={(e) => setMinCertainty(Number(e.target.value))} />
            </div>
            <label className="toggle">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              <span>Toon ook minder passende minoren ({data.results.length - relevantCount})</span>
            </label>
            <button type="button" className="btn btn-ghost btn-small" onClick={resetFilters}>
              Filters wissen
            </button>
          </form>

          <p className="result-count" role="status">
            {visible.length} van {data.results.length} minoren getoond · {relevantCount} relevant · gegevens van{' '}
            <a href={data.dataset.sourceUrl} target="_blank" rel="noopener noreferrer">
              Kies op Maat
            </a>
            {data.dataset.newestRetrievedAt && `, opgehaald ${new Date(data.dataset.newestRetrievedAt).toLocaleDateString('nl-NL')}`}
          </p>

          {visible.length === 0 ? (
            <div className="empty">
              <p>Geen minoren gevonden met deze filters.</p>
              {!showAll && relevantCount === 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => setShowAll(true)}>
                  Toon minder passende minoren
                </button>
              )}
            </div>
          ) : (
            <ol className="minor-list">
              {visible.map((r) => (
                <li key={r.minor.id}>
                  <MinorCard rec={r} selected={compare.includes(r.minor.id)} compareDisabled={compare.length >= MAX_COMPARE} onToggleCompare={() => toggleCompare(r.minor.id)} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {compare.length > 0 && (
        <div className="compare-bar" role="region" aria-label="Vergelijken">
          <span>
            {compare.length} geselecteerd {compare.length >= MAX_COMPARE && `(maximaal ${MAX_COMPARE})`}
          </span>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setCompare([])}>
            Wissen
          </button>
          <button type="button" className="btn btn-primary" disabled={compare.length < 2} onClick={() => setCompareOpen(true)}>
            <Icon name="compare" /> Vergelijk{compare.length < 2 ? ' (kies er minstens 2)' : ''}
          </button>
        </div>
      )}
      {compareOpen && compareItems.length > 0 && (
        <CompareView
          items={compareItems}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => {
            toggleCompare(id);
            if (compareItems.length <= 1) setCompareOpen(false);
          }}
        />
      )}
    </section>
  );
}
