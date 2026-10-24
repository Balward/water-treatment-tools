(() => {
  'use strict';
  // Basin volumes and parallel-flow logic preserve the original Plant Flow model.
  const unit=(id,name,volumeMG)=>({id,name,volumeMG,inService:true});
  const stages=[
    {id:'flash',name:'Rapid Mix',color:'#00677f',chemicals:['Alum','Polymer','Sodium Permanganate'],units:[unit('fm1','Rapid Mixer',.00574)]},
    {id:'floc',name:'Flocculation',color:'#379e9a',units:[unit('floc1','West Floc Basin',.116),unit('floc2','East Floc Basin',.116)]},
    {id:'clar',name:'Sedimentation / Clarifiers',color:'#5684b0',units:[unit('clar1','West Clarifier',1.326),unit('clar2','East Clarifier',1.326)]},
    {id:'pac',name:'PAC Chamber',color:'#d39a32',chemicals:['Sodium Hypochlorite'],units:[unit('pac1','PAC Chamber',.047235)]},
    {id:'filters',name:'Filters',color:'#7b78af',units:Array.from({length:8},(_,i)=>unit('f'+(i+1),'Filter '+(i+1),.0354))},
    {id:'clearwell',name:'Clearwells',color:'#6c9659',chemicals:['Sodium Hydroxide'],units:[unit('cw1','Clearwell A',.34),unit('cw2','Clearwell B',.544)]}
  ];
  const $=id=>document.getElementById(id);
  let flow=3.5;
  let timelineResults=[];
  const chemicals=[['Alum','Rapid Mix',0],['Polymer','Rapid Mix',0],['Sodium Permanganate','Rapid Mix',0],['Sodium Hypochlorite','PAC Chamber',3],['Sodium Hydroxide','Clearwells',5]];
  const duration=minutes=>!Number.isFinite(minutes)?'—':minutes<60?minutes.toFixed(1)+' min':Math.floor(Math.round(minutes)/60)+'h '+(Math.round(minutes)%60)+'m';
  function hideTimelineDetail(){
    $('timeline-detail').hidden=true;
    document.querySelectorAll('[data-timeline-stage]').forEach(button=>button.removeAttribute('aria-describedby'));
  }
  function showTimelineDetail(button){
    const index=Number(button.dataset.timelineStage),stage=timelineResults[index];
    if(!stage)return;
    hideTimelineDetail();
    const rows=chemicals.map(([name,,injectionIndex])=>{
      const minutes=timelineResults.slice(injectionIndex,index+1).reduce((n,s)=>n+s.minutes,0);
      return '<div><dt>'+name+'</dt><dd>'+(index<injectionIndex?'Not Yet Injected':duration(minutes))+'</dd></div>';
    }).join('');
    $('timeline-detail').innerHTML='<h3>'+stage.name+'</h3><p>'+stage.volume.toFixed(3)+' MG In Service <span aria-hidden="true">·</span> '+duration(stage.minutes)+' Detention</p><h4>Chemical Travel To Stage Exit</h4><dl>'+rows+'</dl>';
    $('timeline-detail').hidden=false;
    $('timeline-detail').classList.remove('above');
    const detailRect=$('timeline-detail').getBoundingClientRect();
    if(detailRect.bottom>innerHeight-12 && button.getBoundingClientRect().top-detailRect.height>document.querySelector('.site-header').offsetHeight+12)$('timeline-detail').classList.add('above');
    button.setAttribute('aria-describedby','timeline-detail');
  }
  function render(){
    hideTimelineDetail();
    const valid=Number.isFinite(flow)&&flow>=0&&flow<=14;
    const running=valid&&flow>0;
    const gpm=running?flow*694.444:0;
    const results=stages.map(stage=>{
      const online=stage.units.filter(u=>u.inService),volume=online.reduce((n,u)=>n+u.volumeMG,0);
      // The existing tool distributes flow equally across parallel floc basins, clarifiers, and filters.
      const parallel=['floc','clar','filters'].includes(stage.id);
      const minutes=!running?NaN:!online.length?0:parallel?Math.max(...online.map(u=>u.volumeMG*1e6/(gpm/online.length))):volume*1e6/gpm;
      return{...stage,online,volume,minutes};
    });
    const total=results.reduce((n,s)=>n+s.minutes,0),all=stages.flatMap(s=>s.units),count=all.filter(u=>u.inService).length;
    $('total').textContent=running?duration(total):valid?'Flow Stopped':'—';
    $('gpm').textContent=valid?Math.round(gpm).toLocaleString()+' gpm':'Enter a flow from 0 to 14 MGD.';
    $('flow-number').setAttribute('aria-invalid',String(!valid));
    $('online-count').textContent=count+' / '+all.length;
    $('online-volume').textContent=results.reduce((n,s)=>n+s.volume,0).toFixed(3);
    $('flow-message').textContent=!valid?'Enter a flow from 0 to 14 MGD.':!running?'No flow. Detention times are not calculated.':results.some(s=>!s.online.length)?'Some stages have no units in service. Times include only available stages.':'Change the flow rate or toggle a unit below.';
    timelineResults=results;
    $('timeline').innerHTML=running?results.map((s,index)=>s.minutes>0?'<button type="button" data-timeline-stage="'+index+'" aria-label="'+s.name+', '+duration(s.minutes)+' detention" style="flex:'+s.minutes+';--segment-color:'+s.color+'"><span aria-hidden="true"></span></button>':'').join(''):'';
    $('stages').innerHTML=results.map((s,i)=>'<article class="stage '+(s.id==='filters'?'filters ':'')+(!s.online.length?'stage-offline':'')+'"><div class="stage-heading"><span class="stage-index">STEP '+String(i+1).padStart(2,'0')+'</span><h3>'+s.name+'</h3><p class="stage-time">'+(!s.online.length?'No Units In Service':duration(s.minutes))+'</p><p class="stage-volume">'+s.volume.toFixed(3)+' MG · '+s.online.length+' / '+s.units.length+' In Service</p></div><div class="stage-body">'+(s.chemicals?'<div class="injections" aria-label="Chemical injection points">'+s.chemicals.map(c=>'<span>'+c+'</span>').join('')+'</div>':'')+'<div class="unit-grid">'+s.units.map(u=>'<button type="button" class="unit" data-unit="'+u.id+'" aria-pressed="'+u.inService+'" aria-label="'+u.name+', '+(u.inService?'in service':'offline')+'"><span class="unit-icon" aria-hidden="true">'+(u.inService?'✓':'−')+'</span><span><strong>'+u.name+'</strong><small>'+(u.inService?'In Service':'Offline')+' · '+u.volumeMG.toFixed(3)+' MG</small></span></button>').join('')+'</div></div></article>').join('');
    const sumFrom=index=>running?results.slice(index).reduce((n,s)=>n+s.minutes,0):NaN;
    $('chemical-rows').innerHTML=chemicals.map(([name,point,index])=>'<tr><td>'+name+'</td><td>'+point+'</td><td>'+(index>4?'Not Yet Injected':duration(running?results.slice(index,5).reduce((n,s)=>n+s.minutes,0):NaN))+'</td><td>'+duration(sumFrom(index))+'</td></tr>').join('');
  }
  $('timeline').addEventListener('pointerover',event=>{
    const button=event.target.closest('[data-timeline-stage]');
    if(button && event.pointerType!=='touch' && !button.contains(event.relatedTarget))showTimelineDetail(button);
  });
  $('timeline').addEventListener('focusin',event=>{const button=event.target.closest('[data-timeline-stage]');if(button)showTimelineDetail(button)});
  $('timeline').addEventListener('click',event=>{const button=event.target.closest('[data-timeline-stage]');if(button)showTimelineDetail(button)});
  $('timeline-inspector').addEventListener('pointerleave',()=>{if(!$('timeline-inspector').contains(document.activeElement))hideTimelineDetail()});
  $('timeline-inspector').addEventListener('focusout',event=>{if(!$('timeline-inspector').contains(event.relatedTarget))hideTimelineDetail()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTimelineDetail()});
  document.addEventListener('pointerdown',event=>{if(!$('timeline-inspector').contains(event.target))hideTimelineDetail()});
  $('flow-number').addEventListener('input',e=>{flow=e.target.value===''?NaN:Number(e.target.value);if(Number.isFinite(flow)&&flow>=0&&flow<=14)$('flow-range').value=flow;render()});
  $('flow-range').addEventListener('input',e=>{flow=Number(e.target.value);$('flow-number').value=flow.toFixed(1);render()});
  $('stages').addEventListener('click',e=>{const button=e.target.closest('[data-unit]');if(!button)return;const id=button.dataset.unit,u=stages.flatMap(s=>s.units).find(u=>u.id===id);u.inService=!u.inService;render();document.querySelector('[data-unit="'+id+'"]').focus({preventScroll:true})});
  $('reset').addEventListener('click',()=>{flow=3.5;stages.forEach(s=>s.units.forEach(u=>u.inService=true));$('flow-number').value='3.5';$('flow-range').value='3.5';render()});
  const links=[...document.querySelectorAll('.sidebar a')],sections=links.map(l=>document.querySelector(l.getAttribute('href')));
  function updateSection(){const offset=document.querySelector('.site-header').offsetHeight+48,atBottom=scrollY>0&&scrollY+innerHeight>=document.documentElement.scrollHeight-2;const current=atBottom?sections.at(-1):sections.filter(s=>s.getBoundingClientRect().top<=offset).at(-1)||sections[0];links.forEach((l,i)=>{if(sections[i]===current)l.setAttribute('aria-current','location');else l.removeAttribute('aria-current')})}
  window.addEventListener('scroll',updateSection,{passive:true});window.addEventListener('resize',updateSection);render();updateSection();
})();
