// Scenario 4: niet-werkende spraak. De app moet dan bruikbaar blijven via tekst.

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyProfile, type ChatRequest, type ChatResponse } from '../../shared/types';
import App from './App';
import { chunkText } from './hooks/useSpeechSynthesis';

const log = () => within(screen.getByRole('list', { name: /gespreksverloop/i }));

const status = { llm: { provider: 'none', model: null, configured: false }, dataset: { count: 2, detailCount: 2, oldestRetrievedAt: null, newestRetrievedAt: null, sourceUrl: 'https://www.kiesopmaat.nl/modules/' } };

function mockServer() {
  const chatCalls: ChatRequest[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/status') return new Response(JSON.stringify(status));
    if (url === '/api/chat') {
      const req = JSON.parse(String(init!.body)) as ChatRequest;
      chatCalls.push(req);
      const res: ChatResponse = req.userText
        ? { reply: 'Dank je. Welke opleiding doe je nu?', profile: { ...emptyProfile(), topics: { ...emptyProfile().topics, interesses: { status: 'beantwoord', text: req.userText } } }, state: { currentTopic: 'opleiding', followUps: 0, done: false }, engine: 'regels', action: 'none' }
        : { reply: 'Hoi! Ik ben een AI-assistent. Waar ben je in je vrije tijd graag mee bezig?', profile: emptyProfile(), state: { currentTopic: 'interesses', followUps: 0, done: false }, engine: 'regels', action: 'none' };
      return new Response(JSON.stringify(res));
    }
    return new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return chatCalls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe('Scenario 4a: browser zonder spraakherkenning', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('waarschuwt op het startscherm en laat het gesprek via tekst verlopen', async () => {
    const calls = mockServer();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/ondersteunt geen spraakherkenning/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start spraakgesprek/i }));
    expect(await screen.findByRole('list', { name: /gespreksverloop/i })).toBeInTheDocument();
    expect(await log().findByText(/Ik ben een AI-assistent/)).toBeInTheDocument();
    expect(screen.getByText(/Spraakherkenning werkt niet in deze browser/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /druk om te praten/i })).not.toBeInTheDocument();

    const input = screen.getByLabelText(/typ je antwoord/i);
    await user.type(input, 'Ik game graag{Enter}');
    expect(await log().findByText('Dank je. Welke opleiding doe je nu?')).toBeInTheDocument();
    expect(calls.at(-1)!.userText).toBe('Ik game graag');
    expect(log().getByText('Ik game graag')).toBeInTheDocument();
  });
});

describe('Scenario 4b: microfoon geweigerd', () => {
  it('toont een duidelijke foutmelding en tekstinvoer blijft werken', async () => {
    class DeniedRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult = null;
      onstart: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onerror?.({ error: 'not-allowed' });
          this.onend?.();
        }, 0);
      }
      stop() {}
      abort() {}
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = DeniedRecognition;
    mockServer();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /start spraakgesprek/i }));
    await screen.findByRole('list', { name: /gespreksverloop/i });
    await log().findByText(/Ik ben een AI-assistent/);

    const mic = screen.getByRole('button', { name: /druk om te praten/i });
    await act(async () => {
      await user.click(mic);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/geen toegang tot de microfoon/i);
    // automatisch luisteren wordt uitgezet zodat de app niet blijft proberen
    await waitFor(() => expect(screen.getByLabelText(/automatisch luisteren/i)).not.toBeChecked());

    await user.type(screen.getByLabelText(/typ je antwoord/i), 'Ik teken graag{Enter}');
    expect(await log().findByText('Dank je. Welke opleiding doe je nu?')).toBeInTheDocument();
  });
});

describe('tekst-naar-spraak', () => {
  it('knipt lange antwoorden op in zinnen', () => {
    const chunks = chunkText('Eerste zin. '.repeat(30));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
  });
});
