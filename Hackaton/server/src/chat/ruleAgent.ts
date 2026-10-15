// Ingebouwde gespreksleider zonder LLM. Deterministisch, werkt offline en is
// daardoor ook de terugvaloptie als een LLM niet beschikbaar is.

import type { ChatRequest, ChatResponse, StudentProfile, TopicId } from '../../../shared/types.js';
import { tokenize } from '../match/text.js';
import { CLOSING, GREETING, nextOpenTopic, TOPIC_SCRIPTS } from './topics.js';

const UNSURE = /\b(weet\b.{0,25}\bniet|niet zo goed|geen (flauw )?idee|twijfel|lastig|moeilijk te zeggen|maakt (me )?(niet|niks) uit|geen voorkeur|ik weet niet|weet niet)\b/i;
const NEGATIVE = /^(nee|neen|nope|niet echt|niks|niets|geen|nog niet|helaas niet)\b/i;
const CMD_RESULTS = /\b(toon|laat|geef)\b.{0,20}\b(aanbeveling|resultat|minoren|minors|zien)|\bik ben klaar\b|\bnaar de resultaten\b/i;
const CMD_RESTART = /\b(begin opnieuw|opnieuw beginnen|start opnieuw|herstart|reset)\b/i;
const CMD_REPEAT = /\b(herhaal|wat zei je|nog een keer|kun je dat herhalen|wat was de vraag)\b/i;
const CMD_SKIP = /\b(sla (deze )?(vraag )?over|volgende vraag|wil ik niet (zeggen|beantwoorden)|liever niet)\b/i;

/** Woorden die twijfel uitdrukken maar niets over de student zeggen. */
const HESITATION = new Set(['twijfel', 'twijfelen', 'lastig', 'idee', 'flauw', 'misschien', 'tussen', 'eigenlijk', 'zeker', 'moeilijk', 'zeggen', 'uit', 'voorkeur', 'hoor', 'precies', 'beetje']);

const STUDY_RE = /\b(?:ik studeer|ik doe de (?:opleiding|studie)|ik volg de (?:opleiding|studie)|mijn (?:opleiding|studie) is|ik zit in jaar \d van)\s+(?:nu\s+)?([\p{L}0-9&+ -]{2,50}?)(?=\s+(?:aan|op|bij|in|bij de|en|maar|want)\b|[,.!?]|$)/iu;
const AVOID_RE = /\b(?:niets met|niks met|geen|hekel aan|niet zo van|liever geen|absoluut geen|niet in)\s+([\p{L} -]{3,40}?)(?=[,.!?]|$|\s+(?:en|maar|want|of|doen)\b)/giu;
const AMBITION_RE = /\b(later wil ik|wil (?:graag |later )?(?:\S+ )?worden|mijn droom|ambitie|na mijn studie wil ik)\b/i;
const WORK_RE = /\b(ik werk|bijbaan|stage gelopen|stage bij|vrijwilligerswerk|gewerkt|werk als|werk bij|parttime)\b/i;

function appendText(profile: StudentProfile, topic: TopicId, text: string, status: StudentProfile['topics'][TopicId]['status']) {
  const t = profile.topics[topic];
  t.text = [t.text, text].filter(Boolean).join(' | ');
  // 'beantwoord' wint van 'onzeker' als er later toch iets concreets komt
  if (t.status !== 'beantwoord') t.status = status;
}

export function extractSideInfo(profile: StudentProfile, text: string, currentTopic: TopicId | null) {
  const study = text.match(STUDY_RE)?.[1]?.trim();
  if (study && !profile.currentStudy) {
    profile.currentStudy = study;
    // De opleiding blijft 'open' zodat we nog alleen naar eerdere opleidingen vragen.
    if (currentTopic !== 'opleiding') profile.topics.opleiding.text = [profile.topics.opleiding.text, study].filter(Boolean).join(' | ');
  }
  if (/\b(engelstalig|in het engels|english)\b/i.test(text)) profile.languagePreference = 'en';
  else if (/\b(nederlandstalig|in het nederlands)\b/i.test(text)) profile.languagePreference = 'nl';
  for (const m of text.matchAll(AVOID_RE)) {
    const item = m[1].trim().replace(/\s+(doen|hebben|zijn)$/, '');
    // "geen idee" / "geen voorkeur" zijn geen afkeer van een onderwerp
    if (/^(idee|voorkeur|flauw|probleem|zin|tijd|ervaring|werkervaring|bijbaan)/i.test(item)) continue;
    if (tokenize(item).length && !profile.avoid.includes(item)) profile.avoid.push(item);
  }
  if (currentTopic !== 'ambities' && profile.topics.ambities.status === 'open' && AMBITION_RE.test(text)) appendText(profile, 'ambities', text, 'beantwoord');
  if (currentTopic !== 'werkervaring' && profile.topics.werkervaring.status === 'open' && WORK_RE.test(text)) appendText(profile, 'werkervaring', text, 'beantwoord');
}

const ACKS = ['Dank je.', 'Duidelijk, dank je.', 'Leuk om te horen.', 'Helder.', 'Goed om te weten.', 'Mooi.'];

