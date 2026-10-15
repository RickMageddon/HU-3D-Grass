// Scenario's uit de opdracht: twijfelende student, ontbrekende informatie en
// meerdere passende minoren. (Niet-werkende spraak wordt in de client getest.)

import { describe, expect, it } from 'vitest';
import { TOPIC_IDS } from '../../shared/types.js';
import { TOPIC_SCRIPTS } from '../src/chat/topics.js';
import { buildCorpus, counselorAdvice, profileCompleteness, recommend } from '../src/match/score.js';
import { converse, fixtureMinors, NOW } from './helpers.js';

const corpus = buildCorpus(fixtureMinors());
const countQuestions = (s: string) => (s.match(/\?/g) ?? []).length;

describe('Scenario 1: twijfelende student', () => {
  const run = converse([
    'Ik weet het eigenlijk niet zo goed',
    'geen idee',
    'Ik studeer Verpleegkunde',
    'nee',
    'twijfel',
    'weet ik niet',
    'Ik werk in een verzorgingshuis als bijbaan',
    'Misschien iets met mensen, maar ik weet het nog niet',
    'weet ik niet',
    'geen idee',
    'Ik twijfel tussen zorg en techniek',
    'nee',
  ]);

  it('vraagt één keer door met hulpvoorbeelden en gaat daarna verder', () => {
    expect(run.turns[0].res.reply).toBe(TOPIC_SCRIPTS.interesses.help);
    expect(run.turns[1].res.reply).toMatch(/Geen probleem/);
    expect(run.profile.topics.interesses.status).toBe('onzeker');
  });

  it('stelt steeds hoogstens één vraag tegelijk', () => {
    for (const t of [run.greet, ...run.turns.map((x) => x.res)]) expect(countQuestions(t.reply)).toBeLessThanOrEqual(1);
  });

  it('gebruikt twijfel mét inhoud wel voor de match', () => {
    expect(run.profile.topics.voorkeuren.text).toMatch(/zorg en techniek/);
    expect(run.profile.topics.werkervaring.text).toMatch(/mensen/);
  });

  it('verwijst naar een studieadviseur', () => {
    const recs = recommend(corpus, run.profile, NOW);
    expect(counselorAdvice(run.profile, recs)).toMatch(/studieadviseur/);
  });
});

describe('Scenario 2: ontbrekende informatie', () => {
  const run = converse(['sport', 'toon de resultaten']);

  it('vraagt door bij een kaal antwoord van één woord', () => {
    expect(run.turns[0].res.reply).toMatch(/Wat spreekt je daar vooral in aan/);
  });

  it('kan op verzoek vroegtijdig naar de resultaten', () => {
    expect(run.last.action).toBe('results');
  });

  it('meldt lage profielvolledigheid, lagere zekerheid en adviseert een studieadviseur', () => {
    const recs = recommend(corpus, run.profile, NOW);
    expect(profileCompleteness(run.profile)).toBeLessThan(0.5);
    const sport = recs.find((r) => r.minor.id === 'test-sport-gezondheid')!;
    expect(sport.relevant).toBe(true);
    // geen toelatingseisen, geen instelling op de detailpagina, korte beschrijving → lage zekerheid
    expect(sport.certaintyScore).toBeLessThan(50);
    expect(sport.warnings.join(' ')).toMatch(/Toelatingseisen ontbreken/);
    expect(sport.certainty.find((c) => c.label.startsWith('Toelatingseisen'))!.ok).toBe(false);
    expect(counselorAdvice(run.profile, recs)).toMatch(/weinig over je/);
  });

  it('overgeslagen vragen worden niet opnieuw gesteld', () => {
    const r = converse(['Ik hou van muziek en gamen', 'sla over', 'sla over']);
    const asked = r.turns.map((t) => t.res.reply);
    expect(asked.filter((a) => a.includes(TOPIC_SCRIPTS.opleiding.question))).toHaveLength(1);
    expect(r.profile.topics.opleiding.status).toBe('overgeslagen');
    expect(r.profile.topics.vakken.status).toBe('overgeslagen');
  });
});

