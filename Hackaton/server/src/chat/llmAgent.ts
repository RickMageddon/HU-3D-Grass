// Gesprek via een LLM. De LLM voert het gesprek en vat antwoorden samen, maar
// beveelt zelf géén minoren aan: dat doet de deterministische scoremodule op basis
// van de geïmporteerde Kies op Maat-gegevens. Zo kan de LLM geen minoren verzinnen.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { TOPIC_IDS, TOPIC_LABELS, type ChatRequest, type ChatResponse, type StudentProfile } from '../../../shared/types.js';
import { config } from '../config.js';
import { extractSideInfo, ruleTurn } from './ruleAgent.js';
import { CLOSING, TOPIC_SCRIPTS } from './topics.js';

const TurnSchema = z.object({
  reply: z.string().describe('Wat de assistent zegt: kort, Nederlands, hoogstens één vraag.'),
  updates: z.array(
    z.object({
      topic: z.enum(TOPIC_IDS),
      status: z.enum(['beantwoord', 'onzeker', 'overgeslagen']),
      summary: z.string().describe('Kernwoorden uit de woorden van de student, niets toevoegen.'),
    }),
  ),
  currentStudy: z.string().nullable(),
  avoid: z.array(z.string()),
  languagePreference: z.enum(['nl', 'en', 'geen']).nullable(),
  nextTopic: z.enum(TOPIC_IDS).nullable().describe('Onderwerp waar de vraag in reply over gaat; null als het gesprek klaar is.'),
  action: z.enum(['none', 'results', 'restart']),
});
type Turn = z.infer<typeof TurnSchema>;

const SYSTEM = `Je bent een vriendelijke Nederlandstalige AI-studiekeuzeassistent voor hbo-studenten die een minor zoeken.
Je praat via spraak: houd elke beurt kort (maximaal drie korte zinnen), natuurlijk en zonder opsommingstekens, markdown of emoji.

Doel: verzamel stap voor stap informatie over deze onderwerpen:
${TOPIC_IDS.map((id) => `- ${id}: ${TOPIC_LABELS[id]}`).join('\n')}

Regels:
- Stel steeds precies één vraag tegelijk.
- Vraag niet opnieuw naar een onderwerp met status "beantwoord", "onzeker" of "overgeslagen".
- Als een antwoord vaag of erg kort is, vraag één keer door met een concreet voorbeeld. Twijfelt de student daarna nog, markeer het onderwerp als "onzeker" en ga verder.
- Haal ook informatie over andere onderwerpen uit een antwoord als de student die terloops noemt.
- "summary" bevat alleen woorden en onderwerpen die de student zelf noemde. Voeg niets toe en interpreteer niet.
- Noem of beveel zelf geen specifieke minoren of instellingen aan, en verzin geen feiten. De aanbevelingen worden later door de applicatie berekend uit echte gegevens van Kies op Maat.
- Zijn alle onderwerpen behandeld, of vraagt de student om de resultaten, zet action op "results" en sluit kort af.
- Wil de student opnieuw beginnen, zet action op "restart".
- Als de student vraagt of je een mens bent: zeg eerlijk dat je een AI bent.
- Geef geen medisch, juridisch of financieel advies; verwijs bij twijfel naar een studieadviseur.`;

function profileSummary(profile: StudentProfile): string {
  return JSON.stringify(
    {
      onderwerpen: Object.fromEntries(TOPIC_IDS.map((id) => [id, profile.topics[id]])),
      currentStudy: profile.currentStudy,
      avoid: profile.avoid,
      languagePreference: profile.languagePreference,
    },
    null,
    1,
  );
}

let anthropic: Anthropic | null = null;

