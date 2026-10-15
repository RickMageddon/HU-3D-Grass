// Eenvoudige, uitlegbare Nederlandse tekstverwerking: normaliseren, stopwoorden
// verwijderen, licht stemmen en begrippen (concepten) herkennen via een thesaurus.

const STOPWORDS = new Set(
  `de het een en of maar want dus dat die dit deze daar hier er ik je jij u wij we zij ze hij
  mij me mijn jouw jou uw ons onze hun hen haar zijn is was ben bent waren wordt worden werd
  heb hebt heeft hebben had hadden kan kun kunt kunnen zou zouden wil wilt willen moet moeten
  mag mogen ga gaat gaan doe doet doen deed vind vindt vinden vond lijkt leuk graag erg heel
  zeer best wel niet geen nog al ook toch even echt vooral meer minder veel weinig iets niets
  iemand alles alle elk elke ieder over op in uit aan bij met van voor naar om tot door tegen
  zonder onder boven tussen na als dan toen omdat zodat terwijl hoe wat wie waar wanneer waarom
  welke welk ja nee oke ok nou eh uh hmm zo zoals soort dingen ding beetje keer tijd jaar jaren
  later nu straks eigenlijk misschien denk denken weet weten ongeveer gewoon vaak soms altijd
  nooit eens samen zelf andere ander anders eerst laatste nieuwe nieuw goed groot klein mee
  the and of to in for with on at by an a is are be this that from as or it into your you
  minor minoren module modules student studenten studie hbo hogeschool opleiding ec ects`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Woorden die in een gesprek wel iets zeggen ("iets met mensen"), maar in bijna elke
 * minorbeschrijving staan en daardoor bij het matchen alleen ruis geven.
 */
const MATCH_STOPWORDS = new Set(
  `interessant interesse interesses leren leer leert geleerd helpen mensen mens leven werken werkt
  ontwikkelen ontwikkel kennis vaardigheid vaardigheden beter vind vond gedaan doet bezig vrije
  praktijk manier mogelijk belangrijk verschillende deel later willen`.split(/\s+/).filter(Boolean),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+#\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lichte stemmer: haalt veelvoorkomende Nederlandse/Engelse uitgangen weg. */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 4) return w;
  for (const suf of ['heden', 'ingen', 'ische', 'isch', 'iteit', 'ing', 'tjes', 'jes', 'en', 'es', 'ers', 'er', 's', 'e']) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  // dubbele medeklinker aan het eind (programmeer/programm -> program)
  if (/([bcdfgklmnprst])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Thesaurus van begrippen. Een begrip matcht als een van de varianten (als
 * woordbegin na stemmen) in de tekst voorkomt. Zo matcht "programmeren" met
 * "software" en "zorg" met "gezondheid". Bewust klein en controleerbaar gehouden.
 */
export const CONCEPTS: Record<string, string[]> = {
  ict: ['ict', 'informatica', 'software', 'programm', 'coder', 'developer', 'develop', 'app', 'computer', 'it'],
  data: ['data', 'dataset', 'statistiek', 'analyse', 'analytic', 'big data', 'dashboard', 'database'],
  ai: ['ai', 'artificial', 'kunstmatig', 'machine learning', 'deep learning', 'algoritm', 'neural', 'chatgpt', 'llm'],
  security: ['security', 'beveilig', 'cyber', 'hack', 'privacy'],
  games: ['game', 'gam', 'gaming', 'spel', 'esport', 'unity', 'unreal'],
  design: ['design', 'ontwerp', 'vormgev', 'ux', 'ui', 'grafisch', 'illustrat', 'tekenen', 'teken'],
  media: ['media', 'film', 'video', 'fotografie', 'foto', 'journalist', 'social media', 'vlog', 'podcast'],
  muziek: ['muziek', 'music', 'band', 'gitaar', 'piano', 'zingen', 'zang', 'produceren', 'dj'],
  kunst: ['kunst', 'art', 'creatief', 'creativ', 'theater', 'dans', 'cultuur', 'museum'],
  sport: ['sport', 'fitness', 'voetbal', 'hockey', 'hardlop', 'beweg', 'sporttrainer', 'personal trainer', 'coach', 'atleet', 'zwemm'],
  gezondheid: ['zorg', 'gezond', 'health', 'medisch', 'verpleeg', 'patient', 'ziekenhuis', 'fysio', 'voeding', 'welzijn', 'vitaliteit'],
  psychologie: ['psycholog', 'gedrag', 'mentaal', 'mentale', 'brein', 'motivatie', 'emotie'],
  sociaal: ['sociaal', 'social work', 'maatschappelijk', 'jeugd', 'jongeren', 'welzijn', 'hulpverlen', 'inclusie', 'diversiteit', 'armoede', 'vluchteling'],
  onderwijs: ['onderwijs', 'leraar', 'docent', 'lesgev', 'educatie', 'didactiek', 'pedagog', 'kinder'],
  business: ['business', 'bedrijf', 'bedrijfskunde', 'management', 'ondernem', 'startup', 'economie', 'commercie'],
  marketing: ['marketing', 'merk', 'brand', 'reclame', 'sales', 'verkoop', 'consument', 'campagne'],
  financien: ['financ', 'accountancy', 'boekhoud', 'geld', 'beleggen', 'bank', 'fintech', 'controlling'],
  recht: ['recht', 'juridisch', 'wet', 'law', 'advocaat', 'legal', 'criminolog', 'politie', 'veiligheid'],
  duurzaamheid: ['duurzaam', 'sustainab', 'klimaat', 'milieu', 'energie', 'energietransitie', 'circulair', 'natuur', 'biodiversiteit', 'co2'],
  techniek: ['techniek', 'technisch', 'technolog', 'engineer', 'werktuigbouw', 'elektro', 'mechatronica', 'robot', 'prototyp', '3d', 'printen'],
  bouw: ['bouwkunde', 'architect', 'stedenbouw', 'ruimtelijk', 'vastgoed', 'gebouw', 'civiel', 'infrastructuur', 'wonen'],
  logistiek: ['logistiek', 'supply chain', 'transport', 'mobiliteit', 'verkeer'],
  internationaal: ['internationaal', 'international', 'global', 'buitenland', 'reizen', 'talen', 'engels', 'exchange'],
  communicatie: ['communicatie', 'communication', 'presenter', 'schrijven', 'storytelling', 'pr', 'voorlichting'],
  innovatie: ['innovatie', 'innovat', 'design thinking'],
  hr: ['hr', 'personeel', 'human resource', 'recruit', 'werving', 'arbeid', 'leiderschap', 'leidinggev'],
  natuurwetenschap: ['biologie', 'chemie', 'scheikunde', 'natuurkunde', 'lab', 'laboratorium', 'life science', 'biotech', 'wiskunde'],
  voeding: ['voeding', 'food', 'koken', 'eten', 'horeca', 'hospitality', 'diëtist', 'dietist'],
  toerisme: ['toerisme', 'tourism', 'leisure', 'recreatie', 'event', 'evenement', 'hotel'],
  ethiek: ['ethiek', 'ethisch', 'filosofie', 'moraal', 'zingeving', 'levensbeschouw'],
};

/** Geeft per begrip de stemvarianten (enkele woorden) en de meerwoordsvarianten. */
const CONCEPT_INDEX = Object.entries(CONCEPTS).map(([id, variants]) => ({
  id,
  single: variants.filter((v) => !v.includes(' ')).map((v) => stem(normalize(v))),
  multi: variants.filter((v) => v.includes(' ')).map((v) => normalize(v)),
}));

export function conceptsIn(text: string): Set<string> {
  const norm = normalize(text);
  const stems = tokenize(text).map(stem);
  const found = new Set<string>();
  for (const c of CONCEPT_INDEX) {
    if (c.multi.some((m) => norm.includes(m))) {
      found.add(c.id);
      continue;
    }
    if (stems.some((s) => c.single.some((v) => (v.length <= 3 ? s === v : s.startsWith(v))))) {
      found.add(c.id);
    }
  }
  return found;
}

export interface Terms {
  stems: Set<string>;
  concepts: Set<string>;
  /** stem -> oorspronkelijk woord, voor uitleg. */
  display: Map<string, string>;
}

export function extractTerms(text: string): Terms {
  const display = new Map<string, string>();
  const stems = new Set<string>();
  for (const tok of tokenize(text)) {
    if (tok.length < 3 || MATCH_STOPWORDS.has(tok)) continue;
    const s = stem(tok);
    stems.add(s);
    if (!display.has(s)) display.set(s, tok);
  }
  return { stems, concepts: conceptsIn(text), display };
}