describe('Scenario 3: meerdere passende minoren', () => {
  const run = converse([
    'Ik game graag en ik vind technologie en gezondheid interessant',
    'Ik studeer HBO-ICT, daarvoor deed ik havo',
    'Programmeren en data-analyse vond ik het leukst',
    'Ik heb een bijbaan als developer bij een webbureau',
    'Ik ben goed in programmeren en samenwerken',
    'Later wil ik software maken voor de zorg, bijvoorbeeld met AI',
    'Ik wil meer leren over machine learning en serious games, maar niets met marketing',
  ]);
  const recs = recommend(corpus, run.profile, NOW);
  const relevant = recs.filter((r) => r.relevant);

  it('doorloopt alle onderwerpen zonder vragen te herhalen', () => {
    expect(run.last.action).toBe('results');
    for (const id of TOPIC_IDS) expect(run.profile.topics[id].status).toBe('beantwoord');
    const replies = run.turns.map((t) => t.res.reply);
    expect(new Set(replies).size).toBe(replies.length);
    expect(run.profile.currentStudy).toBe('HBO-ICT');
    expect(run.profile.avoid).toContain('marketing');
  });

  it('beveelt alle relevante minoren aan, gerangschikt van beste naar minder goede match', () => {
    expect(relevant.length).toBeGreaterThanOrEqual(2);
    expect(relevant[0].minor.id).toBe('test-data-zorg');
    expect(relevant.map((r) => r.minor.id)).toContain('test-game-design');
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].matchScore).toBeGreaterThanOrEqual(recs[i].matchScore);
    expect(recs.map((r) => r.rank)).toEqual(recs.map((_, i) => i + 1));
  });

  it('legt per minor uit waarom die past, met de woorden van de student', () => {
    const top = relevant[0];
    expect(top.reasons.length).toBeGreaterThan(0);
    expect(top.reasons.join(' ')).toMatch(/AI|data|zorg|programm/i);
    const sum = top.contributions.reduce((s, c) => s + c.weight * c.score, 0) / top.contributions.reduce((s, c) => s + c.weight, 0);
    expect(Math.round(sum * 100)).toBe(top.matchScore); // de getoonde uitsplitsing telt op tot de score
    expect(top.reasons.join(' ')).toMatch(/opleiding wordt genoemd in de toelatingseisen/);
  });

  it('verlaagt minoren met iets wat de student niet wil', () => {
    const marketing = recs.find((r) => r.minor.id === 'test-marketing')!;
    expect(marketing.avoidHits).toContain('marketing');
    expect(marketing.relevant).toBe(false);
  });

  it('volledige detailgegevens geven hogere informatiezekerheid dan alleen het overzicht', () => {
    const zorg = recs.find((r) => r.minor.id === 'test-data-zorg')!;
    const duurzaam = recs.find((r) => r.minor.id === 'test-duurzaam-ondernemen')!;
    expect(zorg.certaintyScore).toBeGreaterThanOrEqual(90);
    expect(duurzaam.certaintyScore).toBeLessThan(zorg.certaintyScore - 30);
  });
});

describe('Herkenning van de opleiding', () => {
  it('ziet een hobby niet aan voor een opleiding', () => {
    const r = converse(['Ik doe graag aan fotografie en reizen']);
    expect(r.profile.currentStudy).toBeNull();
    expect(r.last.reply).toContain(TOPIC_SCRIPTS.opleiding.question);
  });
  it('neemt een kort antwoord op de opleidingsvraag over als opleiding', () => {
    const r = converse(['Ik doe graag aan fotografie en reizen', 'Communicatie']);
    expect(r.profile.currentStudy).toBe('Communicatie');
    expect(r.last.reply).toContain(TOPIC_SCRIPTS.opleiding.second!.question);
  });
});

describe('Gespreksopdrachten', () => {
  it('begin opnieuw', () => {
    expect(converse(['Kunnen we opnieuw beginnen?']).last.action).toBe('restart');
  });
  it('herhaal de vraag', () => {
    expect(converse(['Kun je dat herhalen?']).last.reply).toContain(TOPIC_SCRIPTS.interesses.question);
  });
  it('opening vertelt dat de student met een AI praat en dat er niets wordt opgeslagen', () => {
    const g = converse(['x']).greet.reply;
    expect(g).toMatch(/AI-assistent/);
    expect(g).toMatch(/niet opgeslagen/);
  });
  it('lege dataset: geen aanbevelingen en wel een verwijzing', () => {
    const empty = buildCorpus([]);
    const run = converse(['Ik hou van tekenen en design']);
    expect(recommend(empty, run.profile)).toEqual([]);
    expect(counselorAdvice(run.profile, [])).toMatch(/geen minorgegevens/);
  });
});
