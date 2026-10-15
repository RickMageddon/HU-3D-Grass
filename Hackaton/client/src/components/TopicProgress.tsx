import { TOPIC_IDS, TOPIC_LABELS, type StudentProfile, type TopicId, type TopicStatus } from '../../../shared/types';
import { Icon } from './Icon';

const STATUS_TEXT: Record<TopicStatus, string> = {
  open: 'nog niet besproken',
  beantwoord: 'besproken',
  onzeker: 'je twijfelde',
  overgeslagen: 'overgeslagen',
};

export function TopicProgress({ profile, current }: { profile: StudentProfile; current: TopicId | null }) {
  const done = TOPIC_IDS.filter((id) => profile.topics[id].status !== 'open').length;
  return (
    <div className="progress" aria-label={`Voortgang: ${done} van ${TOPIC_IDS.length} onderwerpen besproken`}>
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${(done / TOPIC_IDS.length) * 100}%` }} />
      </div>
      <ol className="topic-chips">
        {TOPIC_IDS.map((id) => {
          const st = profile.topics[id].status;
          return (
            <li key={id} className={`chip chip-${st} ${current === id ? 'chip-current' : ''}`} aria-current={current === id ? 'step' : undefined}>
              {st === 'beantwoord' && <Icon name="check" />}
              <span>{TOPIC_LABELS[id]}</span>
              <span className="sr-only">: {STATUS_TEXT[st]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
