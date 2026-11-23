import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listCases,getIndex} from './catalog.mjs';
import {assembleResilienceCategories,selectResilienceCategories} from '../frontend/resilience-model.js';

test('the unified resilience list retains every critical category and its matching evidence',()=>{
 for(const entry of listCases())for(const period of entry.periods){
  const model=getIndex(entry.id,period).analysis.resilience;
  const rows=model.categories;
  assert.equal(rows.length,model.criticalCount);
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  assert.equal(new Set(rows.map(row=>row.label)).size,rows.length);
  assert.equal(rows.filter(row=>row.bottleneck).length,model.bottleneckCount);
  assert.equal(rows.reduce((total,row)=>total+row.alerts.length,0),model.alerts.length);
  for(const row of rows){
   assert.ok(row.suppliers.every(s=>s.goods===row.label));
   assert.ok(row.regions.every(r=>r.goods===row.label));
   assert.ok(row.alerts.every(a=>a.goods===row.label));
   assert.equal(row.attention,row.bottleneck||row.supplierAbnormal||row.regionAbnormal||row.alerts.length>0);
   if(!row.observation){assert.equal(row.suppliers.length,0);assert.equal(row.regions.length,0);}
  }
  const before=JSON.stringify(rows);
  const all=[];
  for(let page=1;page<=Math.ceil(rows.length/10);page++)all.push(...selectResilienceCategories(rows,{page}).rows);
  assert.equal(new Set(all.map(row=>row.id)).size,model.criticalCount);
  assert.equal(JSON.stringify(rows),before);
 }
});

test('three bottlenecks remain a subset of twenty categories, across filters, search and pages',()=>{
 const model=getIndex('suzhou-auto','2026-10').analysis.resilience;
 const rows=model.categories;
 assert.equal(selectResilienceCategories(rows).total,20);
 assert.equal(selectResilienceCategories(rows,{page:2}).rows.length,10);
 const attention=selectResilienceCategories(rows,{scope:'attention',page:99});
 assert.equal(attention.total,3);assert.equal(attention.page,1);
 assert.equal(selectResilienceCategories(rows,{scope:'alerts'}).total,rows.filter(row=>row.alerts.length).length);
 const first=rows.find(row=>row.suppliers.length);
 assert.ok(selectResilienceCategories(rows,{query:first.suppliers[0].label}).rows.some(row=>row.id===first.id));
 assert.ok(selectResilienceCategories(rows,{query:' '+first.label+' '}).rows.some(row=>row.id===first.id));
 const empty=selectResilienceCategories(rows,{query:'不存在的品类'});
 assert.equal(empty.total,0);assert.equal(empty.pages,1);assert.equal(empty.rows.length,0);
 const original=JSON.stringify(model);
 assert.deepEqual(assembleResilienceCategories(model),rows);
 assert.equal(JSON.stringify(model),original);
});
