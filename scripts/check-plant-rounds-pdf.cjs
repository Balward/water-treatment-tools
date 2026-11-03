const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),express=require('express');
const register=require('../plant-rounds-api'),template=require('../apps/plant-rounds/template.json');
const {removeTemporaryDirectory}=require('./lib/browser-check.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const {createCanvas}=require('@napi-rs/canvas');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'plant-rounds-pdf-'));let server;
  const at='2026-10-24T14:00:00.000Z',blankShift=()=>({operator:'',startedAt:null,completedAt:null,entries:{}});
  async function inspect(bytes,renderPrefix){
    assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
    const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false}),pdf=await loading.promise;
    try{
      let result='';
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i),content=await page.getTextContent();
        assert.equal(page.view[2],792);assert.equal(page.view[3],612,'Landscape letter paper');
        for(const item of content.items){if(!item.str.trim())continue;assert.ok(item.transform[4]>=20&&item.transform[4]+item.width<=773&&item.transform[5]>=0&&item.transform[5]<=612,'PDF text stays within page bounds: '+item.str);}
        result+=content.items.map(item=>item.str).join(' ')+'\n';
        if(renderPrefix && (i===1 || i===pdf.numPages)){
          const viewport=page.getViewport({scale:1.5}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
          await fs.writeFile(path.join(root,'preview',renderPrefix+'-'+i+'.png'),canvas.toBuffer('image/png'));
        }
      }
      return {text:result.replace(/\s+/g,' '),pages:pdf.numPages};
    }finally{await loading.destroy();}
  }
  try{
    const app=express();app.use(express.json());register(app,{directory:temp});server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port+'/api/plant-rounds/';
    await fs.mkdir(path.join(root,'preview'),{recursive:true});
    const day={version:1,date:'2026-10-24',updatedAt:at,shifts:{AM:blankShift(),PM:blankShift()},notes:[],history:[]};
    Object.assign(day.shifts.AM,{operator:'José Morning',startedAt:at});Object.assign(day.shifts.PM,{operator:'Evening Operator',startedAt:at});
    for(const [shift,id,value] of [['AM','B7',12.5],['AM','B10',0],['PM','B10',2],['AM','B12',false],['AM','B39',true],['PM','J39','na'],['AM','N28','Field comment start. '+('Inspect seals and rake alignment. '.repeat(45))+'Field comment end.']]){
      day.shifts[shift].entries[id]={value,revision:1,updatedBy:day.shifts[shift].operator,updatedAt:at};
    }
    day.notes=[{id:'pdf-long-note',text:'Long note start.\n'+('Follow up on the pump, chemical feed, and sample line before the next shift. '.repeat(40))+'\nLong note end.',operator:'José Morning',shift:'AM',location:'pump-room',createdAt:at,revision:1},{id:'pdf-unicode-note',text:'Chlorine 0.50 mg/L; temperature 18 °C; µg/L reference.\nSecond line of handoff.',operator:'Evening Operator',shift:'PM',location:'general',createdAt:at,revision:1}];
    const file=path.join(temp,day.date+'.json');await fs.writeFile(file,JSON.stringify(day));const before=await fs.readFile(file,'utf8');
    let response=await fetch(base+day.date+'/report.pdf');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/pdf/);assert.match(response.headers.get('content-disposition'),/^inline; filename="plant-rounds-2026-10-24.pdf"/);assert.match(response.headers.get('cache-control'),/no-store/);
    const bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(path.join(root,'preview/plant-rounds-partial.pdf'),bytes);
    const partial=await inspect(bytes,'plant-rounds-partial-page');
    assert.match(partial.text,/PARTIAL \/ IN PROGRESS/);assert.ok(partial.text.includes('José Morning'));assert.ok(partial.text.includes('0 2 Rotameter Flow (gpm)'),'Zero is printed as a recorded reading');assert.ok(partial.text.includes('No Leaks') && !partial.text.includes('(Y/N)'),'Explicit No survives PDF export');assert.ok(partial.text.includes('Done'));assert.ok(partial.text.includes('N/A'));
    for(const label of new Set(template.fields.map(field=>field.label)))assert.ok(partial.text.includes(label),'Includes checklist label: '+label);
    for(const text of ['Total Filter Flow (MGD)','CL2 Reading (mg/L)','North Pond Level (ft)','Field comment start.','Field comment end.','Long note start.','Long note end.','µg/L','Second line of handoff.'])assert.ok(partial.text.normalize('NFKC').includes(text.normalize('NFKC')),'Includes full text/units: '+text);
    assert.equal(await fs.readFile(file,'utf8'),before,'Preview does not modify records or mark rounds complete');
    const typical=structuredClone(day);
    typical.shifts.AM.entries.N28.value='Follow up on the north rake inspection.';
    typical.notes[0].text='North waste pump inspected. Check the seal again during PM rounds.';
    await fs.writeFile(file,JSON.stringify(typical));
    response=await fetch(base+day.date+'/report.pdf');const compact=Buffer.from(await response.arrayBuffer()),compactResult=await inspect(compact,'plant-rounds-two-page');
    assert.equal(compactResult.pages,2,'Partially completed rounds with ordinary notes fit two pages');
    assert.ok(compactResult.text.includes(typical.notes[0].text));assert.ok(compactResult.text.includes(typical.shifts.AM.entries.N28.value));
    await fs.writeFile(path.join(root,'preview/plant-rounds-two-page.pdf'),compact);
    response=await fetch(base+'2026-10-25/report.pdf');const blank=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);const blankResult=await inspect(blank);assert.equal(blankResult.pages,2,'Blank rounds fit two pages');assert.match(blankResult.text,/BLANK \/ NOT STARTED/);assert.deepEqual((await fs.readdir(temp)).sort(),['2026-10-24.json']);await fs.writeFile(path.join(root,'preview/plant-rounds-blank.pdf'),blank);
    response=await fetch(base+'2026-10-24/report.pdf?download=1');assert.match(response.headers.get('content-disposition'),/^attachment;/);
    response=await fetch(base+'2026-02-30/report.pdf');assert.equal(response.status,400,'Invalid dates are rejected');
    // Complete real records through the same API completion validation.
    for(const shift of ['AM','PM'])for(const field of template.fields.filter(field=>field.shifts.includes(shift) && field.required))day.shifts[shift].entries[field.id]={value:field.type==='check'?true:field.type==='yesno'?false:field.label.startsWith('Clarity')?3:0,revision:1,updatedBy:shift,updatedAt:at};
    day.notes=[];await fs.writeFile(file,JSON.stringify(day));
    for(const shift of ['AM','PM'])assert.equal((await fetch(base+day.date+'/'+shift+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operator:shift==='AM'?'Blaine Alward':'Kyle Heckman'})})).status,200);
    response=await fetch(base+day.date+'/report.pdf');const full=Buffer.from(await response.arrayBuffer()),fullResult=await inspect(full);
    assert.ok(fullResult.text.includes('COMPLETED ROUNDS')&&!fullResult.text.includes('PARTIAL / IN PROGRESS'));assert.ok(fullResult.text.includes('130 / 130'));assert.ok(fullResult.text.includes('100 / 100'));await fs.writeFile(path.join(root,'preview/plant-rounds-completed.pdf'),full);
    assert.equal(fullResult.pages,2,'Completed rounds fit two pages');
    const saveItem=async(path,method,body)=>{const result=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(result.status,200);return result.json();};
    const managed=await saveItem('items','POST',{operator:'Gene Hutson',revision:0,item:{label:'Managed Reading',unit:'NTU',section:'Added Checks',type:'number',location:'chemical-building',required:true,shifts:['AM']}});
    const custom=managed.fields.find(f=>f.label==='Managed Reading');
    await saveItem('2026-10-26/AM/entries/'+custom.id,'PUT',{operator:'Blaine Alward',revision:0,value:0.25});
    const newPdf=await inspect(Buffer.from(await (await fetch(base+'2026-10-26/report.pdf')).arrayBuffer()));assert.ok(newPdf.text.includes('Managed Reading (NTU)'));assert.ok(newPdf.text.includes('0.25'));
    await saveItem('items/'+custom.id,'DELETE',{operator:'Gene Hutson',revision:1});
    const retained=await inspect(Buffer.from(await (await fetch(base+'2026-10-26/report.pdf')).arrayBuffer()));assert.ok(retained.text.includes('Managed Reading (NTU)'));assert.ok(retained.text.includes('0.25'),'Removed item remains in saved PDF');
    const historic=await inspect(Buffer.from(await (await fetch(base+day.date+'/report.pdf')).arrayBuffer()));assert.ok(!historic.text.includes('Managed Reading'),'Earlier PDF retains original checklist');
    console.log('Passed: two-page blank/partial/completed reports, '+partial.pages+' pages for the long-note stress test, actual PDF parsing/rendering, all checklist labels, AM/PM values, zero/No/N/A, Unicode, full notes, pagination bounds, download headers and read-only snapshots.');
  }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await removeTemporaryDirectory(temp);}
})().catch(error=>{console.error(error);process.exitCode=1;});