function ask(profile: StudentProfile, prefix: string, turn: number): Pick<ChatResponse, 'reply' | 'state' | 'action'> {
  const next = nextOpenTopic(profile);
  if (!next) return { reply: `${prefix} ${CLOSING}`.trim(), state: { currentTopic: null, followUps: 0, done: true }, action: 'results' };
  const ack = prefix || ACKS[turn % ACKS.length];
  const question =
    next === 'opleiding' && profile.currentStudy
      ? `Je vertelde al dat je ${profile.currentStudy} studeert. ${TOPIC_SCRIPTS.opleiding.second!.question}`
      : TOPIC_SCRIPTS[next].question;
  const known = next === 'opleiding' && !!profile.currentStudy;
  return { reply: `${ack} ${question}`, state: { currentTopic: next, followUps: known ? 1 : 0, done: false }, action: 'none' };
}

export function ruleTurn(req: ChatRequest): ChatResponse {
  const profile: StudentProfile = structuredClone(req.profile);
  const state = { ...req.state };
  const text = req.userText.trim();
  const turn = req.history.filter((m) => m.role === 'user').length;
  const base = { profile, engine: 'regels' as const };

  if (req.history.length === 0 && !text) {
    const first = nextOpenTopic(profile) ?? 'interesses';
    return { ...base, reply: `${GREETING} Eerste vraag: ${TOPIC_SCRIPTS[first].question}`, state: { currentTopic: first, followUps: 0, done: false }, action: 'none' };
  }

  const topic = state.currentTopic;
  const script = topic ? TOPIC_SCRIPTS[topic] : null;

  if (CMD_RESTART.test(text)) return { ...base, reply: 'Prima, we beginnen opnieuw.', state, action: 'restart' };
  if (CMD_RESULTS.test(text)) {
    return { ...base, reply: 'Goed, ik laat je zien welke minoren passen bij wat je tot nu toe hebt verteld.', state: { ...state, done: true }, action: 'results' };
  }
  if (!text || CMD_REPEAT.test(text)) {
    const q = script?.question ?? 'Waar wil je het over hebben?';
    return { ...base, reply: text ? `Natuurlijk. ${q}` : `Ik heb niets gehoord. ${q}`, state, action: 'none' };
  }

  extractSideInfo(profile, text, topic);

  if (!topic) return { ...base, ...ask(profile, '', turn) };

  if (CMD_SKIP.test(text)) {
    profile.topics[topic].status = 'overgeslagen';
    return { ...base, ...ask(profile, 'Dat is helemaal goed, die slaan we over.', turn) };
  }

  const contentWords = tokenize(text).filter((w) => !HESITATION.has(w)).length;
  const unsure = UNSURE.test(text);
  const negative = NEGATIVE.test(text) && contentWords <= 1;
  const alreadyAnswered = profile.topics[topic].status === 'beantwoord';

  if (unsure && contentWords === 0) {
    if (state.followUps === 0) {
      appendText(profile, topic, '', 'onzeker');
      return { ...base, reply: script!.help, state: { ...state, followUps: 1 }, action: 'none' };
    }
    appendText(profile, topic, '', 'onzeker');
    return { ...base, ...ask(profile, alreadyAnswered ? 'Prima.' : 'Geen probleem, dat mag je ook nog niet weten. We gaan verder.', turn) };
  }

  if (negative) {
    // "Nee" is een geldig antwoord op werkervaring, eerdere opleiding en vervolgvragen; anders vragen we één keer door.
    const validNo = alreadyAnswered || topic === 'werkervaring' || (topic === 'opleiding' && !!profile.currentStudy);
    if (validNo || state.followUps > 0) {
      appendText(profile, topic, '', validNo ? 'beantwoord' : 'onzeker');
      return { ...base, ...ask(profile, 'Oké, helder.', turn) };
    }
    return { ...base, reply: script!.help, state: { ...state, followUps: 1 }, action: 'none' };
  }

  if (contentWords === 0 && state.followUps === 0) {
    return { ...base, reply: `Ik begreep je antwoord niet helemaal. ${script!.help}`, state: { ...state, followUps: 1 }, action: 'none' };
  }

  // Twijfel met inhoud ("ik twijfel tussen zorg en techniek") is wel bruikbaar.
  appendText(profile, topic, text, 'beantwoord');
  // Kort antwoord op "Welke opleiding doe je nu?" is de naam van de opleiding.
  if (topic === 'opleiding' && !profile.currentStudy && state.followUps === 0 && text.split(/\s+/).length <= 5) {
    profile.currentStudy = text.replace(/^(ik doe|ik studeer|de opleiding|opleiding)\s+/i, '').replace(/[.!]$/, '');
  }

  if (state.followUps === 0) {
    if (contentWords === 1 && script!.elaborate) {
      return { ...base, reply: `Interessant. ${script!.elaborate}`, state: { ...state, followUps: 1 }, action: 'none' };
    }
    if (script!.second && !script!.second.skipIf.test(text)) {
      return { ...base, reply: `${ACKS[turn % ACKS.length]} ${script!.second.question}`, state: { ...state, followUps: 1 }, action: 'none' };
    }
  }
  return { ...base, ...ask(profile, '', turn) };
}
