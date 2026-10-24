document.addEventListener('DOMContentLoaded',()=>{
  const parameters=[['mean diameter','meanDiameter','Mean Diameter'],['mean volume','meanVolume','Mean Volume'],['particle count','particleCount','Particle Count'],['concentration','concentration','Concentration']];
  const originalNotify=showNotification;showNotification=function(...args){originalNotify.apply(this,args);const container=document.getElementById('notificationContainer');while(container.children.length>2)container.firstElementChild.remove()};
  if(window.Chart){Chart.defaults.font.family='Inter, Segoe UI, sans-serif';Chart.defaults.color='#576b77';Chart.defaults.borderColor='#d6e0e5'}
  const status=document.createElement('p');status.className='run-status';status.setAttribute('role','status');document.getElementById('generateActionBar').prepend(status);
  const links=[...document.querySelectorAll('.sidebar a')],sections=links.map(a=>document.querySelector(a.hash));
  const selections=[...document.querySelectorAll('#exportOptions input')];
  const sync=()=>{
    const offset=document.querySelector('.site-header').offsetHeight+120;
    const current=sections.filter(s=>s.offsetHeight&&s.getBoundingClientRect().top<=offset).at(-1)||sections[0];
    links.forEach((a,i)=>{a.setAttribute('aria-disabled',String(!sections[i].offsetHeight));if(sections[i]===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
    selections.forEach(input=>{const p=parameters.find(p=>p[0]===input.value);input.disabled=!window[p[1]+'ChartInstance']});
    const ready=chartsGenerated&&!regenerationNotificationShown&&!document.getElementById('generateChartsHeader').disabled;
    document.getElementById('exportPanel').hidden=!chartsGenerated;document.getElementById('exportPng').disabled=!ready;document.getElementById('exportPdf').disabled=!ready||!selections.some(i=>i.checked&&!i.disabled);
    const message=Object.keys(processedData).length+' Runs Loaded'+(chartsGenerated?(ready?' · Charts Ready':' · Regenerate To Apply Changes'):' · Ready To Generate');if(status.textContent!==message)status.textContent=message;
  };
  links.forEach(a=>a.addEventListener('click',e=>{if(a.getAttribute('aria-disabled')==='true')e.preventDefault()}));window.addEventListener('scroll',sync,{passive:true});window.addEventListener('resize',sync);
  for(const id of ['infoPanel','basicConfig','tabbedChartsContainer','generateChartsHeader'])new MutationObserver(sync).observe(document.getElementById(id),{attributes:true,attributeFilter:['style','disabled']});
  const originalImport=processWorkbook;processWorkbook=function(...args){chartsGenerated=false;regenerationNotificationShown=false;parameters.forEach(([,id])=>{window[id+'ChartInstance']?.destroy();window[id+'ChartInstance']=null});document.getElementById('tabbedChartsContainer').style.display='none';originalImport.apply(this,args);sync()};
  const originalGenerate=generateAllCharts;generateAllCharts=async function(...args){await originalGenerate.apply(this,args);requestAnimationFrame(()=>{parameters.forEach(([,id])=>window[id+'ChartInstance']?.resize());sync()})};
  const originalSwitch=switchTab;switchTab=function(id){originalSwitch(id);requestAnimationFrame(()=>{const key=id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());window[key+'ChartInstance']?.resize()});syncTabs()};
  function syncTabs(){document.querySelectorAll('.tab-button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))))}syncTabs();
  selections.forEach(input=>input.addEventListener('change',sync));
  document.getElementById('exportPng').addEventListener('click',()=>exportPNG());
  document.getElementById('exportPdf').addEventListener('click',()=>{selectedParametersForPdf.clear();selections.filter(i=>i.checked&&!i.disabled).forEach(i=>selectedParametersForPdf.add(i.value));generatePdfReport()});
  // Reports use the rendered chart instances, avoiding the obsolete single-chart generator.
  addSelectedCharts=async function(pdf,y,margin,width){
    for(const name of selectedParametersForPdf){const p=parameters.find(p=>p[0]===name.toLowerCase());if(!p)continue;const chart=window[p[1]+'ChartInstance'];if(!chart)continue;
      pdf.addPage();y=24;pdf.setFont('helvetica','bold');pdf.setFontSize(16);pdf.setTextColor(23,33,39);pdf.text(p[2]+' Over Time',margin,y);y+=12;
      const active=document.querySelector('.tab-button.active').dataset.tab;switchTab(p[1].replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));chart.resize();chart.update('none');
      const imageHeight=Math.min(width*chart.height/chart.width,130),imageWidth=imageHeight*chart.width/chart.height;
      pdf.addImage(chart.canvas.toDataURL('image/png'),'PNG',margin+(width-imageWidth)/2,y,imageWidth,imageHeight);y+=imageHeight+12;
      pdf.setFont('helvetica','normal');pdf.setFontSize(9);
      chart.data.datasets.forEach((dataset,index)=>{if(!chart.isDatasetVisible(index))return;const lines=pdf.splitTextToSize(dataset.label,width);if(y+lines.length*5>275){pdf.addPage();y=24}pdf.text(lines,margin,y);y+=lines.length*5+3});switchTab(active);
    }return y;
  };
  // Keep the existing help content, with keyboard focus contained in the open dialog.
  for(const [id,openName,closeName]of [['statsHelpModal','openStatsHelp','closeStatsHelp'],['metricsHelpModal','openMetricsHelp','closeMetricsHelp']]){
    const modal=document.getElementById(id);let previous;
    window[openName]=()=>{previous=document.activeElement;modal.style.display='flex';document.querySelector('.workspace').inert=true;document.querySelector('.site-header').inert=true;modal.querySelector('button').focus()};
    window[closeName]=()=>{modal.style.display='none';document.querySelector('.workspace').inert=false;document.querySelector('.site-header').inert=false;previous?.focus()};
    modal.addEventListener('click',e=>{if(e.target===modal)window[closeName]()});modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();window[closeName]()}if(e.key==='Tab'){e.preventDefault();modal.querySelector('button').focus()}});
  }
  sync();
});
