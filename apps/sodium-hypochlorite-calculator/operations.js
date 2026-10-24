document.addEventListener('DOMContentLoaded',()=>{
  'use strict';
  const form=document.getElementById('doseForm'),result=document.getElementById('result'),empty=document.getElementById('emptyResult'),error=document.getElementById('error'),basis=document.getElementById('strengthBasis');
  const number=new Intl.NumberFormat('en-US',{maximumSignificantDigits:4});
  const format=value=>number.format(value);
  const basisNames={'naocl-weight':'NaOCl By Weight','chlorine-weight':'Available Chlorine By Weight',trade:'Trade % Available Chlorine'};
  function clearResult(){result.hidden=true;empty.hidden=false;error.hidden=true;document.getElementById('calculations').open=false;for(let i=1;i<=4;i++)document.getElementById('step'+i).textContent='Calculate an addition to see your values.';form.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'))}
  function updateBasis(){document.getElementById('strengthHelp').textContent=basis.value==='naocl-weight'?'Use the % by weight of NaOCl shown on your product analysis.':basis.value==='chlorine-weight'?'Use the % by weight of available chlorine (as Cl2), not % NaOCl.':'Trade % is available chlorine in g per 100 mL; 10 trade % equals 100 g/L.';document.getElementById('gravityHelp').textContent=basis.value==='trade'?'Used for solution weight; trade % already defines chlorine per solution volume.':'Use current supplier or measured specific gravity. The starting value of 1.10 is an assumption.'}
  form.addEventListener('input',clearResult);form.addEventListener('change',()=>{clearResult();updateBasis()});
  form.addEventListener('submit',event=>{
    event.preventDefault();clearResult();
    const inputs={basinGallons:document.getElementById('basinVolume').valueAsNumber,doseMgL:document.getElementById('residualIncrease').valueAsNumber,strengthPercent:document.getElementById('hypochloriteConcentration').valueAsNumber,specificGravity:document.getElementById('specificGravity').valueAsNumber,strengthBasis:basis.value};
    try{
      const r=HypochloriteMath.calculateBatchDose(inputs);
      document.getElementById('dosageGallons').textContent=format(r.solutionGallons);
      document.getElementById('dosageMl').textContent=format(r.solutionMl)+' mL';
      document.getElementById('dosageOunces').textContent=format(r.solutionFluidOunces)+' US fl oz';
      document.getElementById('solutionWeight').textContent=format(r.solutionPounds)+' lb solution';
      document.getElementById('chlorineWeight').textContent=format(r.chlorinePounds)+' lb as Cl2';
      document.getElementById('resultBasis').textContent=format(inputs.strengthPercent)+'% '+basisNames[inputs.strengthBasis]+' · SG '+format(inputs.specificGravity);
      document.getElementById('resultInputs').textContent=format(inputs.basinGallons)+' US gal basin · '+format(inputs.doseMgL)+' mg/L addition as Cl2';
      document.getElementById('step1').textContent=format(inputs.basinGallons)+' US gal × 3.785411784 L/US gal = '+format(r.waterLiters)+' L of basin water.';
      document.getElementById('step2').textContent=format(inputs.doseMgL)+' mg/L × '+format(r.waterLiters)+' L ÷ 1,000 mg/g = '+format(r.chlorineGrams)+' g available chlorine (as Cl2).';
      document.getElementById('step3').textContent=(inputs.strengthBasis==='trade'?format(inputs.strengthPercent)+' trade % × 10':format(inputs.strengthPercent)+' ÷ 100 × '+format(inputs.specificGravity)+' kg/L × 1,000 g/kg'+(inputs.strengthBasis==='naocl-weight'?' × (70.906 ÷ 74.442)':''))+' = '+format(r.availableChlorineGramsPerLiter)+' g available chlorine per L of solution.';
      document.getElementById('step4').textContent=format(r.chlorineGrams)+' g ÷ '+format(r.availableChlorineGramsPerLiter)+' g/L = '+format(r.solutionLiters)+' L solution = '+format(r.solutionGallons)+' US gal. Solution weight: '+format(r.solutionLiters)+' L × '+format(inputs.specificGravity)+' kg/L × 2.20462262 lb/kg = '+format(r.solutionPounds)+' lb.';
      result.hidden=false;empty.hidden=true;
    }catch(cause){error.textContent=cause.message;error.hidden=false}
  });
  document.getElementById('resetDefaults').addEventListener('click',()=>{form.reset();clearResult();updateBasis()});
  updateBasis();
  const links=[...document.querySelectorAll('.sidebar a')],sections=links.map(link=>document.querySelector(link.hash));
  const sync=()=>{const offset=document.querySelector('.site-header').offsetHeight+48,current=sections.filter(s=>s.getBoundingClientRect().top<=offset).at(-1)||sections[0];links.forEach((link,i)=>{if(sections[i]===current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')})};window.addEventListener('scroll',sync,{passive:true});window.addEventListener('resize',sync);sync();
});
