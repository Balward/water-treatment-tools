(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
  const today=(()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');})();
  const dateLabel=date=>new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'});
  const pdfLink=(date,label)=>{const link=node('a','history-pdf',label);link.href='report.html?date='+encodeURIComponent(date);link.target='_blank';link.rel='noopener';return link;};
  let requestId=0;
  function calendar(month,days){
    const container=$('historyCalendar');container.replaceChildren();
    for(const name of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])container.append(node('span','calendar-weekday',name));
    const first=new Date(month+'-01T12:00:00Z'),year=first.getUTCFullYear(),monthIndex=first.getUTCMonth();
    const count=new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();
    for(let i=0;i<first.getUTCDay();i++){const empty=node('span','calendar-empty');empty.setAttribute('aria-hidden','true');container.append(empty);}
    const saved=new Set(days.map(day=>day.date));
    for(let number=1;number<=count;number++){
      const date=month+'-'+String(number).padStart(2,'0'),link=pdfLink(date,String(number));
      link.className='calendar-day'+(saved.has(date)?' has-record':'');link.dataset.date=date;
      link.setAttribute('aria-label',dateLabel(date)+(saved.has(date)?', Saved Rounds':', No Saved Record')+', View PDF');
      if(date===today)link.setAttribute('aria-current','date');
      link.append(node('span','calendar-marker',saved.has(date)?'•':''));container.append(link);
    }
  }
  function records(days){
    const container=$('historyRecords');container.replaceChildren();
    if(!days.length){container.append(node('p','card empty','No saved rounds for this month.'));return;}
    for(const day of days){
      const card=node('article','card history-record'),heading=node('div','history-record-heading');
      heading.append(node('h3','',dateLabel(day.date)));
      const actions=node('div','review-actions');actions.append(pdfLink(day.date,'View Rounds PDF'));
      const edit=node('a','history-edit','Edit Rounds');edit.href='./?date='+encodeURIComponent(day.date);actions.append(edit);heading.append(actions);card.append(heading);
      const shifts=node('div','summary-grid');
      for(const name of ['AM','PM']){
        const shift=day.shifts[name],status=shift.completedAt && shift.done===shift.total?'Completed':shift.startedAt || shift.done?'In Progress':'Not Started';
        const summary=node('div','history-shift');summary.append(node('strong','',name+' · '+status),node('p','',(shift.operator || 'No Operator')+' · '+shift.done+' / '+shift.total+' Checks'));shifts.append(summary);
      }
      card.append(shifts);container.append(card);
    }
  }
  async function load(){
    if(!$('historyMonth').reportValidity())return;
    const month=$('historyMonth').value,id=++requestId;
    $('historyError').hidden=true;$('historyStatus').textContent='Loading saved rounds…';
    $('historyCalendar').replaceChildren();$('historyRecords').replaceChildren();
    $('previousMonth').disabled=month==='2000-01';$('nextMonth').disabled=month==='9999-12';
    try{
      const response=await fetch('/api/plant-rounds/history?month='+encodeURIComponent(month),{cache:'no-store',signal:AbortSignal.timeout(12000)});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'Saved rounds could not be loaded.');
      if(id!==requestId)return;
      calendar(month,body.days);records(body.days);$('historyStatus').textContent=body.days.length+' Saved '+(body.days.length===1?'Date':'Dates')+' This Month';
    }catch(error){if(id!==requestId)return;$('historyError').textContent='History could not be loaded. '+error.message+' Use Refresh to try again.';$('historyError').hidden=false;$('historyStatus').textContent='History Unavailable';}
  }
  function moveMonth(offset){
    if(!$('historyMonth').reportValidity())return;
    const date=new Date($('historyMonth').value+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);$('historyMonth').value=date.toISOString().slice(0,7);void load();
  }
  $('historyMonth').value=today.slice(0,7);
  $('historyMonth').onchange=()=>void load();$('previousMonth').onclick=()=>moveMonth(-1);$('nextMonth').onclick=()=>moveMonth(1);
  $('thisMonth').onclick=()=>{$('historyMonth').value=today.slice(0,7);void load();};$('refreshHistory').onclick=()=>void load();
  window.addEventListener('online',()=>void load());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
  void load();
})();
