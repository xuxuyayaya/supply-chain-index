import { mkdir, writeFile } from 'node:fs/promises';
import { listCases, getCase, getIndex, getTrace } from '../server/catalog.mjs';

import { currentRecords, syncRecords } from '../server/record-store.mjs';

if (!await syncRecords()) throw new Error('GitHub data branch could not be read for the Pages release.');
const records = currentRecords();
const root = new URL('../frontend/data/', import.meta.url);
await mkdir(root, { recursive: true });
const write = (key, value) => writeFile(new URL(key + '.json', root), JSON.stringify(value));
await write('cases', listCases());
for (const entry of listCases()) {
  for (const period of entry.periods) {
    const detail = getIndex(entry.id, period, null, records);
    await write(entry.id + '-' + period, detail);
  }
  const parts = getCase(entry.id).traceParts.map(row => row.id);
  if (entry.id === 'kaifeng-auto') parts.push('all');
  for (const part of parts) {
    for (const period of entry.periods) {
      await write(entry.id + '-' + period + '-' + part, getTrace(entry.id, part, period, records));
    }
  }
}
