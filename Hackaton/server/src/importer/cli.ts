// Gebruik: npm run import [-- <map met opgeslagen .html-bestanden, bijv. ~/Downloads>]
// Leest pagina's die je zelf via de browser van kiesopmaat.nl hebt opgeslagen en
// schrijft server/data/minors.json. Er wordt niets van internet opgehaald.

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DEFAULT_MINORS_FILE, SOURCE_URL } from '../minors/store.js';
import { mergeMinors, parseSavedPage, type ParsedPage } from './parse.js';

const dir = path.resolve((process.argv[2] ?? path.join(DATA_DIR, 'raw')).replace(/^~(?=\/|$)/, process.env.HOME ?? '~'));
const out = process.env.MINORS_FILE ?? DEFAULT_MINORS_FILE;

function htmlFiles(d: string): string[] {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name.endsWith('_files') ? [] : htmlFiles(p);
    return /\.html?$/i.test(e.name) ? [p] : [];
  });
}

const files = htmlFiles(dir);
if (!files.length) {
  console.error(`Geen .html-bestanden gevonden in ${dir}.\nSla pagina's van ${SOURCE_URL} op via je browser (Ctrl+S) in die map en probeer opnieuw.`);
  process.exit(1);
}

const pages: ParsedPage[] = [];
let skipped = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  // Buiten de eigen raw-map (bijv. ~/Downloads) alleen bestanden van kiesopmaat.nl lezen.
  if (!html.includes('kiesopmaat.nl') && !/anubis_challenge|Verifying your browser/i.test(html)) {
    skipped++;
    continue;
  }
  const retrievedAt = fs.statSync(f).mtime.toISOString();
  const page = parseSavedPage(html, path.relative(dir, f), retrievedAt);
  pages.push(page);
  const what = page.kind === 'detail' ? `minorpagina: ${page.detail!.name}` : page.kind === 'overzicht' ? `overzicht: ${page.listed.length} minoren` : 'niet herkend';
  console.log(`- ${path.relative(dir, f)} → ${what}`);
  for (const w of [...page.warnings, ...(page.detail?.parseWarnings ?? [])]) console.log(`    ! ${w}`);
}

if (skipped) console.log(`(${skipped} bestand(en) overgeslagen: niet van kiesopmaat.nl)`);
if (!pages.length) {
  console.error('Geen pagina\'s van kiesopmaat.nl gevonden. Bestaande gegevens zijn niet aangepast.');
  process.exit(1);
}

const minors = mergeMinors(pages);
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), sourceUrl: SOURCE_URL, minors }, null, 2));
const detail = minors.filter((m) => m.source.kind === 'detail').length;
console.log(`\n${minors.length} minoren geschreven naar ${path.relative(process.cwd(), out)} (${detail} met eigen minorpagina, ${minors.length - detail} alleen uit overzicht).`);
