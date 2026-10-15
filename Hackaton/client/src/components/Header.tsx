import { Icon } from './Icon';

interface Props {
  onRestart?: () => void;
  onMethod: () => void;
}

export function Header({ onRestart, onMethod }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="mic" />
        </span>
        <span>
          <strong>Minoren in de buurt</strong>
          <span className="brand-sub">AI-spraakassistent voor minoren</span>
        </span>
      </div>
      <nav className="header-actions" aria-label="Algemeen">
        <button type="button" className="btn btn-ghost" onClick={onMethod}>
          <Icon name="info" /> <span className="hide-sm">Hoe werkt het?</span>
        </button>
        {onRestart && (
          <button type="button" className="btn btn-ghost" onClick={onRestart}>
            <Icon name="restart" /> <span className="hide-sm">Opnieuw beginnen</span>
          </button>
        )}
      </nav>
    </header>
  );
}
