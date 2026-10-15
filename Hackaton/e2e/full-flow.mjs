// End-to-end test in een echte Chromium-browser. Vereist een draaiende app met de
// FICTIEVE testdataset (zie README → Testen). Gebruik:
//   CHROME_PATH=/pad/naar/chrome BASE_URL=http://localhost:5173 node e2e/full-flow.mjs
import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH;

const SHOTS = process.argv[2] ?? 'test-results';
import fs from 'node:fs';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const errors = [];
async function session(name, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'nl-NL', permissions: [] });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto(BASE);
  await page.getByRole('button', { name: /start spraakgesprek/i }).waitFor();
  await page.screenshot({ path: `${SHOTS}/${name}-1-start.png`, fullPage: true });
  await page.getByRole('button', { name: /start spraakgesprek/i }).click();
  const log = page.getByRole('list', { name: /gespreksverloop/i });
  await log.getByText(/AI-assistent, dus geen mens/).waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/${name}-2-gesprek.png`, fullPage: true });
  const answers = [
    'Ik game graag en ik vind technologie en gezondheid interessant',
    'Ik studeer HBO-ICT, daarvoor deed ik havo',
    'Programmeren en data-analyse vond ik het leukst',
    'Ik heb een bijbaan als developer bij een webbureau',
    'Ik ben goed in programmeren en samenwerken',
    'Later wil ik software maken voor de zorg, bijvoorbeeld met AI',
    'Ik wil meer leren over machine learning en serious games, maar niets met marketing',
  ];
  for (const a of answers) {
    const input = page.getByLabel(/typ je antwoord/i);
    await input.fill(a);
    await input.press('Enter');
    await log.getByText(a, { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.msg-thinking'));
  }
  await page.getByRole('button', { name: /bekijk je aanbevelingen/i }).waitFor();
  await page.screenshot({ path: `${SHOTS}/${name}-3-klaar.png`, fullPage: true });
  await page.getByRole('button', { name: /bekijk je aanbevelingen/i }).click();
  await page.getByRole('heading', { name: 'Jouw minoren' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/${name}-4-resultaten.png`, fullPage: true });
  const cards = page.locator('.minor-card');
  console.log(name, 'kaarten:', await cards.count(), '|', (await page.locator('.results .lead').innerText()));
  for (let i = 0; i < await cards.count(); i++) console.log('  ', (await cards.nth(i).locator('h3').innerText()), '|', (await cards.nth(i).locator('.meter-value').allInnerTexts()).join(' / '));
  await cards.first().getByRole('button', { name: /toelatingseisen en scoreberekening/i }).click();
  await page.screenshot({ path: `${SHOTS}/${name}-5-details.png`, fullPage: true });
  await cards.nth(0).getByLabel('Vergelijk').check();
  await cards.nth(1).getByLabel('Vergelijk').check();
  await page.getByRole('button', { name: /^Vergelijk$/ }).click();
  await page.getByRole('heading', { name: 'Minoren vergelijken' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/${name}-6-vergelijk.png`, fullPage: false });
  await page.keyboard.press('Escape');
  await page.getByLabel(/toon ook minder passende/i).check();
  console.log(name, 'met minder passende:', await cards.count());
  await page.getByRole('button', { name: /hoe werken de scores/i }).click();
  await page.getByRole('heading', { name: /hoe werken de aanbevelingen/i }).waitFor();
  await page.screenshot({ path: `${SHOTS}/${name}-7-uitleg.png` });
  await ctx.close();
}
await session('desktop', { width: 1280, height: 900 });
await session('mobiel', { width: 390, height: 844 });
await browser.close();
console.log('console-fouten:', errors.length ? errors : 'geen');
if (errors.length) process.exit(1);
