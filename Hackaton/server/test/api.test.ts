import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emptyProfile, initialState, type ChatResponse, type RecommendResponse } from '../../shared/types.js';
import { createApp } from '../src/app.js';
import { oneQuestion } from '../src/chat/llmAgent.js';
import { config } from '../src/config.js';
import { buildCorpus } from '../src/match/score.js';
import { datasetInfo } from '../src/minors/store.js';
import { fixtureMinors } from './helpers.js';

let server: Server;
let base: string;

beforeAll(async () => {
  const minors = fixtureMinors();
  server = createApp({ minors, corpus: buildCorpus(minors), info: datasetInfo(minors), file: 'test' }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('API', () => {
  it('status meldt dataset en LLM-configuratie zonder sleutels te tonen', async () => {
    const res = await fetch(base + '/api/status');
    const body = await res.json();
    expect(body.dataset.count).toBe(6);
    expect(JSON.stringify(body)).not.toMatch(/sk-|api[_-]?key/i);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('chat geeft de opening en daarna de volgende vraag', async () => {
    const g = (await (await post('/api/chat', { history: [], profile: emptyProfile(), state: initialState(), userText: '' })).json()) as ChatResponse;
    expect(g.reply).toMatch(/AI-assistent/);
    expect(g.state.currentTopic).toBe('interesses');
    const r = (await (await post('/api/chat', { history: [{ role: 'assistant', text: g.reply }], profile: g.profile, state: g.state, userText: 'Ik hou van tekenen en design' })).json()) as ChatResponse;
    expect(r.profile.topics.interesses.status).toBe('beantwoord');
    expect(r.state.currentTopic).toBe('opleiding');
  });

  it('weigert ongeldige of te grote invoer', async () => {
    expect((await post('/api/chat', { foo: 1 })).status).toBe(400);
    expect((await post('/api/chat', { history: [], profile: emptyProfile(), state: initialState(), userText: 'x'.repeat(3000) })).status).toBe(400);
  });

  it('recommend geeft gerangschikte resultaten met methode en dataset', async () => {
    const profile = emptyProfile();
    profile.topics.interesses = { status: 'beantwoord', text: 'games ontwerpen en unity' };
    const body = (await (await post('/api/recommend', { profile })).json()) as RecommendResponse;
    expect(body.results[0].minor.id).toBe('test-game-design');
    expect(body.method.topicWeights.voorkeuren).toBeGreaterThan(0);
    expect(body.adviseCounselor).toBe(true); // profiel is grotendeels leeg
  });

  it('valt terug op de ingebouwde gespreksleider als de LLM niet bereikbaar is', async () => {
    const prev = { provider: config.provider, url: config.openaiBaseUrl, timeout: config.llmTimeoutMs };
    Object.assign(config, { provider: 'openai', openaiBaseUrl: 'http://127.0.0.1:9/v1', llmTimeoutMs: 1000 });
    try {
      const g = (await (await post('/api/chat', { history: [], profile: emptyProfile(), state: initialState(), userText: '' })).json()) as ChatResponse;
      const r = (await (await post('/api/chat', { history: [{ role: 'assistant', text: g.reply }], profile: g.profile, state: g.state, userText: 'Ik sport graag' })).json()) as ChatResponse;
      expect(r.engine).toBe('regels');
      expect(r.notice).toMatch(/ingebouwde gespreksleider/);
      expect(r.reply.length).toBeGreaterThan(5);
    } finally {
      Object.assign(config, { provider: prev.provider, openaiBaseUrl: prev.url, llmTimeoutMs: prev.timeout });
    }
  });

  it('verwerkt een LLM-antwoord (OpenAI-compatibel, bijv. Ollama) in het profiel', async () => {
    const fake = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const sent = JSON.parse(body);
        expect(sent.messages[0].role).toBe('system');
        const turn = {
          reply: 'Leuk dat je van fotografie houdt! Welke opleiding doe je nu? En wat wil je later?',
          updates: [{ topic: 'interesses', status: 'beantwoord', summary: 'fotografie, reizen' }],
          currentStudy: null,
          avoid: ['economie'],
          languagePreference: null,
          nextTopic: 'opleiding',
          action: 'none',
        };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(turn) } }] }));
      });
    }).listen(0);
    await new Promise((r) => fake.once('listening', r));
    const prev = { provider: config.provider, url: config.openaiBaseUrl };
    Object.assign(config, { provider: 'openai', openaiBaseUrl: `http://127.0.0.1:${(fake.address() as AddressInfo).port}/v1` });
    try {
      const r = (await (
        await post('/api/chat', { history: [{ role: 'assistant', text: 'Waar ben je graag mee bezig?' }], profile: emptyProfile(), state: { currentTopic: 'interesses', followUps: 0, done: false }, userText: 'Ik fotografeer en reis graag, niks met economie' })
      ).json()) as ChatResponse;
      expect(r.engine).toBe('llm');
      expect(r.reply).toBe('Leuk dat je van fotografie houdt! Welke opleiding doe je nu?');
      expect(r.profile.topics.interesses).toEqual({ status: 'beantwoord', text: 'fotografie, reizen' });
      expect(r.profile.avoid).toContain('economie');
      expect(r.state.currentTopic).toBe('opleiding');
    } finally {
      Object.assign(config, { provider: prev.provider, openaiBaseUrl: prev.url });
      fake.close();
    }
  });

  it('LLM-antwoorden worden ingekort tot één vraag', () => {
    expect(oneQuestion('Leuk! Wat studeer je? En wat wil je later?')).toBe('Leuk! Wat studeer je?');
    expect(oneQuestion('Wat studeer je?')).toBe('Wat studeer je?');
  });
});
