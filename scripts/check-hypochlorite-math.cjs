const assert=require('node:assert/strict');
const {calculateBatchDose:calculate,CHLORINE_EQUIVALENT}=require('../apps/sodium-hypochlorite-calculator/calculation.js');
const base={basinGallons:35400,doseMgL:1,strengthPercent:10,specificGravity:1.1,strengthBasis:'naocl-weight'};
const close=(actual,expected,tolerance=1e-12)=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*tolerance,`${actual} != ${expected}`);
// Independent US-unit mass balance: gallons of product = dose * basin gal /
// (1,000,000 * solution SG * available-chlorine mass fraction).
const known=calculate({...base,basinGallons:100000,specificGravity:1,strengthBasis:'chlorine-weight'});
close(known.solutionGallons,1);close(known.solutionMl,3785.411784);close(known.solutionFluidOunces,128);
const normal=calculate(base);close(normal.solutionGallons,35400/(1e6*1.1*.1*(70.906/74.442)));
close(normal.chlorineGrams,134.0035771536);close(normal.chlorinePounds,normal.chlorineGrams/453.59237);
assert.ok(normal.solutionPounds>normal.chlorinePounds*10,'Solution and available-chlorine weights are distinct');
// All three label conventions must give the same result for the same solution.
const available=calculate({...base,strengthBasis:'chlorine-weight',strengthPercent:10*CHLORINE_EQUIVALENT});
const trade=calculate({...base,strengthBasis:'trade',strengthPercent:10*CHLORINE_EQUIVALENT*1.1});
for(const r of [available,trade]){close(r.solutionGallons,normal.solutionGallons);close(r.solutionPounds,normal.solutionPounds)}
// Manufacturer's approximate example: 5.25 wt% NaOCl is about 5 wt% Cl2.
close(5.25*CHLORINE_EQUIVALENT,5,0.001);
// Density affects volume for weight %, but trade % already defines g/volume.
const dense=calculate({...base,specificGravity:1.2});close(dense.solutionGallons/normal.solutionGallons,1.1/1.2);close(dense.solutionPounds,normal.solutionPounds);
const tradeDense=calculate({...base,strengthBasis:'trade',specificGravity:1.2});const tradeNormal=calculate({...base,strengthBasis:'trade'});close(tradeDense.solutionGallons,tradeNormal.solutionGallons);close(tradeDense.solutionPounds/tradeNormal.solutionPounds,1.2/1.1);
for(const sample of [{doseMgL:.01,basinGallons:1},{doseMgL:2.5,basinGallons:10000,strengthPercent:12.5,specificGravity:1.2},{doseMgL:5,basinGallons:1000000,strengthPercent:5.25,specificGravity:1.075}]){
 const input={...base,...sample},r=calculate(input);close(r.solutionGallons,input.doseMgL*input.basinGallons/(1e6*input.specificGravity*(input.strengthPercent/100)*CHLORINE_EQUIVALENT));close(r.solutionLiters*r.availableChlorineGramsPerLiter,r.chlorineGrams);close(calculate({...input,doseMgL:input.doseMgL*2}).solutionGallons,r.solutionGallons*2);
}
for(const field of ['basinGallons','doseMgL','strengthPercent','specificGravity'])for(const value of [0,-1,NaN,Infinity,undefined,'10'])assert.throws(()=>calculate({...base,[field]:value}),RangeError);
assert.throws(()=>calculate({...base,strengthPercent:101}),RangeError);assert.throws(()=>calculate({...base,strengthBasis:'ambiguous'}),RangeError);assert.throws(()=>calculate({...base,basinGallons:1e308}),RangeError);
console.log('Hypochlorite math passed: independent mass balances, three strength bases, density, unit conversions, scaling, small doses, and invalid/overflow inputs. Default example: '+normal.solutionGallons.toFixed(6)+' US gal / '+normal.solutionMl.toFixed(2)+' mL.');
