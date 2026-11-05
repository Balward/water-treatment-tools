const {test}=require('node:test'),assert=require('node:assert/strict');
const math=require('../public/supply-trend-math'),{createApp}=require('../server');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const item={id:'test-item',description:'Test Reagent',itemNumber:'123',countSize:'Box',caseSize:'100 tests',par:2,sourceSheet:1};
function record(date,count,extra={}){return {id:date,worksheet:'operating',status:'complete',date,updatedAt:date+'T12:00:00Z',operator:'Blaine Alward',items:[item],counts:{[item.id]:count},...extra};}
test('supply trends isolate compatible completed counts, preserve zero, deduplicate dates and sort by inventory date',()=>{
  const records=[record('2026-09-01',10),record('2026-09-08',0),record('2026-09-15',5,{status:'draft'}),record('2026-09-22',20,{items:[{...item,countSize:'Each'}]}),record('2026-09-01',8,{updatedAt:'2026-10-01T12:00:00Z'}),record('2026-10-01',2,{worksheet:'janitorial'})];
  const result=math.series(item,records,'2026-09-01','2026-09-30');
  assert.deepEqual(result.points.map(p=>[p.date,p.count]),[['2026-09-01',8],['2026-09-08',0]]);assert.equal(result.incompatible,1);
});
test('PAR uses eligible net declines, excludes increasing intervals and long gaps, and requires sufficient evidence',()=>{
  const points=[['2026-09-01',12],['2026-09-08',10],['2026-09-15',8],['2026-09-22',20],['2026-09-29',18]].map(([date,count])=>({date,count}));
  const result=math.review(points);
  assert.equal(result.ready,true);assert.equal(result.decline,6);assert.equal(result.days,21);assert.equal(result.increases,1);assert.equal(result.rate,2/7);assert.equal(result.suggested,6);
  assert.equal(math.review(points,{lead:10,interval:7,buffer:25,increment:.5}).suggested,6.5);
  assert.equal(math.review(points.slice(0,3)).suggested,null);
  assert.equal(math.review(points.map(p=>({...p,count:5}))).suggested,null);
  const zero=math.review([...points,{date:'2026-10-06',count:0},{date:'2026-12-20',count:0}]);assert.equal(zero.zeros,2);assert.equal(zero.longGaps,1);
  assert.throws(()=>math.review(points,{increment:0}));
});
test('trends endpoint returns only completed operating snapshots and new page assets load',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'supply-trends-'));
  fs.writeFileSync(path.join(dir,'inventories.json'),JSON.stringify({inventories:[record('2026-09-01',4),record('2026-09-08',3,{status:'draft'}),record('2026-09-15',2,{worksheet:'janitorial'})]}));
  const server=createApp({dataDir:dir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base+'/api/supply-trends'),records=await response.json();assert.equal(records.length,1);assert.equal(records[0].counts[item.id],4);
  for(const file of ['trends.html','trends.js','trends.css','supply-trends.html','supply-trends.js','supply-trend-math.js','supply-trends.css'])assert.equal((await fetch(base+'/'+file)).status,200);
});
