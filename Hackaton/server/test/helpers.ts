import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyProfile, initialState, type ChatMessage, type ChatResponse, type StudentProfile } from '../../shared/types.js';
import { ruleTurn } from '../src/chat/ruleAgent.js';
import { mergeMinors, parseSavedPage } from '../src/importer/parse.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = path.join(here, 'fixtures/raw');
/** Vaste ophaaldatum zodat de actualiteitspunten in tests voorspelbaar zijn. */
export const RETRIEVED = '2026-10-01T10:00:00.000Z';
export const NOW = Date.parse('2026-10-15T10:00:00.000Z');

/** Fictieve testminoren, ingelezen via de echte importer. */
export function fixtureMinors() {
  const pages = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => parseSavedPage(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8'), f, RETRIEVED));
  return mergeMinors(pages);
}

/** Speelt een gesprek af met de ingebouwde gespreksleider. */
export function converse(answers: string[]) {
  let profile: StudentProfile = emptyProfile();
  let state = initialState();
  const history: ChatMessage[] = [];
  const turns: Array<{ user: string; res: ChatResponse }> = [];
  const greet = ruleTurn({ history, profile, state, userText: '' });
  history.push({ role: 'assistant', text: greet.reply });
  profile = greet.profile;
  state = greet.state;
  for (const a of answers) {
    const res = ruleTurn({ history, profile, state, userText: a });
    turns.push({ user: a, res });
    history.push({ role: 'user', text: a }, { role: 'assistant', text: res.reply });
    profile = res.profile;
    state = res.state;
    if (res.action !== 'none') break;
  }
  return { greet, turns, profile, state, history, last: turns.at(-1)!.res };
}
