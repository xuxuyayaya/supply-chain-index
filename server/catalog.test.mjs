import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listCases, getCase, getIndex, getTrace } from './catalog.mjs';

test('Kaifeng reference example reproduces the published demonstration', () => {
  const demo = getCase('kaifeng-auto');
  assert.equal(demo.index.toFixed(1), '78.5');
  assert.deepEqual(demo.metrics.map(item => Math.round(item.value)), [85, 82, 28, 30]);
  assert.equal(demo.trade.total, 23);
  assert.equal(demo.trade.topFive.toFixed(1), '5.6');
});

test('all case periods retain balanced trade and valid part references', () => {
  for (const item of listCases()) {
    for (const period of item.periods) {
      const data = getCase(item.id, period);
      const categorySum = data.trade.categories.reduce((sum, row) => sum + row.amount, 0);
      assert.ok(Math.abs(categorySum - data.trade.total) < 0.0001);
      for (const part of data.traceParts) {
        const trace = getTrace(item.id, part.id);
        for (const edge of trace.edges) {
          const from = trace.nodes.find(node => node.id === edge.from);
          const to = trace.nodes.find(node => node.id === edge.to);
          assert.equal(from.tier, to.tier + 1);
        }
      }
    }
  }
});

test('unknown case, period and part remain distinguishable from valid data', () => {
  assert.equal(getCase('unknown'), null);
  assert.equal(getCase('kaifeng-auto', '2025-01'), null);
  assert.equal(getTrace('kaifeng-auto', 'steel'), null);
});


test('index assembles the score, trade and selected trace in one response', () => {
  const record = getIndex('kaifeng-auto', '2026-10', 'seat');
  assert.equal(record.index.toFixed(1), '78.5');
  assert.equal(record.trade.total, 23);
  assert.equal(record.trace.partId, 'seat');
  assert.ok(record.trace.nodes.every(node => node.city && node.position.every(Number.isFinite)));
  assert.equal(getIndex('kaifeng-auto', '2026-10', 'steel'), null);
});

test('monthly assessment reconciles stages, benchmarks, period change and procurement', () => {
  for (const c of listCases()) for (const p of c.periods) {
    const record = getCase(c.id, p);
    const coverage = record.metrics[0];
    assert.equal(record.stages.length, coverage.denominator);
    assert.equal(record.stages.filter(s => s.covered).length, coverage.numerator);
    const origins = record.trade.origins.reduce((sum,item) => sum + item.amount, 0);
    assert.ok(Math.abs(origins - record.trade.purchase) < 1e-8);
  }
  const v = getCase('kaifeng-auto');
  assert.equal(v.evaluation.development.toFixed(1), '78.0');
  assert.equal(v.evaluation.previous.score, getCase(v.id,'2026-09').index);
});

test('public trace preserves part scope, disclosure denominators and unlocated nodes', () => {
  const c = getCase('kaifeng-auto');
  assert.equal(c.traceParts.length, 13);
  const all = getTrace(c.id,'all');
  assert.equal(new Set(all.nodes.map(n=>n.id)).size, all.nodes.length);
  for (const e of all.edges) {
    assert.equal(e.from.split('/')[0], e.to.split('/')[0]);
    assert.ok(all.nodes.some(n=>n.id===e.from) && all.nodes.some(n=>n.id===e.to));
  }
  assert.ok(all.nodes.some(n => !n.position));
  for (const p of c.traceParts) assert.ok(getTrace(c.id,p.id).sources.length);
  const measured = getTrace(c.id,'exhaust').edges.find(e=>e.share===78.17);
  assert.equal(measured.year,2025);
  assert.match(measured.basis,/装车数量/);
});
