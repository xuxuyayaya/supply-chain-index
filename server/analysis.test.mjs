import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listCases, getIndex } from './catalog.mjs';
import { simulateDevelopment } from '../frontend/analysis-model.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('all monthly development assessments reconcile to the eight scoring inputs', () => {
  for (const entry of listCases()) for (const period of entry.periods) {
    const record = getIndex(entry.id, period);
    const model = record.analysis;
    assert.equal(model.version, '4.0');
    assert.equal(model.gap.metrics.length, 8);
    near(model.gap.metrics.reduce((sum, m) => sum + m.weight * m.viewWeight, 0), 1);
    near(model.development.components.reduce((sum, m) => sum + m.weight * m.score, 0), model.development.score);
    near(model.gap.metrics.reduce((sum, m) => sum + m.weight * m.viewWeight * m.score, 0), model.development.score);
    assert.equal(model.resilience.risks.length, model.resilience.bottleneckCount);
    assert.ok(model.resilience.bottleneckCount <= model.resilience.criticalCount);
    for (const peer of model.gap.peers) {
      assert.notEqual(peer.id, entry.id);
      assert.equal(peer.industry, record.industry);
      assert.equal(peer.period, record.period);
    }
    assert.ok(model.development.history.every(point => point.period <= period));
    if (model.development.previous) assert.ok(model.development.previous.period < period);
    const l = model.logistics;
    near(l.routes.reduce((sum, r) => sum + r.volume, 0), l.volume);
    near(l.inboundVolume + l.outboundVolume, l.volume);
    near(l.routes.filter(r => r.direction === '原料进货').reduce((sum,r) => sum + r.volume,0), l.inboundVolume);
    near(l.modes.reduce((sum, m) => sum + m.share, 0), 100);
    assert.ok(l.routes.every(r => r.volume >= 0));
  }
});

test('Kaifeng separates development total from supply and supports goal forecasting', () => {
  const record = getIndex('kaifeng-auto', '2026-10');
  near(record.analysis.development.score, 77.96);
  near(record.index, 78.5);
  near(record.analysis.logistics.score, 80.2);
  near(record.analysis.resilience.score, 75);
  const projection = simulateDevelopment(record.analysis, 'bottleneck', 10);
  near(projection.change, 4.5);
  near(projection.projected, 82.46);
  for (const m of record.analysis.gap.metrics) {
    near(simulateDevelopment(record.analysis, m.id, m.value).change, 0);
    for (const value of [0, 100]) {
      const result = simulateDevelopment(record.analysis, m.id, value);
      assert.ok(result.projected >= 0 && result.projected <= 100);
    }
  }
  for (const value of ['', 'invalid', -1, 101, Infinity])
    assert.throws(() => simulateDevelopment(record.analysis, 'bottleneck', value), RangeError);
  assert.throws(() => simulateDevelopment(record.analysis, 'unknown', 20), RangeError);
  assert.equal(getIndex('kaifeng-auto', '2026-09').analysis.development.previous, null);
  assert.doesNotMatch(record.analysis.assessment.headline, /计算|加权/);
});