async function callAnthropic(system: string, transcript: string): Promise<Turn> {
  anthropic ??= new Anthropic({ timeout: config.llmTimeoutMs, maxRetries: 1 });
  const res = await anthropic.beta.messages.parse({
    model: config.anthropicModel,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: transcript }],
    output_config: { effort: 'low', format: betaZodOutputFormat(TurnSchema) },
  });
  if (res.stop_reason === 'refusal') throw new Error('De LLM weigerde dit verzoek.');
  if (!res.parsed_output) throw new Error(`Geen geldig JSON-antwoord van de LLM (stop_reason: ${res.stop_reason}).`);
  return res.parsed_output;
}

async function callOpenAICompatible(system: string, transcript: string): Promise<Turn> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.OPENAI_API_KEY) headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  const schemaHint = `Antwoord uitsluitend met JSON in deze vorm: ${JSON.stringify(z.toJSONSchema(TurnSchema))}`;
  const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(config.llmTimeoutMs),
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${system}\n\n${schemaHint}` },
        { role: 'user', content: transcript },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM-server gaf HTTP ${res.status}.`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content ?? '';
  return TurnSchema.parse(JSON.parse(content));
}

/** Houdt maximaal één vraag over: alles na het eerste vraagteken vervalt. */
export function oneQuestion(reply: string): string {
  const i = reply.indexOf('?');
  return i >= 0 && reply.indexOf('?', i + 1) >= 0 ? reply.slice(0, i + 1) : reply;
}

export async function llmTurn(req: ChatRequest): Promise<ChatResponse> {
  if (req.history.length === 0 && !req.userText.trim()) {
    // De opening is vast, zodat de AI-melding en de privacy-uitleg altijd kloppen.
    return { ...ruleTurn(req), engine: 'llm' };
  }
  const transcript = [
    'Huidig profiel (status per onderwerp):',
    profileSummary(req.profile),
    '',
    'Gesprek tot nu toe:',
    ...req.history.slice(-16).map((m) => `${m.role === 'user' ? 'Student' : 'Assistent'}: ${m.text}`),
    `Student: ${req.userText}`,
    '',
    `Laatste vraag ging over: ${req.state.currentTopic ?? 'niets'}. Geef je volgende beurt als JSON.`,
  ].join('\n');

  const call = config.provider === 'anthropic' ? callAnthropic : callOpenAICompatible;
  const turn = await call(SYSTEM, transcript);

  const profile: StudentProfile = structuredClone(req.profile);
  const touched = new Set<string>();
  for (const u of turn.updates) {
    const t = profile.topics[u.topic];
    t.text = [t.text, u.summary.trim()].filter(Boolean).join(' | ');
    if (t.status !== 'beantwoord') t.status = u.status;
    touched.add(u.topic);
  }
  // Zorg dat het antwoord van de student nooit verloren gaat, ook als de LLM het niet terugmeldt.
  const cur = req.state.currentTopic;
  if (cur && !touched.has(cur) && req.userText.trim()) {
    profile.topics[cur].text = [profile.topics[cur].text, req.userText.trim()].filter(Boolean).join(' | ');
  }
  if (turn.currentStudy && !profile.currentStudy) profile.currentStudy = turn.currentStudy;
  for (const a of turn.avoid) if (a.trim() && !profile.avoid.includes(a.trim())) profile.avoid.push(a.trim());
  if (turn.languagePreference) profile.languagePreference = turn.languagePreference;
  extractSideInfo(profile, req.userText, cur);

  const allDone = TOPIC_IDS.every((id) => profile.topics[id].status !== 'open');
  const action = turn.action !== 'none' ? turn.action : allDone ? 'results' : 'none';
  let reply = oneQuestion(turn.reply.trim());
  if (action === 'results' && !turn.reply.trim()) reply = CLOSING;
  if (!reply) reply = TOPIC_SCRIPTS[turn.nextTopic ?? 'interesses'].question;

  return {
    reply,
    profile,
    state: { currentTopic: action === 'results' ? null : turn.nextTopic, followUps: 0, done: action === 'results' },
    engine: 'llm',
    action,
  };
}
