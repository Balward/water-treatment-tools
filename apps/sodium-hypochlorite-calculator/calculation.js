/* Batch mass balance. US liquid gallons; chlorine expressed as Cl2 equivalent.
 * NaOCl -> available Cl2 mass ratio: 70.906 / 74.442 (approximately 0.9525).
 * Strength-basis conventions: OxyChem Sodium Hypochlorite Handbook, terminology.
 * SG uses the normal engineering approximation of water density = 1 kg/L.
 * Demand, decay, ongoing flow, and added solution's volume are excluded.
 */
(function(root){
  'use strict';
  const LITERS_PER_GALLON=3.785411784,GRAMS_PER_POUND=453.59237,CHLORINE_EQUIVALENT=70.906/74.442;
  function calculateBatchDose({basinGallons,doseMgL,strengthPercent,specificGravity,strengthBasis}){
    for(const [name,value]of Object.entries({basinGallons,doseMgL,strengthPercent,specificGravity})){
      if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new RangeError(name+' must be a finite positive number.');
    }
    if(strengthPercent>100)throw new RangeError('Strength must not exceed 100%.');
    if(!['naocl-weight','chlorine-weight','trade'].includes(strengthBasis))throw new RangeError('Select a supported strength basis.');
    const waterLiters=basinGallons*LITERS_PER_GALLON;
    const chlorineGrams=doseMgL*waterLiters/1000;
    const availableChlorineGramsPerLiter=strengthBasis==='trade'?strengthPercent*10:strengthPercent/100*specificGravity*1000*(strengthBasis==='naocl-weight'?CHLORINE_EQUIVALENT:1);
    const solutionLiters=chlorineGrams/availableChlorineGramsPerLiter;
    const solutionGallons=solutionLiters/LITERS_PER_GALLON;
    const solutionPounds=solutionLiters*specificGravity*1000/GRAMS_PER_POUND;
    const result={waterLiters,chlorineGrams,chlorinePounds:chlorineGrams/GRAMS_PER_POUND,availableChlorineGramsPerLiter,solutionLiters,solutionGallons,solutionMl:solutionLiters*1000,solutionFluidOunces:solutionGallons*128,solutionPounds};
    if(Object.values(result).some(value=>!Number.isFinite(value)||value<=0))throw new RangeError('Inputs produce a result outside the supported numeric range.');
    return Object.freeze(result);
  }
  const api=Object.freeze({calculateBatchDose,LITERS_PER_GALLON,GRAMS_PER_POUND,CHLORINE_EQUIVALENT});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.HypochloriteMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
