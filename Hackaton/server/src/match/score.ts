import {
  TOPIC_IDS,
  TOPIC_LABELS,
  type CertaintyItem,
  type Minor,
  type Recommendation,
  type StudentProfile,
  type TopicContribution,
  type TopicId,
} from '../../../shared/types.js';
import { extractTerms, normalize, stem, tokenize, type Terms } from './text.js';

/**
 * Gewicht per gespreksonderwerp in de matchscore. Interesses, ambities en wat de
 * student wil ontdekken zeggen het meest over een passende minor; opleiding en
 * werkervaring vooral iets over aansluiting.
 */
export const TOPIC_WEIGHTS: Record<TopicId, number> = {
  interesses: 0.22,
  ambities: 0.22,
  voorkeuren: 0.26,
  vakken: 0.12,
  opleiding: 0.1,
  werkervaring: 0.08,
};

export const FIELD_WEIGHTS = { titel: 3, beschrijving: 1 } as const;
/** Een treffer op een thema (thesaurus) telt iets minder dan een letterlijk woord. */
export const CONCEPT_FACTOR = 0.8;
/** Verzadiging: topicScore = 1 - exp(-ruwe score / SATURATION). */
export const SATURATION = 2.5;
export const RELEVANCE_THRESHOLD = 25;
export const AVOID_PENALTY = 0.5;

const CONCEPT_LABELS: Record<string, string> = { ict: 'ICT', ai: 'AI', hr: 'HR' };
const conceptLabel = (c: string) => `thema ${CONCEPT_LABELS[c] ?? c}`;

