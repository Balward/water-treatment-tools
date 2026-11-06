(() => {
  'use strict';
  const editor=window.opener,documentView=document.getElementById('sop-document'),status=document.getElementById('preview-window-status'),print=document.getElementById('print-preview');
  let connected=false;
  documentView.addEventListener('load',event=>{
    const image=event.target;
    if(image.matches('.document-photos img')&&image.naturalHeight)image.closest('figure').style.width=(180*image.naturalWidth/image.naturalHeight)+'px';
  },true);
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==editor||event.data?.type!=='sop-preview-update'||typeof event.data.html!=='string')return;
    documentView.innerHTML=event.data.html;document.title=event.data.title+' | SOP Preview';
    connected=true;print.disabled=false;status.textContent='Updates live while you edit.';
  });
  print.onclick=async()=>{await Promise.all([...documentView.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));await document.fonts.ready;window.print();};
  function connect(){
    if(!editor||editor.closed){status.textContent=connected?'Editor closed. This preview shows the last received version.':'Open this preview using Open Preview Window in the SOP editor.';return;}
    editor.postMessage({type:'sop-preview-ready'},location.origin);
  }
  connect();
  const timer=setInterval(()=>{if(!connected||!editor||editor.closed)connect();},2000);
  window.addEventListener('pagehide',()=>clearInterval(timer));
})();
