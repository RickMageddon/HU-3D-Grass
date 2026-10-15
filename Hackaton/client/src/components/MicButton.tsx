import { Icon } from './Icon';

export type MicStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'unsupported';

const LABELS: Record<MicStatus, string> = {
  idle: 'Druk om te praten',
  listening: 'Luistert… druk om te stoppen',
  thinking: 'Even denken…',
  speaking: 'Druk om te onderbreken',
  unsupported: 'Spraak niet beschikbaar',
};

interface Props {
  status: MicStatus;
  onClick: () => void;
  disabled?: boolean;
}

export function MicButton({ status, onClick, disabled }: Props) {
  return (
    <div className={`mic mic-${status}`}>
      <button
        type="button"
        className="mic-button"
        onClick={onClick}
        disabled={disabled || status === 'unsupported'}
        aria-pressed={status === 'listening'}
        aria-label={LABELS[status]}
      >
        <span className="mic-ring" aria-hidden="true" />
        <Icon name={status === 'listening' ? 'stop' : 'mic'} />
      </button>
      <span className="mic-label" aria-hidden="true">
        {LABELS[status]}
      </span>
    </div>
  );
}
