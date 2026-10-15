// Zet HTML-pagina's van kiesopmaat.nl die een mens in de browser heeft opgeslagen
// (Ctrl+S) om naar Minor-records. Dit is bewust heuristisch: het werkt op koppen
// en labels ("Toelatingseisen", "Voertaal", ...) in plaats van op vaste CSS-klassen,
// en legt vast welke velden niet gevonden zijn. Er wordt niets aangevuld of verzonnen.

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import crypto from 'node:crypto';
import type { Minor } from '../../../shared/types.js';

const BASE = 'https://www.kiesopmaat.nl';

const FIELD_PATTERNS: Array<[keyof SectionFields, RegExp]> = [
  ['admission', /toelating|ingangseis|instroomeis|voorwaarde|voorkennis|doelgroep|toegankelijk|voor wie|entry requirement|admission|prerequisite/i],
  ['ects', /^(ec|ects|studiepunten|credits|omvang|studielast)\b/i],
  ['language', /voertaal|^taal\b|instructietaal|language/i],
  ['period', /periode|start|semester|blok|aanvang|wanneer|looptijd|period/i],
  ['location', /locatie|plaats|stad|waar\b|location|campus/i],
  ['institution', /onderwijsinstelling|^instelling|aanbieder|hogeschool$|aangeboden door|institution|provider/i],
  ['description', /omschrijving|beschrijving|inhoud|over (deze|de) (minor|module)|introductie|inleiding|wat ga je|wat leer je|description|about/i],
];

interface SectionFields {
  description: string;
  admission: string;
  ects: string;
  language: string;
  period: string;
  location: string;
  institution: string;
}

const INSTITUTION_RE =
  /\b(Hogeschool [A-Z][\w'-]+(?: [A-Z][\w'-]+)?|De Haagse Hogeschool|Haagse Hogeschool|[A-Z][\w-]+ University of Applied Sciences|Fontys(?: Hogescholen)?|Avans(?: Hogeschool)?|Saxion|Windesheim|Inholland|HAN\b|Hanzehogeschool(?: Groningen)?|Hanze\b|NHL Stenden|Zuyd(?: Hogeschool)?|HZ University of Applied Sciences|Breda University of Applied Sciences|Aeres Hogeschool|Christelijke Hogeschool Ede|Driestar hogeschool|Hogeschool Viaa|Hogeschool iPabo|Marnix Academie|Thomas More Hogeschool|Codarts|ArtEZ|Willem de Kooning Academie|Gerrit Rietveld Academie|Design Academy Eindhoven|HKU|Hogeschool der Kunsten Den Haag|Amsterdamse Hogeschool voor de Kunsten|Van Hall Larenstein|HAS green academy|HAS Hogeschool|Wittenborg|Hotelschool The Hague)\b/;

