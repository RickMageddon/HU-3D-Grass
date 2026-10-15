export function scoreBand(v: number): 'hoog' | 'midden' | 'laag' {
  return v >= 60 ? 'hoog' : v >= 35 ? 'midden' : 'laag';
}

const BAND_TEXT = { hoog: 'hoog', midden: 'gemiddeld', laag: 'laag' };

export function ScoreMeter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const band = scoreBand(value);
  return (
    <div className={`meter meter-${band}`} title={hint}>
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">
          {value}
          <span className="meter-max">/100</span>
        </span>
      </div>
      <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={`${label}: ${value} van 100, ${BAND_TEXT[band]}`}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
