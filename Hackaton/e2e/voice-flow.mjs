// Spraakflow met gesimuleerde SpeechRecognition/speechSynthesis (headless heeft geen microfoon of stem).
// End-to-end test in een echte Chromium-browser. Vereist een draaiende app met de
// FICTIEVE testdataset (zie README → Testen). Gebruik:
//   CHROME_PATH=/pad/naar/chrome BASE_URL=http://localhost:5173 node e2e/voice-flow.mjs
import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  // Gesimuleerde stem: elke uiting "duurt" 1500 ms, cancel() breekt af.
  const log = (window.__log = []);
  let queue = [], timer = null;
  const synth = {
    speaking: false,
    getVoices: () => [{ name: 'Test Nederlands', lang: 'nl-NL' }],
    addEventListener() {}, removeEventListener() {},
    speak(u) { queue.push(u); log.push('spreek:' + u.text.slice(0, 40)); if (!timer) next(); },
    cancel() { const q = queue; queue = []; clearTimeout(timer); timer = null; synth.speaking = false; log.push('cancel'); q.forEach((u) => u.onerror?.({ error: 'interrupted' })); },
  };
  function next() { const u = queue[0]; if (!u) { timer = null; synth.speaking = false; return; } synth.speaking = true; timer = setTimeout(() => { queue.shift(); u.onend?.(); next(); }, 1500); }
  Object.defineProperty(window, 'speechSynthesis', { value: synth });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  // Gesimuleerde herkenning: zegt het volgende antwoord uit window.__answers.
  window.__answers = [];
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { log.push('luister'); window.__rec = this; setTimeout(() => this.onstart?.(), 10);
      const a = window.__answers.shift(); if (a) setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: a } }] }); this.onend?.(); }, 300); }
    stop() { this.onend?.(); } abort() { log.push('abort'); }
  };
});
await page.goto(BASE);
await page.evaluate(() => (window.__answers = ['Ik doe graag aan fotografie en reizen', 'Ik studeer Communicatie']));
await page.getByRole('button', { name: /start spraakgesprek/i }).click();
const log = page.getByRole('list', { name: /gespreksverloop/i });
await log.getByText('Ik studeer Communicatie').waitFor({ timeout: 20000 });
await page.waitForFunction(() => document.querySelector('.speaking'), null, { timeout: 5000 });
console.log('tijdens spreken zichtbaar:', await page.locator('.speaking').innerText());
// onderbreken: druk op de microfoon terwijl de assistent praat
await page.getByRole('button', { name: /druk om te onderbreken/i }).click();
await page.locator('.recording').waitFor();
console.log('opname-indicator:', await page.locator('.recording').innerText());
// spraakopdracht "begin opnieuw"
await page.evaluate(() => { const r = window.__rec; r.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'begin opnieuw' } }] }); r.onend(); });
await page.waitForTimeout(1500);
const msgs = await log.locator('.msg').allInnerTexts();
console.log('na "begin opnieuw":', msgs.length, 'bericht(en):', msgs[0]?.slice(0, 60));
console.log('log:', (await page.evaluate(() => window.__log)).join(' | '));
console.log('fouten:', errors.length ? errors : 'geen');
const ok = msgs.length === 1 && !errors.length;
console.log(ok ? 'OK' : 'MISLUKT');
if (!ok) process.exitCode = 1;
await browser.close();
