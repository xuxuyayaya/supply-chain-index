import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listCases, getCase, getTrace } from './catalog.mjs';

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