function joinNl(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} en ${items.at(-1)}`;
}

/** Bijv. "Toekomstplannen en ambities: je noemde zorg, wat past bij het thema AI. Dat komt terug in de titel en beschrijving van deze minor." */
export function reasonFor(label: string, hits: Hit[]): string {
  const words = [...new Set(hits.filter((h) => !h.concept).map((h) => h.label))];
  const themes = [...new Set(hits.filter((h) => h.concept).map((h) => h.label.replace(/^thema /, '')))].filter(
    (t) => !words.some((w) => w.toLowerCase().startsWith(t.toLowerCase()) || t.toLowerCase().startsWith(w.toLowerCase())),
  );
  const where = hits.some((h) => h.field === 'titel') ? (hits.some((h) => h.field === 'beschrijving') ? 'de titel en beschrijving' : 'de titel') : 'de beschrijving';
  const themePhrase = `${themes.length === 1 ? 'het thema' : 'de thema’s'} ${joinNl(themes.slice(0, 3))}`;
  if (words.length && themes.length) return `${label}: je noemde ${joinNl(words.slice(0, 4))}, wat past bij ${themePhrase}. Dat komt terug in ${where} van deze minor.`;
  if (words.length) return `${label}: je noemde ${joinNl(words.slice(0, 4))}. Dat komt terug in ${where} van deze minor.`;
  return `${label}: wat je vertelde past bij ${themePhrase}, en dat komt terug in ${where} van deze minor.`;
}

type Field = keyof typeof FIELD_WEIGHTS;

interface MinorIndex {
  minor: Minor;
  fields: Record<Field, Terms>;
}

export interface Corpus {
  minors: MinorIndex[];
  idf: Map<string, number>;
  maxIdf: number;
}

export function buildCorpus(minors: Minor[]): Corpus {
  const indexed = minors.map((minor) => ({
    minor,
    fields: {
      titel: extractTerms(minor.name),
      beschrijving: extractTerms([minor.description, minor.extraText].filter(Boolean).join(' ')),
    },
  }));
  const df = new Map<string, number>();
  for (const m of indexed) {
    const all = new Set([...m.fields.titel.stems, ...m.fields.beschrijving.stems]);
    for (const s of all) df.set(s, (df.get(s) ?? 0) + 1);
  }
  const n = indexed.length;
  const idf = new Map<string, number>();
  let maxIdf = 1;
  for (const [s, d] of df) {
    const v = Math.log((n + 1) / (d + 0.5)) + 1;
    idf.set(s, v);
    maxIdf = Math.max(maxIdf, v);
  }
  return { minors: indexed, idf, maxIdf };
}

/** Zeldzame woorden zijn informatiever: gewicht tussen 0.3 en 1. */
function idfWeight(corpus: Corpus, s: string): number {
  const v = corpus.idf.get(s) ?? corpus.maxIdf;
  return Math.max(0.3, v / corpus.maxIdf);
}

interface Hit {
  label: string;
  field: Field;
  value: number;
  concept: boolean;
}

function topicHits(corpus: Corpus, m: MinorIndex, terms: Terms): Hit[] {
  const hits: Hit[] = [];
  for (const s of terms.stems) {
    const field: Field | null = m.fields.titel.stems.has(s) ? 'titel' : m.fields.beschrijving.stems.has(s) ? 'beschrijving' : null;
    if (field) hits.push({ label: terms.display.get(s) ?? s, field, value: FIELD_WEIGHTS[field] * idfWeight(corpus, s), concept: false });
  }
  for (const c of terms.concepts) {
    const field: Field | null = m.fields.titel.concepts.has(c) ? 'titel' : m.fields.beschrijving.concepts.has(c) ? 'beschrijving' : null;
    if (field) hits.push({ label: conceptLabel(c), field, value: FIELD_WEIGHTS[field] * CONCEPT_FACTOR, concept: true });
  }
  return hits.sort((a, b) => b.value - a.value);
}

export function profileCompleteness(profile: StudentProfile): number {
  let sum = 0;
  for (const id of TOPIC_IDS) {
    const st = profile.topics[id].status;
    if (st === 'beantwoord') sum += 1;
    else if (st === 'onzeker') sum += 0.5;
  }
  return sum / TOPIC_IDS.length;
}

const DAY = 24 * 60 * 60 * 1000;

export function certaintyFor(minor: Minor, profile: StudentProfile, now = Date.now()): CertaintyItem[] {
  const desc = minor.description?.trim() ?? '';
  const age = (now - Date.parse(minor.source.retrievedAt)) / DAY;
  const items: CertaintyItem[] = [
    { label: desc.length >= 150 ? 'Uitgebreide beschrijving aanwezig' : desc ? 'Beschrijving is kort' : 'Beschrijving ontbreekt', ok: desc.length >= 150, points: desc.length >= 150 ? 20 : desc ? 10 : 0, maxPoints: 20 },
    { label: minor.admission ? 'Toelatingseisen aanwezig' : 'Toelatingseisen ontbreken', ok: !!minor.admission, points: minor.admission ? 15 : 0, maxPoints: 15 },
    { label: minor.institution ? 'Onderwijsinstelling bekend' : 'Onderwijsinstelling onbekend', ok: !!minor.institution, points: minor.institution ? 10 : 0, maxPoints: 10 },
    { label: minor.ects != null ? 'Studiepunten bekend' : 'Studiepunten onbekend', ok: minor.ects != null, points: minor.ects != null ? 5 : 0, maxPoints: 5 },
    { label: minor.language ? 'Voertaal bekend' : 'Voertaal onbekend', ok: !!minor.language, points: minor.language ? 5 : 0, maxPoints: 5 },
    { label: minor.period || minor.location ? 'Periode of locatie bekend' : 'Periode en locatie onbekend', ok: !!(minor.period || minor.location), points: minor.period || minor.location ? 5 : 0, maxPoints: 5 },
    { label: minor.source.kind === 'detail' ? 'Gegevens van de eigen minorpagina' : 'Alleen gegevens uit de overzichtslijst', ok: minor.source.kind === 'detail', points: minor.source.kind === 'detail' ? 10 : 0, maxPoints: 10 },
    {
      label: Number.isNaN(age) ? 'Ophaaldatum onbekend' : age <= 60 ? 'Gegevens recent opgehaald' : age <= 180 ? 'Gegevens enkele maanden oud' : 'Gegevens ouder dan een half jaar',
      ok: age <= 60,
      points: Number.isNaN(age) ? 0 : age <= 60 ? 10 : age <= 180 ? 5 : 0,
      maxPoints: 10,
    },
  ];
  const pc = profileCompleteness(profile);
  items.push({ label: `Jouw profiel is voor ${Math.round(pc * 100)}% ingevuld`, ok: pc >= 0.8, points: Math.round(pc * 20), maxPoints: 20 });
  return items;
}

const STRICT_ADMISSION = /\b(alleen|uitsluitend|vereist|verplicht|voorkennis|niet toegankelijk|selectie|motivatiebrief|intake)\b/i;

export function recommend(corpus: Corpus, profile: StudentProfile, now = Date.now()): Recommendation[] {
  const topicTerms = new Map<TopicId, Terms>();
  for (const id of TOPIC_IDS) {
    const t = profile.topics[id];
    if (t.text.trim() && t.status !== 'overgeslagen') topicTerms.set(id, extractTerms(t.text));
  }
  const avoidTerms = profile.avoid.map((a) => ({ label: a, terms: extractTerms(a) }));
  // "niets met marketing" mag nooit als positieve match voor marketing tellen
  for (const terms of topicTerms.values()) {
    for (const a of avoidTerms) {
      for (const st of a.terms.stems) terms.stems.delete(st);
      for (const c of a.terms.concepts) terms.concepts.delete(c);
    }
  }
  const studyStems = profile.currentStudy ? tokenize(profile.currentStudy).map(stem) : [];

  const recs = corpus.minors.map((m): Recommendation => {
    const contributions: TopicContribution[] = [];
    const hitsByTopic = new Map<TopicId, Hit[]>();
    let weighted = 0;
    let weightSum = 0;
    for (const [topic, terms] of topicTerms) {
      if (terms.stems.size === 0 && terms.concepts.size === 0) continue;
      const hits = topicHits(corpus, m, terms);
      hitsByTopic.set(topic, hits);
      const raw = hits.reduce((s, h) => s + h.value, 0);
      const score = 1 - Math.exp(-raw / SATURATION);
      const weight = TOPIC_WEIGHTS[topic];
      weighted += weight * score;
      weightSum += weight;
      contributions.push({
        topic,
        label: TOPIC_LABELS[topic],
        weight,
        score,
        matchedTerms: [...new Set(hits.map((h) => (h.field === 'titel' ? `${h.label} (in titel)` : h.label)))].slice(0, 8),
      });
    }
    let match = weightSum > 0 ? weighted / weightSum : 0;

    const warnings: string[] = [];
    const reasons: string[] = [];
    const avoidHits: string[] = [];
    for (const a of avoidTerms) {
      const hit =
        [...a.terms.stems].some((s) => m.fields.titel.stems.has(s) || m.fields.beschrijving.stems.has(s)) ||
        [...a.terms.concepts].some((c) => m.fields.titel.concepts.has(c) || m.fields.beschrijving.concepts.has(c));
      if (hit) avoidHits.push(a.label);
    }
    if (avoidHits.length) {
      match *= AVOID_PENALTY;
      warnings.push(`Bevat iets wat je liever niet wilt: ${avoidHits.join(', ')}. Daarom is de matchscore gehalveerd.`);
    }

    const lang = normalize(m.minor.language ?? '');
    if (profile.languagePreference === 'en' && lang && !/engels|english/.test(lang)) warnings.push(`Je gaf de voorkeur aan Engelstalig onderwijs; de voertaal is ${m.minor.language}.`);
    if (profile.languagePreference === 'nl' && lang && !/nederlands|dutch/.test(lang)) warnings.push(`Je gaf de voorkeur aan Nederlandstalig onderwijs; de voertaal is ${m.minor.language}.`);

    if (!m.minor.admission) {
      warnings.push('Toelatingseisen ontbreken in de gegevens. Controleer de officiële pagina of vraag het na bij de instelling.');
    } else {
      const adm = normalize(m.minor.admission);
      if (studyStems.some((s) => s.length >= 3 && adm.includes(s))) reasons.push('Jouw opleiding wordt genoemd in de toelatingseisen.');
      if (STRICT_ADMISSION.test(m.minor.admission)) warnings.push('Er gelden specifieke toelatingseisen. Lees ze goed voordat je je aanmeldt.');
    }

    const sorted = [...contributions].filter((c) => c.matchedTerms.length).sort((a, b) => b.weight * b.score - a.weight * a.score);
    reasons.unshift(...sorted.slice(0, 3).map((c) => reasonFor(c.label, hitsByTopic.get(c.topic) ?? [])));

    const certainty = certaintyFor(m.minor, profile, now);
    const certaintyScore = Math.round(
      (100 * certainty.reduce((s, c) => s + c.points, 0)) / certainty.reduce((s, c) => s + c.maxPoints, 0),
    );
    const matchScore = Math.round(match * 100);
    const substantive = contributions.some((c) => c.topic !== 'opleiding' && c.matchedTerms.length > 0);
    if (!sorted.length) reasons.push('Er is geen duidelijke overeenkomst gevonden met wat je vertelde.');

    return {
      minor: m.minor,
      rank: 0,
      matchScore,
      certaintyScore,
      relevant: matchScore >= RELEVANCE_THRESHOLD && substantive,
      contributions,
      avoidHits,
      certainty,
      reasons,
      warnings,
    };
  });

  recs.sort((a, b) => b.matchScore - a.matchScore || b.certaintyScore - a.certaintyScore || a.minor.name.localeCompare(b.minor.name, 'nl'));
  recs.forEach((r, i) => (r.rank = i + 1));
  return recs;
}

export function counselorAdvice(profile: StudentProfile, recs: Recommendation[]): string | null {
  const pc = profileCompleteness(profile);
  const relevant = recs.filter((r) => r.relevant);
  const unsure = TOPIC_IDS.filter((id) => profile.topics[id].status === 'onzeker').length;
  if (recs.length === 0) return 'Er zijn nog geen minorgegevens beschikbaar. Een studieadviseur kan je helpen met het actuele aanbod.';
  if (pc < 0.5) return 'We weten nog weinig over je, dus de aanbevelingen zijn onzeker. Bespreek ze met een studieadviseur of decaan.';
  if (relevant.length === 0) return 'Er is geen minor gevonden die duidelijk bij je past. Een studieadviseur kan samen met je verder zoeken.';
  if (unsure >= 2) return 'Je twijfelde over meerdere onderwerpen. Een gesprek met een studieadviseur kan helpen om je keuze scherper te krijgen.';
  if (relevant[0].matchScore < 40 || relevant[0].certaintyScore < 50) return 'De beste match is niet erg sterk of de gegevens zijn onvolledig. Controleer de keuze met een studieadviseur.';
  return null;
}
