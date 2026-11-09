#!/usr/bin/env node
// Read-only DOCX conversion. No Office automation, network calls, or dependencies.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join,resolve,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import model from './sop-model.cjs';

const NS={w:'http://schemas.openxmlformats.org/wordprocessingml/2006/main',r:'http://schemas.openxmlformats.org/officeDocument/2006/relationships',a:'http://schemas.openxmlformats.org/drawingml/2006/main',mc:'http://schemas.openxmlformats.org/markup-compatibility/2006'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const local=name=>name.split(':').at(-1);
const attr=(node,key)=>Object.entries(node.attrs||{}).find(([k])=>local(k)===key)?.[1];
const children=node=>(node.children||[]).filter(n=>typeof n!=='string');
const named=(node,name)=>node?.ns===NS.w&&node.local===name;
function active(node){
  if(node.ns===NS.mc&&node.local==='AlternateContent')return children(node).find(n=>n.local==='Choice')?.children||children(node).find(n=>n.local==='Fallback')?.children||[];
  return node.children||[];
}
function all(node,predicate,result=[]){
  if(predicate(node))result.push(node);
  for(const n of active(node))if(typeof n!=='string')all(n,predicate,result);
  return result;
}
const text=node=>active(node).map(n=>typeof n==='string'?n:text(n)).join('');
function decode(s){return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>entity[0]==='#'?String.fromCodePoint(parseInt(entity.slice(entity[1]?.toLowerCase()==='x'?2:1),entity[1]?.toLowerCase()==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity]));}
export function parseXml(xml){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DTD/entity declarations are not supported.');
  const root={children:[],namespaces:{}},stack=[root];let i=0;
  while(i<xml.length){
    const parent=stack.at(-1);
    if(xml[i]!=='<'){const end=xml.indexOf('<',i),stop=end<0?xml.length:end;parent.children.push(decode(xml.slice(i,stop)));i=stop;continue;}
    if(xml.startsWith('<!--',i)){const end=xml.indexOf('-->',i+4);if(end<0)throw Error('Malformed XML comment.');i=end+3;continue;}
    if(xml.startsWith('<?',i)){const end=xml.indexOf('?>',i+2);if(end<0)throw Error('Malformed XML declaration.');i=end+2;continue;}
    if(xml.startsWith('<![CDATA[',i)){const end=xml.indexOf(']]>',i+9);if(end<0)throw Error('Malformed CDATA.');parent.children.push(xml.slice(i+9,end));i=end+3;continue;}
    let end=i+1,quote='';
    for(;end<xml.length;end++){const c=xml[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
    if(end===xml.length)throw Error('Malformed XML tag.');
    const tag=xml.slice(i+1,end);i=end+1;
    if(tag[0]==='/'){if(stack.length<2||stack.pop().name!==tag.slice(1).trim())throw Error('Mismatched XML tags.');continue;}
    const name=/^[\w:.-]+/.exec(tag)?.[0];if(!name)throw Error('Invalid XML tag.');
    const attrs={};for(const match of tag.slice(name.length).matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[match[1]]=decode(match[2]??match[3]);
    const namespaces={...parent.namespaces};for(const [key,value]of Object.entries(attrs))if(key==='xmlns')namespaces['']=value;else if(key.startsWith('xmlns:'))namespaces[key.slice(6)]=value;
    const node={name,local:local(name),ns:namespaces[name.includes(':')?name.split(':')[0]:''],attrs,children:[],namespaces};parent.children.push(node);
    if(!tag.trimEnd().endsWith('/'))stack.push(node);
    if(stack.length>300)throw Error('XML nesting is too deep.');
  }
  if(stack.length!==1)throw Error('Unclosed XML tag.');return children(root)[0];
}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
export function unzip(buffer){
  if(buffer.length>64000000)throw Error('Choose a DOCX under 64 MB.');
  let eocd=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50&&i+22+buffer.readUInt16LE(i+20)===buffer.length){eocd=i;break;}
  if(eocd<0)throw Error('Not a valid DOCX ZIP archive.');
  const count=buffer.readUInt16LE(eocd+10),offset=buffer.readUInt32LE(eocd+16);
  if(buffer.readUInt16LE(eocd+4)!==0||buffer.readUInt16LE(eocd+6)!==0||count===65535||offset===0xffffffff||count>3000)throw Error('Multipart, ZIP64, or oversized archives are not supported.');
  let p=offset,total=0;const entries=new Map();
  for(let i=0;i<count;i++){
    if(p+46>eocd||buffer.readUInt32LE(p)!==0x02014b50)throw Error('Invalid ZIP directory.');
    const flags=buffer.readUInt16LE(p+8),method=buffer.readUInt16LE(p+10),crc=buffer.readUInt32LE(p+16),compressed=buffer.readUInt32LE(p+20),size=buffer.readUInt32LE(p+24),nl=buffer.readUInt16LE(p+28),extra=buffer.readUInt16LE(p+30),comment=buffer.readUInt16LE(p+32),start=buffer.readUInt32LE(p+42);
    if(p+46+nl+extra+comment>eocd)throw Error('Invalid ZIP name.');
    const name=buffer.toString('utf8',p+46,p+46+nl);p+=46+nl+extra+comment;
    if(flags&1||![0,8].includes(method)||size>24000000||(total+=size)>120000000)throw Error('Encrypted, unsupported, or oversized DOCX content.');
    if(name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||entries.has(name))throw Error('Unsafe or duplicate archive path.');
    if(start+30>offset||buffer.readUInt32LE(start)!==0x04034b50)throw Error('Invalid ZIP entry.');
    const dataStart=start+30+buffer.readUInt16LE(start+26)+buffer.readUInt16LE(start+28);
    if(dataStart+compressed>offset)throw Error('Invalid ZIP content bounds.');
    const packed=buffer.subarray(dataStart,dataStart+compressed),bytes=method===0?Buffer.from(packed):inflateRawSync(packed,{maxOutputLength:24000000});
    if(bytes.length!==size||crc32(bytes)!==crc)throw Error('Corrupt DOCX content: '+name);
    entries.set(name,bytes);
  }
  return entries;
}
function paragraphText(node){
  if(['drawing','pict','txbxContent','del'].some(k=>named(node,k)))return '';
  if(named(node,'t'))return text(node);
  if(named(node,'tab'))return '\t';if(named(node,'br')||named(node,'cr'))return '\n';
  return active(node).map(n=>typeof n==='string'?'':paragraphText(n)).join('');
}
const figure=s=>/^figure\s*(\d+)\s*[.:]?$/i.exec(s.trim())?.[1];
function imageType(bytes){
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpeg';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';
  return null;
}
export function inspectDocx(buffer){
  const entries=unzip(buffer),main=entries.get('word/document.xml');if(!main)throw Error('This file has no Word document body.');
  const root=parseXml(main.toString('utf8')),body=all(root,n=>named(n,'body'))[0];if(!body)throw Error('Missing Word body.');
  const relations=new Map(),warnings=[];
  if(entries.has('word/_rels/document.xml.rels'))for(const rel of children(parseXml(entries.get('word/_rels/document.xml.rels').toString('utf8')))){
    if(attr(rel,'TargetMode')==='External'){relations.set(attr(rel,'Id'),{external:true,target:attr(rel,'Target')});continue;}
    const target=posix.normalize(posix.join('word',attr(rel,'Target')||''));relations.set(attr(rel,'Id'),{target});
  }
  const blocks=[],occurrences=[];let pendingImage=null;
  function paragraph(node){
    const index=blocks.length,block={kind:'paragraph',index,text:paragraphText(node).trim(),images:[],style:attr(children(node).find(n=>named(n,'pPr'))?.children?.find(n=>typeof n!=='string'&&named(n,'pStyle'))||{},'val')||'',level:null};
    const pr=children(node).find(n=>named(n,'pPr')),num=pr&&children(pr).find(n=>named(n,'numPr'));
    if(num)block.level=Number(attr(children(num).find(n=>named(n,'ilvl'))||{},'val')||0);
    let pendingCaption='';
    const drawings=all(node,n=>named(n,'drawing')||named(n,'pict'));
    for(const draw of drawings){
      const refs=all(draw,n=>(n.ns===NS.a&&n.local==='blip')||n.local==='imagedata');
      const captionText=all(draw,n=>named(n,'t')).map(text).join('').trim();
      if(figure(captionText))pendingCaption='Figure '+figure(captionText);
      else if(captionText)warnings.push({kind:'unsupported-floating-text',block:index,text:captionText,message:'Floating text is not a simple figure caption. Review its placement before conversion.'});
      for(const ref of refs){
        const rid=attr(ref,'embed')||attr(ref,'id')||attr(ref,'link');
        const relation=relations.get(rid),occurrence={index:occurrences.length,block:index,relationship:rid,target:relation?.target||'',caption:pendingCaption,external:!!relation?.external,placement:all(draw,n=>n.local==='anchor').length?'floating':'inline'};
        pendingCaption='';block.images.push(occurrence.index);occurrences.push(occurrence);pendingImage=occurrence;
      }
    }
    const label=figure(block.text);
    if(label){if(pendingImage&&!pendingImage.caption)pendingImage.caption='Figure '+label;block.captionOnly=true;}
    if(all(node,n=>named(n,'del')||named(n,'ins')).length)warnings.push({kind:'tracked-changes',block:index,message:'Tracked changes are present. Current text is used; review against Word.'});
    if(all(node,n=>n.local==='srcRect').length)warnings.push({kind:'image-crop',block:index,message:'Word applies an image crop. Embedded bytes retain the full original image; inspect the figure before finalizing.'});
    blocks.push(block);
  }
  for(const node of children(body)){
    if(named(node,'p'))paragraph(node);
    else if(named(node,'tbl')){
      const index=blocks.length,rows=children(node).filter(n=>named(n,'tr')).map(row=>children(row).filter(n=>named(n,'tc')).map(cell=>children(cell).filter(n=>named(n,'p')).map(paragraphText).join('\n').trim()));
      blocks.push({kind:'table',index,rows});
      if(all(node,n=>n.local==='blip'||n.local==='imagedata').length)warnings.push({kind:'unsupported-table-image',block:index,message:'A table contains an image. It needs explicit placement; conversion is blocked until resolved.'});
    }else if(!named(node,'sectPr'))warnings.push({kind:'unsupported-body-element',message:'Unmapped Word body element: '+node.local});
  }
  const media=[...entries].filter(([path])=>path.startsWith('word/media/')).map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes),type:imageType(bytes)}));
  const supplementalText=[];
  for(const [path,bytes]of entries)if(/^word\/(?:header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(path)){
    const paragraphs=all(parseXml(bytes.toString('utf8')),n=>named(n,'p')).map(paragraphText).map(t=>t.trim()).filter(Boolean);
    if(paragraphs.length)supplementalText.push({path,paragraphs});
  }
  return {entries,blocks,occurrences,media,supplementalText,warnings,sourceSha256:sha(buffer)};
}
const headings=new Map([['purpose','purpose'],['background','background'],['notes','notes'],['safety concerns','safety'],['safety','safety'],['security concerns','security'],['security','security'],['equipment','equipment'],['procedure','procedure']]);
function dateValue(raw){
  let date;if(/^\d{4}-\d{2}-\d{2}$/.test(raw))date=raw;
  else{const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);if(m)date=`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
  return date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date?date:'';
}
export function convertDocx(buffer,{team='',effectiveDate=''}={}){
  const source=inspectDocx(buffer),doc=model.blank();doc.team=team;
  const report={sourceSha256:source.sourceSha256,sourceBlocks:source.blocks,supplementalText:source.supplementalText,metadata:[],images:[],warnings:[...source.warnings],unmapped:[],steps:[]};
  let section='',group=doc.groups[0],current=null;const stepBlocks=new Map(),metadataBlocks=new Set(),sectionAtBlock=new Map();
  const addWarning=(kind,message,extra={})=>report.warnings.push({kind,message,...extra});
  for(const block of source.blocks){
    sectionAtBlock.set(block.index,section);
    if(block.kind==='table'){
      if(section==='procedure'&&current){const rows=block.rows,width=Math.max(0,...rows.map(r=>r.length));if(width>0&&width<=8&&rows.length>1&&rows.length<=51){current.tables.push({id:randomUUID(),caption:'',headers:Array.from({length:width},(_,i)=>rows[0][i]||''),rows:rows.slice(1).map(row=>Array.from({length:width},(_,i)=>row[i]||''))});}else report.unmapped.push({block:block.index,reason:'Table exceeds the supported shape or has no header/body.',rows});}
      else report.unmapped.push({block:block.index,reason:'Table outside a procedure step.',rows:block.rows});
      continue;
    }
    const value=block.text;if(block.captionOnly||!value)continue;
    const normalized=value.toLowerCase().replace(/\s*:\s*$/,'').trim();
    if(headings.has(normalized)){section=headings.get(normalized);current=null;continue;}
    if(/^(?:standard operating procedure\s*\(sop\)|standard operating procedure|sop)$/i.test(value))continue;
    const meta=block.level===null?/^(effective(?:\s+date)?|author|prepared\s+by|approval|approved\s+by|date|version|remarks)\s*(?::\s*|\s+)(.*)$/i.exec(value):null;
    if(meta){
      const key=meta[1].toLowerCase(),raw=meta[2].trim();report.metadata.push({field:key,value:raw,block:block.index});metadataBlocks.add(block.index);
      if(['author','prepared by'].includes(key))doc.preparedBy=raw;
      if(['approval','approved by'].includes(key))doc.approvedBy=raw;
      if(key.startsWith('effective')){doc.effectiveDate=dateValue(raw);if(!doc.effectiveDate)addWarning('incomplete-effective-date','Source effective date is not a complete calendar date; left blank in JSON.',{source:raw});}
      if(key==='date')addWarning('source-date','Source DATE retained in the conversion report; it is not assumed to be an effective date or a new Creation event.',{source:raw});
      continue;
    }
    if(!section){if(!doc.title)doc.title=value;else report.unmapped.push({block:block.index,reason:'Unclassified front matter.',text:value});continue;}
    if(section!=='procedure'){doc[section]+=(doc[section]?'\n':'')+value;continue;}
    if(/^heading[1-6]$/i.test(block.style)&&block.level===null){group={id:randomUUID(),title:value,steps:[]};doc.groups.push(group);current=null;continue;}
    if(block.level!==null&&block.level>0&&current){current.substeps.push({id:randomUUID(),text:value});stepBlocks.set(block.index,current);if(block.level>1)addWarning('nested-substeps','Nested list flattened to the app’s one substep level; inspect this paragraph.',{block:block.index});}
    else if(block.level===null&&current){current.instruction+='\n\n'+value;stepBlocks.set(block.index,current);}
    else{current=model.step();current.instruction=value;group.steps.push(current);stepBlocks.set(block.index,current);report.steps.push({id:current.id,block:block.index,number:report.steps.length+1});}
  }
  if(effectiveDate){const date=dateValue(effectiveDate);if(!date)throw Error('Use a valid complete effective date.');doc.effectiveDate=date;report.metadata.push({field:'effective date override',value:date});}
  if(!team)addWarning('team-not-in-source','Responsible Team is blank because it was not specified. Choose it in the SOP Creator or pass --team.');
  if(!doc.title||!report.steps.length)throw Error('Could not identify both a title and procedure steps. Inspect the source before converting.');
  const steps=doc.groups.flatMap(g=>g.steps),stepNumber=new Map(report.steps.map(s=>[s.id,s.number]));
  let photoBytes=0;
  for(const occurrence of source.occurrences){
    const audit={...occurrence,sha256:source.media.find(m=>m.path===occurrence.target)?.sha256,step:null,reason:''};
    if(occurrence.external){audit.reason='External image: not downloaded.';report.unmapped.push(audit);report.images.push(audit);continue;}
    const bytes=source.entries.get(occurrence.target),type=bytes&&imageType(bytes);
    if(!bytes||!type){audit.reason='Missing image or unsupported image encoding. Convert to PNG, JPEG or WebP explicitly.';report.unmapped.push(audit);report.images.push(audit);continue;}
    let target=stepBlocks.get(occurrence.block);
    const num=figure(occurrence.caption),references=num?steps.filter(step=>new RegExp('\\bfig(?:ure)?s?\\.?\\s*'+num+'\\b','i').test(step.instruction+'\n'+step.substeps.map(s=>s.text).join('\n'))):[];
    // Figure labels are source evidence when an image is anchored after the procedure.
    if(!target&&references.length)target=references[0];
    if(!target){
      const prior=source.blocks.filter(b=>b.index<occurrence.block&&stepBlocks.has(b.index)).at(-1);
      const procedureStart=report.steps[0].block;
      if(occurrence.block<procedureStart&&!sectionAtBlock.get(occurrence.block)){audit.reason='Front matter image retained separately (for example the source logo).';}
      else if(occurrence.block<procedureStart){audit.reason='Image is in a context section which cannot embed pictures. Explicit placement is required.';report.unmapped.push(audit);}
      else if(prior&&!source.blocks.some(b=>b.index>prior.index&&b.index<occurrence.block&&metadataBlocks.has(b.index))){target=stepBlocks.get(prior.index);addWarning('image-placement','Image has no direct step or figure reference; provisionally assigned to its preceding step.',{image:occurrence.index});}
      else audit.reason='Image placement could not be resolved.';
    }
    if(target){
      const data=`data:image/${type};base64,${bytes.toString('base64')}`;photoBytes+=data.length;
      if(data.length>3000000||photoBytes>12000000||target.photos.length>=8)throw Error('Images exceed SOP Creator limits. Resize/compress supported originals and rerun; no images were omitted.');
      const photo={id:randomUUID(),data,caption:occurrence.caption||'',scale:100};target.photos.push(photo);
      audit.step=stepNumber.get(target.id);audit.photoId=photo.id;audit.referenceSteps=references.map(s=>stepNumber.get(s.id));audit.reason=stepBlocks.has(occurrence.block)?'Image anchored in this step paragraph.':references.length?'Matched to the first step explicitly referencing its figure number.':'Preceding step (review required).';
    }else if(occurrence.block>=report.steps[0].block)report.unmapped.push(audit);
    report.images.push(audit);
  }
  for(const media of source.media)if(!source.occurrences.some(o=>o.target===media.path))addWarning('unreferenced-media','Media is retained separately but was not referenced in the main document body.',{path:media.path});
  if(report.unmapped.length||report.warnings.some(w=>['unsupported-table-image','unsupported-body-element','unsupported-floating-text'].includes(w.kind)))throw Object.assign(Error('Unmapped content needs review before an import-ready backup can be generated.'),{report,source});
  const validated=model.validate(doc),backup={format:'northglenn-sop',version:1,document:validated};
  model.validate(JSON.parse(JSON.stringify(backup)).document);
  report.counts={steps:steps.length,embeddedPhotos:steps.reduce((sum,s)=>sum+s.photos.length,0),sourceMedia:source.media.length};
  report.sourceMedia=source.media;report.validation='Passed the bundled SOP Creator model and a JSON round trip. No technical wording was rewritten.';
  report.procedureTextPreserved=[...stepBlocks].every(([blockIndex,step])=>[step.instruction,...step.substeps.map(s=>s.text)].some(t=>t.includes(source.blocks[blockIndex].text)));
  if(!report.procedureTextPreserved)throw Error('Procedure text verification failed.');
  return {backup,report,source};
}
function main(){
  const args=process.argv.slice(2),input=args.shift();if(!input||!args.includes('--out'))throw Error('Usage: node docx-to-sop.mjs source.docx --out OUTPUT_DIRECTORY [--team TEAM] [--effective-date YYYY-MM-DD] [--inspect-only]');
  const option=name=>{const at=args.indexOf(name);return at<0?undefined:args[at+1];},out=resolve(option('--out'));
  if(existsSync(join(out,'converted.sop.json'))||existsSync(join(out,'report.json')))throw Error('Output already exists. Choose a new output directory to preserve earlier results.');
  const bytes=readFileSync(resolve(input));mkdirSync(out,{recursive:true});let result;
  if(args.includes('--inspect-only')){const source=inspectDocx(bytes);result={source,report:{sourceSha256:source.sourceSha256,blocks:source.blocks,images:source.occurrences,media:source.media,warnings:source.warnings}};}
  else try{result=convertDocx(bytes,{team:option('--team'),effectiveDate:option('--effective-date')});}catch(error){if(error.report)writeFileSync(join(out,'report.json'),JSON.stringify(error.report,null,2));throw error;}
  mkdirSync(join(out,'source-media'),{recursive:true});
  const extracted=[];for(const [index,m]of result.source.media.entries()){const ext=m.type==='jpeg'?'jpg':m.type||'bin',name=`image-${index+1}.${ext}`;writeFileSync(join(out,'source-media',name),result.source.entries.get(m.path));extracted.push({...m,file:'source-media/'+name});}
  result.report.extractedMedia=extracted;writeFileSync(join(out,'report.json'),JSON.stringify(result.report,null,2));
  if(result.backup)writeFileSync(join(out,'converted.sop.json'),JSON.stringify(result.backup,null,2));
  console.log(JSON.stringify({output:out,counts:result.report.counts,warningCount:result.report.warnings.length,inspectionOnly:!result.backup}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{main();}catch(error){console.error(error.message);process.exitCode=1;}
