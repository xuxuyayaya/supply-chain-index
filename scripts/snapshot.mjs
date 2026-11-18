import { mkdir, writeFile } from 'node:fs/promises';
import { listCases, getCase, getIndex, getTrace } from '../server/catalog.mjs';

const root = new URL('../frontend/data/', import.meta.url);
await mkdir(root, { recursive: true });
const write = (key, value) => writeFile(new URL(key + '.json', root), JSON.stringify(value));
await write('cases', listCases());
for (const entry of listCases()) {
  for (const period of entry.periods) {
    const detail = getIndex(entry.id, period);
    await write(entry.id + '-' + period, detail);
  }
  for (const part of getCase(entry.id).traceParts) {
    await write(entry.id + '-' + part.id, getTrace(entry.id, part.id));
  }
}
