import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listCases,getCase,getIndex} from './catalog.mjs';
import {scorePoints,scoreDomain,scoreSegments} from '../frontend/score-trend-model.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('all score histories contain twelve continuous months and preserve the existing anchors',()=>{
 for(const entry of listCases()){
  assert.equal(entry.periods.length,12);
  assert.equal(entry.periods[0],'2026-10');assert.equal(entry.periods.at(-1),'2025-11');
  const record=getIndex(entry.id,'2026-10');
  const history=record.analysis.development.history;
  for(const field of ['development','logistics','supply','resilience']){
   const points=scorePoints(history,field,{endPeriod:record.period});
   assert.equal(points.length,12);
   assert.equal(points[0].period,'2025-11');assert.equal(points.at(-1).period,'2026-10');
   const expected=field==='supply'?record.index:record.evaluation[field];
   near(points.at(-1).score,expected);
   const sept=scorePoints(history,field,{endPeriod:'2026-09'});
   assert.equal(sept.length,11);assert.equal(sept.at(-1).period,'2026-09');
   assert.equal(scorePoints(history,field,{endPeriod:'2025-11'}).length,1);
  }
  for(const metric of record.analysis.gap.metrics)near(scorePoints(history,'',{metricId:metric.id}).at(-1).score,metric.score);
  for(const peer of record.analysis.gap.peers){
   const points=scorePoints(record.analysis.gap.peerHistory[peer.id],'development',{endPeriod:record.period});
   assert.equal(points.length,12);near(points.at(-1).score,peer.development);
  }
 }
 const current=getCase('kaifeng-auto','2026-10');near(current.index,78.5);near(current.evaluation.logistics,80.2);near(current.evaluation.resilience,75);
 const first=getCase('kaifeng-auto','2025-11');assert.equal(first.evaluation.previous,null);
});

test('chart points keep zero, split missing months and never show future records',()=>{
 const history=[{period:'2026-03',supply:80},{period:'2026-01',supply:0},{period:'2026-04',supply:90},{period:'2026-13',supply:20}];
 const points=scorePoints(history,'supply',{endPeriod:'2026-03'});
 assert.deepEqual(points.map(p=>[p.period,p.score]),[['2026-01',0],['2026-02',null],['2026-03',80]]);
 assert.equal(points[2].change,null);assert.equal(scoreSegments(points).length,2);
 assert.deepEqual(scorePoints(history,'supply',{endPeriod:'2025-12'}),[]);
 for(const value of [0,50,100]){
  const [min,max]=scoreDomain([[{score:value}]]);
  assert.ok(min<=value&&max>=value&&max-min>=20&&min>=0&&max<=100);
 }
 const missing=scorePoints([{period:'2026-01',supply:null},{period:'2026-02',supply:NaN}],'supply');
 assert.ok(missing.every(p=>p.score===null));assert.deepEqual(scoreDomain([missing]),[0,100]);
});
