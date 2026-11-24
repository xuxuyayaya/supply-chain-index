import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listCases, getIndex } from './catalog.mjs';
import { simulateDevelopment } from '../frontend/analysis-model.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('all monthly development assessments reconcile to the eight scoring inputs', () => {
  for (const entry of listCases()) for (const period of entry.periods) {
    const record = getIndex(entry.id, period);
    const model = record.analysis;
    assert.equal(model.version, '5.3');
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
  assert.equal(getIndex('kaifeng-auto', '2025-11').analysis.development.previous, null);
  assert.doesNotMatch(record.analysis.assessment.headline, /计算|加权/);
});

test('all 23 indicators have complete monthly evidence and eight scoring flags', () => {
  for(const entry of listCases()) for(const period of entry.periods) {
    const data=getIndex(entry.id,period),a=data.analysis,all=a.indicators;
    assert.deepEqual(all.map(m=>m.ordinal),Array.from({length:23},(_,i)=>i+1));
    assert.equal(new Set(all.map(m=>m.id)).size,23);
    assert.deepEqual(['logistics','supply','resilience','gap'].map(view=>all.filter(m=>m.view===view).length),[9,6,5,3]);
    assert.equal(all.filter(m=>m.scoring).length,8);
    for(const item of all) {
      assert.ok(Number.isFinite(item.value));
      for(const key of ['name','definition','formula','calculation','summary']) assert.ok(item[key]?.length,item.id+' missing '+key);
      assert.ok(item.rows.length>0,item.id+' missing evidence');
      assert.ok(item.rows.every(row=>row.length===item.columns.length));
    }
    const volume=all.find(m=>m.ordinal===3).raw;
    near(volume.categories.reduce((sum,c)=>sum+c.value,0),volume.current);
    near(volume.categories.reduce((sum,c)=>sum+c.trips*c.capacity/10000,0),volume.current);
    const modes=all.find(m=>m.ordinal===5).raw;
    assert.equal(modes.modes.length,5);
    near(modes.modes.reduce((sum,m)=>sum+m.volume,0),modes.total);
    const loss=all.find(m=>m.ordinal===8);
    near(loss.raw.numerator/loss.raw.denominator*100,loss.value);
    near(100-20*loss.value,loss.scoring.score);
    const supplies=all.find(m=>m.ordinal===11).raw;
    near(supplies.suppliers.reduce((sum,s)=>sum+s.amount,0),data.trade.purchase);
    const gaps=all.find(m=>m.ordinal===16).raw;
    assert.equal(gaps.categories.length,a.resilience.criticalCount);
    assert.equal(gaps.categories.filter(c=>c.gap>0).length,a.resilience.bottleneckCount);
    near(gaps.categories.reduce((sum,c)=>sum+c.gap,0),gaps.shortages);
    assert.ok(a.resilience.supplierRisks.every(s=>Number.isInteger(s.late)));
    for(const row of a.resilience.regionalRisks) {
      near(row.current-row.previous,row.increase);
      assert.equal(row.alert,row.current>=60&&row.increase>=10);
    }
    for(const alert of a.resilience.alerts) assert.ok(alert.drop>=20||alert.region.alert);
    for(const peer of a.gap.peers) {
      const gdp=all.find(m=>m.ordinal===21).comparisons.find(c=>c.peerId===peer.id);
      const index=all.find(m=>m.ordinal===22).comparisons.find(c=>c.peerId===peer.id);
      near(gdp.value,(peer.addedValue-a.gap.current.addedValue)/peer.addedValue*100);
      near(index.value,peer.development-a.development.score);
    }
    const priorities=a.gap.problems.map(p=>p.priority);
    if(priorities.includes('高')) assert.equal(priorities[0],'高');
  }
});
