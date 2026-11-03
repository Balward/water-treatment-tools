'use strict';
// Read workbook data and cached formula results only. VBA is never executed.
async function readApplicationWorkbook(file){
  if(file.size>10*1024*1024)throw Error('Choose a workbook smaller than 10 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer),decoder=new TextDecoder();let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw Error('This is not a supported Excel workbook.');
  const entries=new Map();let pos=view.getUint32(end+16,true),total=0;
  for(let i=0;i<view.getUint16(end+10,true);i++){
    if(view.getUint32(pos,true)!==0x02014b50)throw Error('Invalid workbook archive.');
    const method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),unpacked=view.getUint32(pos+24,true),length=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true),name=decoder.decode(bytes.slice(pos+46,pos+46+length));
    total+=unpacked;if(total>64*1024*1024)throw Error('Workbook contents are too large.');entries.set(name,{method,size,unpacked,offset});pos+=46+length+extra+comment;
  }
  const xml=async name=>{const entry=entries.get(name);if(!entry)throw Error('Workbook is missing '+name);const {offset,method,size,unpacked}=entry;if(view.getUint32(offset,true)!==0x04034b50)throw Error('Invalid workbook entry.');const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);let data=bytes.slice(start,start+size);if(method===8){if(typeof DecompressionStream==='undefined')throw Error('Workbook import needs a current browser with decompression support.');data=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}else if(method!==0)throw Error('Unsupported workbook compression.');if(data.length!==unpacked)throw Error('Workbook entry size is invalid.');const doc=new DOMParser().parseFromString(decoder.decode(data),'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid workbook XML.');return doc;};
  const elements=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
  const strings=entries.has('xl/sharedStrings.xml')?elements(await xml('xl/sharedStrings.xml'),'si').map(node=>elements(node,'t').map(t=>t.textContent).join('')):[];
  const book=await xml('xl/workbook.xml'),rels=elements(await xml('xl/_rels/workbook.xml.rels'),'Relationship'),sheets=new Map();
  for(const sheet of elements(book,'sheet')){
    const id=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),target=rels.find(r=>r.getAttribute('Id')===id)?.getAttribute('Target');if(!target)continue;
    const path=target.startsWith('/')?target.slice(1):'xl/'+target;
    const cells=new Map();for(const cell of elements(await xml(path),'c')){const raw=elements(cell,'v')[0]?.textContent||'',type=cell.getAttribute('t');cells.set(cell.getAttribute('r'),type==='s'?strings[Number(raw)]||'':type==='inlineStr'?elements(cell,'t').map(t=>t.textContent).join(''):raw);}
    sheets.set(sheet.getAttribute('name'),cells);
  }
  const dashboard=sheets.get('Dashboard');if(!dashboard)throw Error('Expected the Application Review Dashboard worksheet.');
  const state=ApplicationReview.blank();state.points=Object.fromEntries(['Yes','Maybe','No'].map((vote,i)=>[vote,Number(dashboard.get('B'+(i+4)))]));
  state.reviewers=Array.from({length:4},(_,i)=>sheets.get('Reviewer '+(i+1))?.get('B2')||'');
  for(let row=9;row<=108;row++){
    const name=dashboard.get('B'+row);if(!name?.trim())continue;
    const id=dashboard.get('A'+row),raw=dashboard.get('D'+row),applicant={id,name,state:dashboard.get('C'+row)||'',wage:raw===''||raw===undefined?null:Number(raw),licenses:dashboard.get('E'+row)||'',reviews:{},archived:false};
    for(let slot=0;slot<4;slot++){
      const sheet=sheets.get('Reviewer '+(slot+1));if(!sheet)continue;
      for(let r=7;r<=106;r++)if(sheet.get('A'+r)===id){const vote=sheet.get('G'+r)||'',notes=sheet.get('F'+r)||'';if(vote||notes)applicant.reviews[slot]={vote,notes,reviewerName:state.reviewers[slot],updatedAt:null};break;}
    }
    state.applicants.push(applicant);
  }
  if(!state.applicants.length)throw Error('No named applicants were found in the Dashboard.');
  return ApplicationReview.validate(state);
}
