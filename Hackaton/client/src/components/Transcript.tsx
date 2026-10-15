import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../shared/types';

export function Transcript({ messages, thinking }: { messages: ChatMessage[]; thinking: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages.length, thinking]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="transcript">
      <ol className="messages" aria-label="Gespreksverloop">
        {messages.map((m, i) => (
          <li key={i} className={`msg msg-${m.role}`}>
            <span className="msg-who">{m.role === 'assistant' ? 'AI-assistent' : 'Jij'}</span>
            <p>{m.text}</p>
          </li>
        ))}
        {thinking && (
          <li className="msg msg-assistant msg-thinking" aria-label="De assistent denkt na">
            <span className="msg-who">AI-assistent</span>
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="muted">denkt na…</span>
          </li>
        )}
      </ol>
      {/* Schermlezers lezen alleen het nieuwste antwoord van de assistent voor. */}
      <div className="sr-only" aria-live="polite">
        {lastAssistant?.text}
      </div>
      <div ref={endRef} />
    </div>
  );
}
