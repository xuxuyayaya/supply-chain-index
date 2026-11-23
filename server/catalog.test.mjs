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

test('city and industry metadata scopes each available assessment', () => {
  const entries = listCases();
  const cities = new Set(entries.map(item => item.cityId));
  assert.equal(cities.size, 3);
  for (const cityId of cities) {
    const industries = entries.filter(item => item.cityId === cityId);
    assert.ok(industries.length >= 2);
    assert.equal(new Set(industries.map(item => item.industryId)).size, industries.length);
    for (const item of industries) {
      const detail = getIndex(item.id);
      assert.equal(detail.cityId, cityId);
      assert.equal(detail.industry, item.industry);
      assert.ok(detail.trace.nodes.some(node => node.city + '市' === item.city));
    }
  }
});

test('assessment explains the current city and prioritizes supported improvements', () => {
  const data = getIndex('kaifeng-auto', '2026-10');
  assert.equal(data.assessment.headline, '供应基础较好，优先降低链主依赖');
  assert.match(data.assessment.summary, /提升 3.1 分/);
  assert.match(data.assessment.findings[0].text, /车规级芯片/);
  assert.match(data.assessment.findings[1].text, /外部采购 3.6 亿元/);
  assert.equal(data.assessment.actions[0].dimension, 'leader');
  assert.match(data.assessment.development.text, /距同业测算基准 4.0 分/);
  assert.doesNotMatch(JSON.stringify(data.assessment), /×|加权|计分|＝/);
  const older = getIndex('kaifeng-auto', '2026-09').assessment;
  assert.match(older.summary, /首个评价月份/);
  assert.match(older.findings[0].title, /4 个/);
  const changed = getIndex('suzhou-storage').assessment;
  assert.equal(changed.actions[0].dimension, 'local');
  assert.match(changed.summary, /苏州市储能装备/);
});
