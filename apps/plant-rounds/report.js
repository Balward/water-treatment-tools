(() => {
  'use strict';
  const $=id=>document.getElementById(id),date=new URLSearchParams(location.search).get('date');
  let objectUrl;
  async function load(){
    $('refreshReport').disabled=true;$('reportMessage').classList.remove('error');$('reportMessage').textContent='Generating PDF from the saved daily record…';
    try{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date || ''))throw new Error('Choose a rounds date in the app, then select View PDF.');
      const url='/api/plant-rounds/'+date+'/report.pdf';
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
      if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error || 'Could not generate the PDF. Try Refresh PDF.');}
      if(!response.headers.get('Content-Type')?.includes('application/pdf'))throw new Error('The server did not return a PDF. Deploy the updated suite API and try again.');
      const old=objectUrl;objectUrl=URL.createObjectURL(await response.blob());
      $('pdfPreview').src=objectUrl;$('pdfPreview').hidden=false;
      $('downloadPdf').href=objectUrl;$('downloadPdf').download='plant-rounds-'+date+'.pdf';$('downloadPdf').hidden=false;
      $('openPdf').href=objectUrl;$('openPdf').hidden=false;$('reportTitle').textContent='Daily Rounds · '+date;
      document.title='Plant Rounds · '+date+' · PDF';$('reportMessage').textContent='PDF ready · Saved AM and PM entries for '+date+'. Refresh PDF to include later saves.';
      if(old)URL.revokeObjectURL(old);
    }catch(error){$('reportMessage').classList.add('error');$('reportMessage').textContent=error.message+' Any previous preview remains a snapshot of its earlier saved record.';}
    finally{$('refreshReport').disabled=false;}
  }
  $('refreshReport').onclick=load;window.addEventListener('pagehide',event=>{if(objectUrl&&!event.persisted)URL.revokeObjectURL(objectUrl);});void load();
})();