export interface ParsedPage {
  url: string | null;
  kind: 'detail' | 'overzicht' | 'onbekend';
  detail: Minor | null;
  listed: Minor[];
  warnings: string[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function absolute(href: string, pageUrl: string | null): string | null {
  try {
    return new URL(href, pageUrl ?? BASE + '/modules/').toString().replace(/[?#].*$/, '');
  } catch {
    return null;
  }
}

/** /modules/<iets>/ maar niet /modules/ zelf. */
export function isModuleUrl(u: string): boolean {
  try {
    const url = new URL(u);
    // /modules/<id>/ of /modules/<instelling>/<afdeling>/<id>/, maar niet /modules/ zelf
    return /(^|\.)kiesopmaat\.nl$/.test(url.hostname) && /^\/modules\/[^/?#]+(\/[^/?#]+)*\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function pageUrlOf($: cheerio.CheerioAPI, html: string): string | null {
  const saved = html.match(/<!--\s*saved from url=\(\d+\)(\S+?)\s*-->/i)?.[1];
  const candidates = [saved, $('link[rel="canonical"]').attr('href'), $('meta[property="og:url"]').attr('content'), $('base').attr('href')];
  for (const c of candidates) if (c && /^https?:\/\//.test(c)) return c.replace(/[?#].*$/, '');
  return null;
}

function idFor(url: string | null, name: string, institution: string | null): string {
  if (url && isModuleUrl(url)) return new URL(url).pathname.split('/').filter(Boolean).at(-1)!;
  return crypto.createHash('sha1').update(`${name}|${institution ?? ''}`).digest('hex').slice(0, 12);
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'th', 'legend', 'summary']);
const BLOCK_TAGS = new Set(['p', 'li', 'dd', 'td', 'blockquote', 'pre', 'span', 'div', 'section', 'article', 'ul', 'ol', 'dl', 'table', 'tr', 'tbody', 'details', 'main']);

interface Block {
  heading: boolean;
  level: number;
  text: string;
}

/** Loopt de DOM in documentvolgorde af en maakt een platte lijst koppen/tekstblokken. */
function blocksOf($: cheerio.CheerioAPI, root: AnyNode): Block[] {
  const out: Block[] = [];
  const visit = (node: AnyNode) => {
    if (node.type !== 'tag') return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (HEADING_TAGS.has(tag)) {
      const t = clean($(el).text());
      if (t) out.push({ heading: true, level: /^h\d$/.test(tag) ? Number(tag[1]) : 5, text: t.replace(/:$/, '') });
      return;
    }
    const hasBlockChild = el.children.some((c) => c.type === 'tag' && (BLOCK_TAGS.has((c as Element).tagName) || HEADING_TAGS.has((c as Element).tagName)));
    if (!hasBlockChild) {
      // Label in de vorm "<strong>Voertaal:</strong> Nederlands"
      const first = el.children.find((c) => c.type === 'tag' || (c.type === 'text' && clean($(c).text())));
      if (first && first.type === 'tag' && ['strong', 'b'].includes((first as Element).tagName)) {
        const label = clean($(first).text());
        const rest = clean($(el).text().slice($(first).text().length));
        if (label && label.length < 60) {
          out.push({ heading: true, level: 6, text: label.replace(/:$/, '') });
          if (rest) out.push({ heading: false, level: 0, text: rest.replace(/^:\s*/, '') });
          return;
        }
      }
      const t = clean($(el).text());
      if (t) out.push({ heading: false, level: 0, text: t });
      return;
    }
    for (const c of el.children) {
      if (c.type === 'text') {
        const t = clean($(c).text());
        if (t) out.push({ heading: false, level: 0, text: t });
      } else visit(c);
    }
  };
  visit(root);
  return out;
}

function fieldFor(heading: string): keyof SectionFields | null {
  for (const [field, re] of FIELD_PATTERNS) if (re.test(heading)) return field;
  return null;
}

export function parseEcts(text: string): number | null {
  const m = text.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:ec|ects|studiepunten|credits)\b/i) ?? text.match(/^\s*(\d{1,2}(?:[.,]\d)?)\s*$/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return n > 0 && n <= 60 ? n : null;
}

function stripChrome($: cheerio.CheerioAPI) {
  $('script, style, noscript, template, svg, iframe, form, button, nav, header, footer, aside, [role="navigation"], [aria-hidden="true"], .cookie, #cookie, [class*="cookie"]').remove();
}

function parseListing($: cheerio.CheerioAPI, pageUrl: string | null, retrievedAt: string, file: string): Minor[] {
  const seen = new Map<string, Minor>();
  $('a[href]').each((_, a) => {
    const href = absolute($(a).attr('href')!, pageUrl);
    if (!href || !isModuleUrl(href) || seen.has(href)) return;
    const card = $(a).closest('li, article, tr, [class*="card"], [class*="result"], [class*="item"]');
    const scope = card.length ? card : $(a).parent();
    const name = clean($(a).find('h1,h2,h3,h4,h5').first().text()) || clean(scope.find('h1,h2,h3,h4,h5').first().text()) || clean($(a).text());
    if (!name || name.length < 3 || name.length > 200) return;
    const scopeText = clean(scope.text());
    const instEl = clean(scope.find('[class*="instelling"], [class*="institution"], [class*="school"], [class*="provider"]').first().text());
    const institution = instEl || scopeText.match(INSTITUTION_RE)?.[0] || null;
    const desc = scope
      .find('p')
      .toArray()
      .map((p) => clean($(p).text()))
      .filter((t) => t.length > 40 && t !== name)
      .join(' ');
    const warnings = ['Alleen gegevens uit de overzichtslijst; sla ook de eigen minorpagina op voor volledige informatie.'];
    if (!institution) warnings.push('Onderwijsinstelling niet gevonden.');
    seen.set(href, {
      id: idFor(href, name, institution),
      name,
      institution,
      description: desc || null,
      admission: null,
      extraText: null,
      url: href,
      ects: parseEcts(scopeText),
      language: null,
      period: null,
      location: null,
      source: { file, retrievedAt, kind: 'overzicht' },
      parseWarnings: warnings,
    });
  });
  return [...seen.values()];
}

function parseDetail($: cheerio.CheerioAPI, pageUrl: string | null, retrievedAt: string, file: string): Minor | null {
  const main = $('main').first().length ? $('main').first() : $('[role="main"], article, #content, .content').first().length ? $('[role="main"], article, #content, .content').first() : $('body');
  const name = clean(main.find('h1').first().text()) || clean($('h1').first().text());
  if (!name) return null;

  const blocks = blocksOf($, main.get(0)!);
  const fields: Partial<Record<keyof SectionFields, string[]>> = {};
  const extra: string[] = [];
  const intro: string[] = [];
  let current: keyof SectionFields | null = null;
  let seenH1 = false;
  let seenSectionHeading = false;
  for (const b of blocks) {
    if (b.heading) {
      if (b.level === 1) {
        seenH1 = true;
        continue;
      }
      seenSectionHeading = true;
      current = fieldFor(b.text);
      if (!current) extra.push(b.text + ':');
      continue;
    }
    if (current) (fields[current] ??= []).push(b.text);
    else if (seenH1 && !seenSectionHeading) intro.push(b.text);
    else extra.push(b.text);
  }
  const join = (k: keyof SectionFields) => (fields[k]?.length ? clean(fields[k]!.join(' ')) : null);
  const allText = clean(main.text());
  const warnings: string[] = [];

  let description = join('description');
  const introText = clean(intro.filter((t) => t.length > 30).join(' '));
  if (!description && introText) description = introText;
  else if (description && introText && !description.includes(introText)) description = `${introText} ${description}`;
  if (!description) warnings.push('Geen beschrijving gevonden.');

  const institution = join('institution') ?? allText.match(INSTITUTION_RE)?.[0] ?? null;
  if (!institution) warnings.push('Onderwijsinstelling niet gevonden.');
  const admission = join('admission');
  if (!admission) warnings.push('Geen toelatingseisen gevonden.');
  const ects = parseEcts(join('ects') ?? '') ?? parseEcts(allText);

  const url = pageUrl && isModuleUrl(pageUrl) ? pageUrl : null;
  if (!url) warnings.push('Officiële Kies op Maat-URL niet gevonden in het bestand.');

  return {
    id: idFor(url, name, institution),
    name,
    institution: institution ? institution.slice(0, 150) : null,
    description: description ? description.slice(0, 4000) : null,
    admission: admission ? admission.slice(0, 2000) : null,
    extraText: extra.length ? clean(extra.join(' ')).slice(0, 6000) : null,
    url: url ?? pageUrl ?? BASE + '/modules/',
    ects,
    language: join('language')?.slice(0, 80) ?? null,
    period: join('period')?.slice(0, 200) ?? null,
    location: join('location')?.slice(0, 120) ?? null,
    source: { file, retrievedAt, kind: 'detail' },
    parseWarnings: warnings,
  };
}

/** Hoofdletters netjes maken: "ZWOLLE" → "Zwolle". */
const titleCase = (t: string) => (t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()) : t);

/**
 * Extractor voor de detailpagina's van kiesopmaat.nl (opbouw gezien in oktober 2026):
 * section#main met h1, #description en secties onder h2.collapsible, en section.detail
 * met de instelling (a.inactive) en een lijst "Label: <em>waarde</em>".
 * De naam van de docent wordt bewust niet overgenomen (niet nodig voor de match).
 */
function parseKomDetail($: cheerio.CheerioAPI, pageUrl: string | null, retrievedAt: string, file: string): { minor: Minor | null; skip?: string } | null {
  const main = $('section#main');
  const detail = $('section.detail');
  if (!main.length || !detail.length) return null;
  const name = clean(main.find('h1').first().text());
  if (!name) return null;

  const facts = new Map<string, string>();
  detail.find('li').each((_, li) => {
    const own = clean($(li).contents().filter((_, n) => n.type === 'text').text()).replace(/\s*:\s*$/, '');
    const values = $(li)
      .find('em')
      .toArray()
      .map((e) => ({ text: clean($(e).text()), closed: $(e).hasClass('close') }));
    if (own && values.length) {
      // <em class="close">Gesloten</em> hoort bij de periode ervoor
      const parts: string[] = [];
      for (const v of values) {
        if (v.closed && parts.length) parts[parts.length - 1] += ' (aanmelding gesloten)';
        else if (!v.closed) parts.push(v.text);
      }
      facts.set(own.toLowerCase(), parts.join('; '));
    }
  });
  const type = facts.get('type') ?? null;
  if (type && !/minor/i.test(type)) return { minor: null, skip: `type "${type}", geen minor` };

  const links = detail.find('a.inactive').toArray().map((a) => clean($(a).text()));
  const institution = links[0] || null;

  const sections = new Map<string, string>();
  main.find('h2').each((_, h) => {
    const parts: string[] = [];
    let el = $(h).next();
    while (el.length && !el.is('h2')) {
      const t = clean(el.text());
      if (t) parts.push(t);
      el = el.next();
    }
    sections.set(clean($(h).text()).toLowerCase(), parts.join(' '));
  });
  const description = clean(main.find('#description').text()) || null;
  const admission = [...sections].find(([k]) => /ingangseis|toelating|voorwaarde/.test(k))?.[1] || null;
  const extra = [
    sections.get('leerdoelen') && `Leerdoelen: ${sections.get('leerdoelen')}`,
    facts.get("thema's") && `Thema's: ${facts.get("thema's")}`,
    facts.get('opleiding') && `Aangeboden door opleiding: ${facts.get('opleiding')}`,
    links[1] && `Onderdeel: ${links[1]}`,
    sections.get('rooster') && `Rooster: ${sections.get('rooster')}`,
    sections.get('toetsing') && `Toetsing: ${sections.get('toetsing')}`,
    sections.get('aanvullende informatie') && `Aanvullende informatie: ${sections.get('aanvullende informatie')}`,
  ].filter(Boolean);
  const vorm = facts.get('onderwijsvorm');
  const periods = facts.get('onderwijsperiodes');
  const period = [periods, vorm && `(${vorm.toLowerCase()})`].filter(Boolean).join(' ') || null;
  const notOpen = /niet mogelijk/i.test(clean($('section.action').text()));

  const warnings: string[] = [];
  if (!description) warnings.push('Geen beschrijving gevonden.');
  if (!admission) warnings.push('Geen toelatingseisen gevonden.');
  if (!institution) warnings.push('Onderwijsinstelling niet gevonden.');
  const url = pageUrl && isModuleUrl(pageUrl) ? pageUrl : null;
  if (!url) warnings.push('Officiële Kies op Maat-URL niet gevonden in het bestand.');
  if (notOpen) warnings.push('Aanmelden was niet mogelijk op het moment van opslaan.');

  return {
    minor: {
      id: idFor(url, name, institution),
      name,
      institution,
      description: description?.slice(0, 4000) ?? null,
      admission: admission?.slice(0, 2000) ?? null,
      extraText: extra.length ? extra.join(' ').slice(0, 6000) : null,
      url: url ?? pageUrl ?? BASE + '/modules/',
      ects: parseEcts(facts.get('aantal ec') ?? ''),
      language: facts.get('voertaal') ?? null,
      period: period?.slice(0, 200) ?? null,
      location: facts.get('plaats') ? titleCase(facts.get('plaats')!).slice(0, 120) : null,
      source: { file, retrievedAt, kind: 'detail' },
      parseWarnings: warnings,
    },
  };
}

export function parseSavedPage(html: string, file: string, retrievedAt: string): ParsedPage {
  const $ = cheerio.load(html);
  const url = pageUrlOf($, html);
  const warnings: string[] = [];
  if (url && !/kiesopmaat\.nl/.test(url)) warnings.push(`Pagina komt niet van kiesopmaat.nl (${url}); overgeslagen.`);
  if (/Verifying your browser|anubis_challenge/i.test(html)) {
    return { url, kind: 'onbekend', detail: null, listed: [], warnings: ['Dit is de beveiligingspagina, niet de minorpagina. Wacht in de browser tot de pagina geladen is en sla dan opnieuw op.'] };
  }
  if (warnings.length) return { url, kind: 'onbekend', detail: null, listed: [], warnings };

  const kom = parseKomDetail($, url, retrievedAt, file);
  if (kom) {
    if (!kom.minor) return { url, kind: 'onbekend', detail: null, listed: [], warnings: [`Overgeslagen: ${kom.skip}.`] };
    return { url, kind: 'detail', detail: kom.minor, listed: [], warnings: [] };
  }

  stripChrome($);
  const listed = parseListing($, url, retrievedAt, file);
  const detailLike = url ? isModuleUrl(url) : listed.length < 3;
  if (detailLike) {
    const detail = parseDetail($, url, retrievedAt, file);
    return { url, kind: detail ? 'detail' : 'onbekend', detail, listed: [], warnings: detail ? [] : ['Geen minornaam (h1) gevonden.'] };
  }
  return { url, kind: listed.length ? 'overzicht' : 'onbekend', detail: null, listed, warnings: listed.length ? [] : ['Geen links naar minoren gevonden.'] };
}

/** Voegt overzichts- en detailrecords samen; detailgegevens winnen, lege velden worden aangevuld uit het overzicht. */
export function mergeMinors(pages: ParsedPage[]): Minor[] {
  const byKey = new Map<string, Minor>();
  const keyOf = (m: Minor) => (isModuleUrl(m.url) ? m.url.replace(/\/?$/, '/') : `${m.name.toLowerCase()}|${(m.institution ?? '').toLowerCase()}`);
  for (const m of pages.flatMap((p) => p.listed)) if (!byKey.has(keyOf(m))) byKey.set(keyOf(m), m);
  for (const d of pages.map((p) => p.detail).filter((d): d is Minor => !!d)) {
    const k = keyOf(d);
    const prev = byKey.get(k);
    if (!prev || prev.source.kind === 'overzicht') {
      const merged: Minor = prev
        ? {
            ...d,
            institution: d.institution ?? prev.institution,
            description: (d.description?.length ?? 0) >= (prev.description?.length ?? 0) ? d.description : prev.description,
            ects: d.ects ?? prev.ects,
            parseWarnings: d.parseWarnings.filter((w) => !(w.startsWith('Onderwijsinstelling') && prev.institution)),
          }
        : d;
      byKey.set(k, merged);
    } else if (Date.parse(d.source.retrievedAt) > Date.parse(prev.source.retrievedAt)) {
      byKey.set(k, d);
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}
