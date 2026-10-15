import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { TOPIC_IDS, type ChatRequest, type ChatResponse, type RecommendResponse, type StatusResponse } from '../../shared/types.js';
import { llmTurn } from './chat/llmAgent.js';
import { ruleTurn } from './chat/ruleAgent.js';
import { config, llmModel } from './config.js';
import { AVOID_PENALTY, CONCEPT_FACTOR, counselorAdvice, FIELD_WEIGHTS, profileCompleteness, recommend, RELEVANCE_THRESHOLD, SATURATION, TOPIC_WEIGHTS } from './match/score.js';
import type { MinorStore } from './minors/store.js';
import { PIPER_VOICE, STT_MODEL, sttInstalled, ttsInstalled } from './speech/paths.js';
import { transcribe } from './speech/stt.js';
import { synthesize } from './speech/tts.js';

const TopicAnswerSchema = z.object({ status: z.enum(['open', 'beantwoord', 'onzeker', 'overgeslagen']), text: z.string().max(4000) });
const ProfileSchema = z.object({
  topics: z.object(Object.fromEntries(TOPIC_IDS.map((id) => [id, TopicAnswerSchema])) as Record<(typeof TOPIC_IDS)[number], typeof TopicAnswerSchema>),
  currentStudy: z.string().max(200).nullable(),
  avoid: z.array(z.string().max(100)).max(30),
  languagePreference: z.enum(['nl', 'en', 'geen']).nullable(),
});
const ChatSchema = z.object({
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).max(100),
  profile: ProfileSchema,
  state: z.object({ currentTopic: z.enum(TOPIC_IDS).nullable(), followUps: z.number().int().min(0).max(10), done: z.boolean() }),
  userText: z.string().max(2000),
});

/** Eenvoudige rate limit per IP (in geheugen), tegen misbruik van de LLM-sleutel. */
function rateLimit(perMinute: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'onbekend';
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + 60_000 });
    else if (++h.n > perMinute) {
      res.status(429).json({ error: 'Te veel verzoeken. Wacht even en probeer het opnieuw.' });
      return;
    }
    next();
  };
}

export function createApp(store: MinorStore) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'microphone=(self)');
    // Gespreksdata nooit cachen
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/status', (_req, res) => {
    const stt = sttInstalled();
    const tts = ttsInstalled();
    const body: StatusResponse = {
      llm: { provider: config.provider, model: llmModel(), configured: config.provider !== 'none' },
      dataset: store.info,
      speech: { stt, tts, sttModel: stt ? STT_MODEL : null, voice: tts ? PIPER_VOICE : null },
    };
    res.json(body);
  });

  app.post('/api/chat', rateLimit(40), async (req, res) => {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Ongeldig verzoek.' });
      return;
    }
    const chatReq = parsed.data as ChatRequest;
    let out: ChatResponse;
    if (config.provider === 'none') out = ruleTurn(chatReq);
    else {
      try {
        out = await llmTurn(chatReq);
      } catch (err) {
        // Log alleen het type fout, nooit de inhoud van het gesprek.
        console.warn(`[chat] LLM-fout, terugval op regels: ${(err as Error).name}: ${(err as Error).message.slice(0, 200)}`);
        out = { ...ruleTurn(chatReq), notice: 'De AI-taaldienst reageerde niet; ik ga verder met de ingebouwde gespreksleider.' };
      }
    }
    res.json(out);
  });

  // Lokale spraakherkenning: WAV in, tekst uit. Audio wordt niet opgeslagen of gelogd.
  app.post('/api/stt', rateLimit(60), express.raw({ type: ['audio/wav', 'audio/x-wav', 'application/octet-stream'], limit: '4mb' }), async (req, res) => {
    if (!sttInstalled()) {
      res.status(503).json({ error: 'Lokale spraakherkenning is niet geïnstalleerd (npm run setup:speech).' });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length < 44) {
      res.status(400).json({ error: 'Geen audio ontvangen.' });
      return;
    }
    try {
      res.json({ text: await transcribe(req.body) });
    } catch (err) {
      console.warn(`[stt] ${(err as Error).message.slice(0, 200)}`);
      res.status(422).json({ error: 'De opname kon niet worden verwerkt. Probeer het opnieuw.' });
    }
  });

  // Lokale tekst-naar-spraak met een Nederlandse Piper-stem.
  app.post('/api/tts', rateLimit(120), async (req, res) => {
    const parsed = z.object({ text: z.string().min(1).max(1500) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Ongeldige tekst.' });
      return;
    }
    if (!ttsInstalled()) {
      res.status(503).json({ error: 'Lokale stem is niet geïnstalleerd (npm run setup:speech).' });
      return;
    }
    try {
      const wav = await synthesize(parsed.data.text);
      res.setHeader('Content-Type', 'audio/wav');
      res.send(wav);
    } catch (err) {
      console.warn(`[tts] ${(err as Error).message.slice(0, 200)}`);
      res.status(500).json({ error: 'Voorlezen is mislukt.' });
    }
  });

  app.post('/api/recommend', rateLimit(30), (req, res) => {
    const parsed = z.object({ profile: ProfileSchema }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Ongeldig profiel.' });
      return;
    }
    const profile = parsed.data.profile;
    const results = recommend(store.corpus, profile);
    const reason = counselorAdvice(profile, results);
    const body: RecommendResponse = {
      results,
      profileCompleteness: profileCompleteness(profile),
      adviseCounselor: reason !== null,
      counselorReason: reason,
      dataset: store.info,
      method: {
        topicWeights: TOPIC_WEIGHTS,
        fieldWeights: FIELD_WEIGHTS,
        conceptFactor: CONCEPT_FACTOR,
        saturation: SATURATION,
        relevanceThreshold: RELEVANCE_THRESHOLD,
        avoidPenalty: AVOID_PENALTY,
      },
    };
    res.json(body);
  });

  // Productie: serveer de gebouwde frontend.
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Niet gevonden.' }));
  return app;
}
