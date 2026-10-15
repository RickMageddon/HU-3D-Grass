import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatasetInfo, Minor } from '../../../shared/types.js';
import { buildCorpus, type Corpus } from '../match/score.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(here, '../../data');
export const DEFAULT_MINORS_FILE = path.join(DATA_DIR, 'minors.json');
export const SOURCE_URL = 'https://www.kiesopmaat.nl/modules/';

export interface MinorStore {
  minors: Minor[];
  corpus: Corpus;
  info: DatasetInfo;
  file: string;
}

export function datasetInfo(minors: Minor[]): DatasetInfo {
  const dates = minors.map((m) => m.source.retrievedAt).filter(Boolean).sort();
  return {
    count: minors.length,
    detailCount: minors.filter((m) => m.source.kind === 'detail').length,
    oldestRetrievedAt: dates[0] ?? null,
    newestRetrievedAt: dates.at(-1) ?? null,
    sourceUrl: SOURCE_URL,
  };
}

export function loadStore(file = process.env.MINORS_FILE ?? DEFAULT_MINORS_FILE): MinorStore {
  let minors: Minor[] = [];
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { minors?: Minor[] };
    minors = parsed.minors ?? [];
  }
  return { minors, corpus: buildCorpus(minors), info: datasetInfo(minors), file };
}
