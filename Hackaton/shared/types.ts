// Gedeelde types tussen client en server.

export const TOPIC_IDS = [
  'interesses',
  'opleiding',
  'vakken',
  'werkervaring',
  'ambities',
  'voorkeuren',
] as const;

export type TopicId = (typeof TOPIC_IDS)[number];

export const TOPIC_LABELS: Record<TopicId, string> = {
  interesses: "Hobby's en interesses",
  opleiding: 'Huidige en eerdere opleidingen',
  vakken: 'Studieachtergrond en vakken',
  werkervaring: 'Werkervaring en vaardigheden',
  ambities: 'Toekomstplannen en ambities',
  voorkeuren: 'Wat je wilt ontdekken',
};

/** open = nog niet gevraagd/beantwoord, onzeker = student twijfelt of weet het niet. */
export type TopicStatus = 'open' | 'beantwoord' | 'onzeker' | 'overgeslagen';

export interface TopicAnswer {
  status: TopicStatus;
  /** Wat de student over dit onderwerp heeft gezegd (samengevoegd). */
  text: string;
}

export interface StudentProfile {
  topics: Record<TopicId, TopicAnswer>;
  /** Huidige opleiding, indien expliciet genoemd. */
  currentStudy: string | null;
  /** Onderwerpen die de student juist níet wil. */
  avoid: string[];
  languagePreference: 'nl' | 'en' | 'geen' | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ConversationState {
  /** Onderwerp waar de laatste vraag over ging. */
  currentTopic: TopicId | null;
  /** Hoe vaak er over het huidige onderwerp is doorgevraagd. */
  followUps: number;
  done: boolean;
}

export interface ChatRequest {
  history: ChatMessage[];
  profile: StudentProfile;
  state: ConversationState;
  userText: string;
}

export interface ChatResponse {
  reply: string;
  profile: StudentProfile;
  state: ConversationState;
  /** Welke engine het antwoord maakte; 'regels' = ingebouwde gespreksleider zonder LLM. */
  engine: 'llm' | 'regels';
  /** Gezet als de LLM faalde en er is teruggevallen op de regels. */
  notice?: string;
  /** Opdracht die de student gaf, bijv. "toon de resultaten" of "begin opnieuw". */
  action: 'none' | 'results' | 'restart';
}

export interface Minor {
  id: string;
  name: string;
  institution: string | null;
  description: string | null;
  admission: string | null;
  /** Overige tekst van de pagina (inhoud, leerdoelen, ...), gebruikt voor matching. */
  extraText: string | null;
  url: string;
  ects: number | null;
  language: string | null;
  period: string | null;
  location: string | null;
  source: {
    file: string;
    /** ISO-datum waarop de pagina is opgeslagen/geïmporteerd. */
    retrievedAt: string;
    /** 'detail' = eigen minorpagina, 'overzicht' = alleen uit de overzichtslijst. */
    kind: 'detail' | 'overzicht';
  };
  parseWarnings: string[];
}

export interface TopicContribution {
  topic: TopicId;
  label: string;
  weight: number;
  /** 0..1 */
  score: number;
  matchedTerms: string[];
}

export interface CertaintyItem {
  label: string;
  ok: boolean;
  points: number;
  maxPoints: number;
}

export interface Recommendation {
  minor: Minor;
  rank: number;
  /** 0..100 */
  matchScore: number;
  /** 0..100 */
  certaintyScore: number;
  relevant: boolean;
  contributions: TopicContribution[];
  avoidHits: string[];
  certainty: CertaintyItem[];
  reasons: string[];
  warnings: string[];
}

export interface RecommendResponse {
  results: Recommendation[];
  profileCompleteness: number;
  adviseCounselor: boolean;
  counselorReason: string | null;
  dataset: DatasetInfo;
  method: ScoringMethod;
}

/** De parameters van de scoreberekening, zodat de uitleg in de app altijd klopt. */
export interface ScoringMethod {
  topicWeights: Record<TopicId, number>;
  fieldWeights: { titel: number; beschrijving: number };
  conceptFactor: number;
  saturation: number;
  relevanceThreshold: number;
  avoidPenalty: number;
}

export interface DatasetInfo {
  count: number;
  detailCount: number;
  oldestRetrievedAt: string | null;
  newestRetrievedAt: string | null;
  sourceUrl: string;
}

export interface StatusResponse {
  llm: { provider: string; model: string | null; configured: boolean };
  dataset: DatasetInfo;
  /** Lokale spraak op de server (Whisper/Piper). false = de browser doet het zelf. */
  speech: { stt: boolean; tts: boolean; sttModel: string | null; voice: string | null };
}

export function emptyProfile(): StudentProfile {
  const topics = {} as Record<TopicId, TopicAnswer>;
  for (const id of TOPIC_IDS) topics[id] = { status: 'open', text: '' };
  return { topics, currentStudy: null, avoid: [], languagePreference: null };
}

export function initialState(): ConversationState {
  return { currentTopic: null, followUps: 0, done: false };
}
