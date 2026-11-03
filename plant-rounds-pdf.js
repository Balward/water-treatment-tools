'use strict';
const {PDFDocument}=require('pdfkit');
const path=require('node:path');
const fontPath=path.join(__dirname,'assets','fonts','pdf','Inter-Regular.ttf');
const boldPath=path.join(__dirname,'assets','fonts','pdf','Inter-Bold.ttf');
const stamp=value=>value?new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)):'Not recorded';
const hasValue=value=>value!==undefined && value!==null && value!=='';
function cellValue(field,entry,shift,fieldNotes){
  if(!field.shifts.includes(shift))return '—';
  const value=entry?.value;
  if(!hasValue(value))return '';
  if(value==='na')return 'N/A';
  // Earlier templates incorrectly stored Raw Water readings as checkboxes.
  if(field.type==='number' && (typeof value!=='number' || !Number.isFinite(value)))return '';
  if(field.type==='text'){
    fieldNotes.push({title:field.label,location:field.location,shift,text:String(value),operator:entry.updatedBy,at:entry.updatedAt});
    return 'Note '+fieldNotes.length;
  }
  if(typeof value==='boolean')return field.type==='check'?(value?'Done':'Not Done'):(value?'Yes':'No');
  return String(value);
}
module.exports = async function roundsPdf(day,template,options={}) {
  const generatedAt=options.generatedAt || new Date().toISOString();
  const doc=new PDFDocument({size:'LETTER',layout:'landscape',margin:0,bufferPages:true,autoFirstPage:false,
    info:{Title:'Plant Rounds — '+day.date,Author:'City of Northglenn Water Treatment',Subject:'Saved AM and PM rounds, including incomplete records'},lang:'en-US'});
  doc.registerFont('Inter',fontPath);doc.registerFont('InterBold',boldPath);
  const chunks=[];const finished=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  const ink='#172127',muted='#526571',teal='#00677f',line='#bdcbd1',soft='#eef5f7';
  const width=792,height=612,margin=22,gap=12,columnWidth=(width-2*margin-2*gap)/3,bottom=height-36;
  let col=0,y=0,top=0;
  const fieldNotes=[];
  function measure(text,w,size=9,bold=false){doc.font(bold?'InterBold':'Inter').fontSize(size);return doc.heightOfString(String(text),{width:w,lineGap:1});}
  function text(value,x,at,w,size=9,bold=false,color=ink,align='left'){
    doc.font(bold?'InterBold':'Inter').fontSize(size).fillColor(color).text(String(value),x,at,{width:w,lineGap:1,align});
  }
  function fill(x,at,w,h,color){doc.rect(x,at,w,h).fill(color);}
  function rule(x,at,w){doc.moveTo(x,at).lineTo(x+w,at).lineWidth(.5).strokeColor(line).stroke();}
  const x=()=>margin+col*(columnWidth+gap);
  const complete=day.shifts.AM.completedAt && day.shifts.PM.completedAt;
  const started=day.shifts.AM.startedAt || day.shifts.PM.startedAt;
  const reportState=complete?'COMPLETED ROUNDS':started?'PARTIAL / IN PROGRESS':'BLANK / NOT STARTED';
  function newPage(){
    doc.addPage();col=0;
    text('NORTHGLENN WATER TREATMENT',margin,15,460,7,true,teal);
    text('Daily Plant Rounds · '+day.date,margin,27,470,15,true);
    text(reportState,530,17,240,8,true,complete?'#166447':'#805400','right');
    text('Saved snapshot · '+stamp(generatedAt)+' MT · '+day.notes.length+' daily notes',480,31,290,6.5,false,muted,'right');
    const summaryWidth=(width-2*margin-gap)/2;
    const names=['AM','PM'].map(shift=>`${shift} Operator: ${day.shifts[shift].operator || 'Not started'}`);
    const nameHeight=Math.max(...names.map(name=>measure(name,summaryWidth-12,7.5,true)));
    const cardHeight=nameHeight+19;
    ['AM','PM'].forEach((shift,index)=>{
      const left=margin+index*(summaryWidth+gap),state=day.shifts[shift],count=day.progress[shift];
      fill(left,50,summaryWidth,cardHeight,soft);text(names[index],left+6,54,summaryWidth-12,7.5,true);
      const status=state.completedAt?'Completed '+stamp(state.completedAt)+' MT':state.startedAt?'In progress · Started '+stamp(state.startedAt)+' MT':'Not started';
      text(`${count.done} / ${count.total} recorded · ${status}`,left+6,57+nameHeight,summaryWidth-12,6.5,false,muted);
    });
    top=50+cardHeight+18;
    text('Blank = not recorded     — = not scheduled     N/A = not applicable     Done = task completed',margin,top-13,width-2*margin,6.5,false,muted);
    y=top;
  }
  function advance(){if(col<2){col++;y=top;}else newPage();}
  function room(space){if(y+space>bottom)advance();}
  function tableHeader(location,continued=false){
    fill(x(),y,columnWidth,17,teal);text(location.label+(continued?' (Cont.)':''),x()+5,y+3,columnWidth-84,8,true,'#fff');
    text('AM',x()+columnWidth-73,y+4,32,6.5,true,'#fff','center');text('PM',x()+columnWidth-35,y+4,32,6.5,true,'#fff','center');y+=17;
  }
  function sectionHeader(label){fill(x(),y,columnWidth,12,'#f1f4f5');text(label,x()+5,y+1.5,columnWidth-10,7,true,teal);y+=12;}
  newPage();
  for(const location of template.locations){
    const fields=template.fields.filter(field=>field.location===location.id);
    room(44);tableHeader(location);
    let section='';
    for(const field of fields){
      const showSection=field.section!=='Readings And Checks';
      const values=['AM','PM'].map(shift=>cellValue(field,day.shifts[shift].entries[field.id],shift,fieldNotes));
      const labelWidth=columnWidth-84,valueWidth=32;
      const label=field.unit && !field.label.endsWith('('+field.unit+')')?field.label+' ('+field.unit+')':field.label;
      const rowHeight=Math.max(14,measure(label,labelWidth,7.3)+4,...values.map(value=>measure(value,valueWidth,7.3)+4));
      const sectionChanged=field.section!==section;
      if(y+rowHeight+(showSection && sectionChanged?12:0)>bottom){advance();tableHeader(location,true);if(showSection)sectionHeader(field.section);}
      else if(showSection && sectionChanged)sectionHeader(field.section);
      section=field.section;
      ['AM','PM'].forEach((shift,index)=>{
        const left=x()+columnWidth-76+index*38;
        if(!field.shifts.includes(shift))fill(left,y,38,rowHeight,'#edf0f2');
        text(values[index],left+3,y+2,valueWidth,7.3,true,ink,'center');
      });
      text(label,x()+5,y+2,labelWidth,7.3);
      doc.moveTo(x()+columnWidth-76,y).lineTo(x()+columnWidth-76,y+rowHeight).lineWidth(.4).strokeColor(line).stroke();
      doc.moveTo(x()+columnWidth-38,y).lineTo(x()+columnWidth-38,y+rowHeight).stroke();
      y+=rowHeight;rule(x(),y,columnWidth);
    }
    y+=4;
  }
  // Use remaining columns for notes, continuing only when text cannot fit.
  if(fieldNotes.length || day.notes.length){
    room(60);text('Daily Notes And Field Comments',x(),y,columnWidth,10,true,teal);y+=22;
    const records=[...fieldNotes.map((note,index)=>({...note,title:'Field Note '+(index+1)+' · '+note.title})),...day.notes.map(note=>({title:'Daily Note',text:note.text,location:note.location,shift:note.shift,operator:note.operator,at:note.createdAt,edited:note.updatedAt,editedBy:note.updatedBy}))];
    for(const note of records){
      const loc=template.locations.find(location=>location.id===note.location)?.label || 'General / Handoff';
      const heading=note.title+' · '+note.shift+' · '+loc;
      const headingHeight=measure(heading,columnWidth,8,true);
      const meta=(note.operator || 'Operator not recorded')+' · '+stamp(note.at)+' MT'+(note.edited?' · Edited by '+note.editedBy+' · '+stamp(note.edited)+' MT':'');
      room(headingHeight+measure(meta,columnWidth,6.5)+24);
      text(heading,x(),y,columnWidth,8,true);y+=headingHeight+3;
      text(meta,x(),y,columnWidth,6.5,false,muted);y+=measure(meta,columnWidth,6.5)+6;
      function noteLine(value){
        if(y+11>bottom){advance();const title='Note (Continued) · '+note.shift+' · '+loc;text(title,x(),y,columnWidth,8,true,teal);y+=measure(title,columnWidth,8,true)+6;}
        text(value || ' ',x(),y,columnWidth,8);y+=11;
      }
      // Wrap by Unicode code points, including long unbroken text and newlines.
      const paragraphs=String(note.text).split(/\r\n|\r|\n/);
      for(const paragraph of paragraphs){
        let part='';
        for(const character of paragraph){
          doc.font('Inter').fontSize(8);
          if(part && doc.widthOfString(part+character)>columnWidth){
            const split=part.lastIndexOf(' '),printed=split>0?part.slice(0,split):part,remainder=split>0?part.slice(split+1):'';
            noteLine(printed);part=remainder;
          }
          part+=character;
        }
        noteLine(part);
      }
      if(y+10<=bottom){y+=4;rule(x(),y,columnWidth);y+=6;}
    }
  }else{
    room(32);text('Daily Notes',x(),y,columnWidth,9,true,teal);y+=15;text('No shared notes recorded.',x(),y,columnWidth,8,false,muted);
  }
  const pages=doc.bufferedPageRange();
  for(let page=0;page<pages.count;page++){
    doc.switchToPage(page);rule(margin,height-31,width-2*margin);
    text(day.date+' · '+reportState+' · Saved entries only · All times America/Denver',margin,height-23,620,6.5,false,muted);
    text('Page '+(page+1)+' of '+pages.count,width-110,height-23,82,6.5,false,muted,'right');
  }
  doc.end();return finished;
};
