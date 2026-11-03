(function(root){
'use strict';
const version='water-treatment-puns-20261030-v1';
function create(current){
  const state=JSON.parse(JSON.stringify(current));
  const candidates=[
    ['Flo Meter','CO',31.50,'Water Treatment B; Distribution 2'],
    ['Phil Ter','CO',29.75,'Water Treatment C; Filter Operations Training'],
    ['Clara Fication','WY',33.00,'Water Treatment A; Laboratory Experience'],
    ['Cole Agulation','CO',30.25,'Water Treatment B; Chemical Feed Experience'],
    ['Beck Wash','NE',28.50,'Water Treatment C; Mechanical Maintenance']
  ];
  state.applicants=candidates.map(([name,region,wage,licenses])=>({id:'APP-'+String(state.nextId++).padStart(3,'0'),name,state:region,wage,licenses,archived:false,reviews:{}}));
  return state;
}
const api={version,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.ApplicationReviewSamples=api;
})(typeof globalThis!=='undefined'?globalThis:this);
