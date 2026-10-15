import { describe, expect, it } from 'vitest';
import { isModuleUrl, parseEcts, parseSavedPage } from '../src/importer/parse.js';
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE_DIR, fixtureMinors } from './helpers.js';

describe('importer voor opgeslagen Kies op Maat-pagina’s', () => {
  const minors = fixtureMinors();
  const byId = Object.fromEntries(minors.map((m) => [m.id, m]));

  it('leest het overzicht en de detailpagina’s en voegt ze samen', () => {
    expect(minors).toHaveLength(6);
    expect(minors.filter((m) => m.source.kind === 'detail')).toHaveLength(4);
  });

  it('leest de echte Kies op Maat-detailopbouw (section#main + section.detail)', () => {
    const m = byId['999001'];
    expect(m.name).toBe('[TEST] Robotica in de Zorg');
    expect(m.institution).toBe('Testhogeschool Midden');
    expect(m.url).toBe('https://www.kiesopmaat.nl/modules/tst/AB/999001/');
    expect(m.ects).toBe(30);
    expect(m.language).toBe('Engels');
    expect(m.location).toBe('Teststad');
    expect(m.period).toBe('1 sep 2026 t/m 31 jan 2027 (aanmelding gesloten); 1 feb 2027 t/m 30 jun 2027 (voltijd)');
    expect(m.admission).toBe('Alleen voor studenten Werktuigbouwkunde of HBO-ICT.');
    expect(m.description).toMatch(/robots/);
    expect(m.extraText).toMatch(/Thema's: Techniek, Zorg/);
    expect(m.parseWarnings).toContain('Aanmelden was niet mogelijk op het moment van opslaan.');
    // de naam van de docent is niet nodig en wordt niet opgeslagen
    expect(JSON.stringify(m)).not.toMatch(/Jansen/);
  });

  it('slaat modules over die geen minor zijn', () => {
    const html = fs.readFileSync(path.join(FIXTURE_DIR, 'kom-detail.html'), 'utf8').replace('<em>Minor</em>', '<em>Vak</em>');
    const page = parseSavedPage(html, 'x.html', '2026-01-01T00:00:00Z');
    expect(page.detail).toBeNull();
    expect(page.warnings[0]).toMatch(/geen minor/);
  });

  it('haalt velden uit koppen, definitielijsten en vetgedrukte labels', () => {
    const zorg = byId['test-data-zorg'];
    expect(zorg.institution).toBe('Testhogeschool Noord');
    expect(zorg.ects).toBe(30);
    expect(zorg.language).toBe('Nederlands');
    expect(zorg.admission).toMatch(/HBO-ICT/);
    expect(zorg.description).toMatch(/kunstmatige intelligentie/);
    expect(zorg.url).toBe('https://www.kiesopmaat.nl/modules/test-data-zorg/');

    const game = byId['test-game-design'];
    expect(game.language).toBe('Engels');
    expect(game.ects).toBe(15);
    expect(game.admission).toMatch(/alle hbo-studenten/);
    // instelling staat niet op de detailpagina maar wel in het overzicht
    expect(game.institution).toBe('Testhogeschool Zuid');
  });

  it('verzint niets: ontbrekende velden blijven leeg en worden gemeld', () => {
    const sport = byId['test-sport-gezondheid'];
    expect(sport.admission).toBeNull();
    expect(sport.ects).toBeNull();
    expect(sport.parseWarnings).toContain('Geen toelatingseisen gevonden.');
    const marketing = byId['test-marketing'];
    expect(marketing.source.kind).toBe('overzicht');
    expect(marketing.admission).toBeNull();
  });

  it('herkent de Anubis-beveiligingspagina en slaat die over', () => {
    const page = parseSavedPage('<html><title>Verifying your browser. Please wait a moment.</title><script id="anubis_challenge"></script></html>', 'x.html', '2026-01-01T00:00:00Z');
    expect(page.kind).toBe('onbekend');
    expect(page.warnings[0]).toMatch(/beveiligingspagina/);
  });

  it('weigert pagina’s die niet van kiesopmaat.nl komen', () => {
    const page = parseSavedPage('<!-- saved from url=(0020)https://example.com/x --><html><h1>Iets</h1></html>', 'x.html', '2026-01-01T00:00:00Z');
    expect(page.detail).toBeNull();
    expect(page.warnings[0]).toMatch(/niet van kiesopmaat/);
  });

  it('hulpfuncties', () => {
    expect(isModuleUrl('https://www.kiesopmaat.nl/modules/abc/')).toBe(true);
    expect(isModuleUrl('https://www.kiesopmaat.nl/modules/chw/BMR/145533/')).toBe(true);
    expect(parseEcts('15,0')).toBe(15);
    expect(isModuleUrl('https://www.kiesopmaat.nl/modules/')).toBe(false);
    expect(isModuleUrl('https://evil.example/modules/abc/')).toBe(false);
    expect(parseEcts('Omvang: 30 EC')).toBe(30);
    expect(parseEcts('15 studiepunten')).toBe(15);
    expect(parseEcts('geen getal')).toBeNull();
  });
});
