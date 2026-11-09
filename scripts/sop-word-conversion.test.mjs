import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {convertDocx,inspectDocx,parseXml,unzip} from '../plugins/northglenn-sop-editor/skills/word-sop-conversion/scripts/docx-to-sop.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64');
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zip(files){const locals=[],central=[];let offset=0;for(const [name,value]of Object.entries(files)){const data=Buffer.isBuffer(value)?value:Buffer.from(value),n=Buffer.from(name),h=Buffer.alloc(30),c=Buffer.alloc(46),crc=crc32(data);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);locals.push(h,n,data);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=30+n.length+data.length;}const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,cd,end]);}
const p=(text,number=false)=>`<w:p>${number?'<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>':''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const picture=id=>`<w:r><w:drawing><a:blip r:embed="${id}"/></w:drawing></w:r>`;
const caption=n=>`<mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><w:txbxContent>${p('Figure '+n)}</w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent>${p('Figure '+n)}</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent>`;
function fixture(extra='',relationships=''){
 const body=p('Tubing Replacement').replace('</w:p>',picture('logo')+'</w:p>')+p('STANDARD OPERATING PROCEDURE (SOP)')+p('EFFECTIVE 4.2025')+p('PURPOSE')+p('Keep the exact source wording &amp; values.')+p('SAFETY CONCERNS')+p('Wear gloves.')+p('PROCEDURE:')+p('Close the valve (Figure 1).',true).replace('</w:p>',caption(1)+picture('one')+'</w:p>')+p('Read 45 psi. Use Figure 6.',true)+p('Date the sample bottle.',true)+`<w:p>${picture('six')}</w:p>`+p('Figure 6')+extra+p('AUTHOR: Example Operator')+p('DATE: 4/10/2025')+p('APPROVAL: Source Approver')+p('VERSION: 1.2024');
 const document=`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><w:body>${body}</w:body></w:document>`;
 return zip({'word/document.xml':document,'word/_rels/document.xml.rels':`<Relationships>${['logo','one','six'].map(id=>`<Relationship Id="${id}" Target="media/${id}.PNG" Type="image"/>`).join('')}${relationships}</Relationships>`,'word/media/logo.PNG':png,'word/media/one.PNG':png,'word/media/six.PNG':png});
}
test('Word images, AlternateContent captions, first explicit references and exact source bytes survive conversion',()=>{
 const {backup,report}=convertDocx(fixture()),d=backup.document,steps=d.groups[0].steps;
 assert.equal(steps.length,3);assert.equal(steps[0].instruction,'Close the valve (Figure 1).');assert.equal(steps[2].instruction,'Date the sample bottle.');
 assert.equal(steps[0].photos[0].caption,'Figure 1');assert.equal(steps[1].photos[0].caption,'Figure 6');assert.equal(steps[2].photos.length,0);
 assert.equal(d.preparedBy,'Example Operator');assert.equal(d.approvedBy,'Source Approver');assert.equal(d.effectiveDate,'');assert.deepEqual(d.revisionHistory,[]);
 assert.equal(d.purpose,'Keep the exact source wording & values.');assert.equal(d.safety,'Wear gloves.');
 assert.equal(report.counts.sourceMedia,3);assert.equal(report.counts.embeddedPhotos,2);assert.equal(report.images.filter(i=>i.step===null).length,1);assert.equal(report.procedureTextPreserved,true);
 for(const photo of steps.flatMap(s=>s.photos))assert.deepEqual(Buffer.from(photo.data.split(',')[1],'base64'),png);
 assert.equal(report.sourceMedia[0].sha256,createHash('sha256').update(png).digest('hex'));
 assert.ok(report.warnings.some(w=>w.kind==='incomplete-effective-date'));assert.ok(report.metadata.some(m=>m.field==='version'&&m.value==='1.2024'));
 const overridden=convertDocx(fixture(),{team:'Water Treatment',effectiveDate:'2025-04-10'}).backup.document;assert.equal(overridden.effectiveDate,'2025-04-10');assert.equal(overridden.team,'Water Treatment');
});
test('unmapped floating text and table images cannot be silently omitted',()=>{
 const float=`<w:p><w:drawing><w:txbxContent>${p('A critical instruction in a text box.')}</w:txbxContent></w:drawing></w:p>`;
 assert.throws(()=>convertDocx(fixture(float)),/Unmapped content/);
 const table=`<w:tbl><w:tr><w:tc><w:p>${picture('one')}</w:p></w:tc></w:tr></w:tbl>`;
 assert.throws(()=>convertDocx(fixture(table)),/Unmapped content/);
});
test('parser rejects DTDs, malformed XML, corrupt ZIP content and unsafe member paths',()=>{
 assert.throws(()=>parseXml('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///secret">]><a/>'),/DTD/);
 assert.throws(()=>parseXml('<a><b></a>'),/Mismatched/);
 assert.throws(()=>unzip(Buffer.from('not a Word file')),/valid DOCX/);
 assert.throws(()=>unzip(zip({'../outside':'data'})),/Unsafe/);
 const bad=fixture();bad[50]^=1;assert.throws(()=>inspectDocx(bad),/Corrupt/);
});
test('bundled validator exactly matches the deployed app model and old review prompts are preserved',()=>{
 assert.equal(readFileSync('plugins/northglenn-sop-editor/skills/word-sop-conversion/scripts/sop-model.cjs','utf8'),readFileSync('apps/sop-creator/model.js','utf8'));
 const p=JSON.parse(readFileSync('plugins/northglenn-sop-editor/plugin.json'));
 assert.deepEqual(p.extensions['com.openai'].interface.defaultPrompt,['Review this uploaded Northglenn SOP JSON backup. Show the entire proposed SOP and hold export until I explicitly approve.','Continue technical review of this SOP, showing changes and unresolved questions.']);
});
