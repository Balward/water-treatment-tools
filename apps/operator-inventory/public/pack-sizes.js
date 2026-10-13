'use strict';
// Format only reviewed workbook values; preserve edits and saved counting units.
(function(root){
const rules = [
  {
    "id": "s1-r5",
    "description": "Methyl Purple Indicator",
    "itemNumber": "101202-868",
    "countSize": "Bottle",
    "original": "1BTL/500mL",
    "label": "500 mL / bottle"
  },
  {
    "id": "s1-r6",
    "description": "pH 4 Buffer Singlets",
    "itemNumber": "2770020",
    "countSize": "Case",
    "original": "1cs/20pk",
    "label": "20 singlets / box (20 mL each)",
    "previousLabels": ["20 singlets / pack (20 mL each)"],
    "previousCountLabels": ["Pack"],
    "countLabel": "Box"
  },
  {
    "id": "s1-r7",
    "description": "pH 7 Buffer Singlets",
    "itemNumber": "2770120",
    "countSize": "Case",
    "original": "1cs/20pk",
    "label": "20 singlets / box (20 mL each)",
    "previousLabels": ["20 singlets / pack (20 mL each)"],
    "previousCountLabels": ["Pack"],
    "countLabel": "Box"
  },
  {
    "id": "s1-r8",
    "description": "pH 10 Buffer Singlets",
    "itemNumber": "2770220",
    "countSize": "Case",
    "original": "1cs/20pk",
    "label": "20 singlets / box (20 mL each)",
    "previousLabels": ["20 singlets / pack (20 mL each)"],
    "previousCountLabels": ["Pack"],
    "countLabel": "Box"
  },
  {
    "id": "s1-r9",
    "description": "pH 7.00 Buffer",
    "itemNumber": "BDH5050-4L",
    "countSize": "Case",
    "original": "1ea/4Ltr",
    "label": "4 L / cubetainer",
    "countLabel": "Cubetainer"
  },
  {
    "id": "s1-r10",
    "description": "pH 10.01 Buffer",
    "itemNumber": "BDH5076-4L",
    "countSize": "Case",
    "original": "1ea/4Ltr",
    "label": "4 L / cubetainer",
    "countLabel": "Cubetainer"
  },
  {
    "id": "s1-r11",
    "description": "Sulfuric Acid, 0.02N",
    "itemNumber": "101223-530",
    "countSize": "Bag in Box",
    "original": "1ea/4Ltr",
    "label": "4 L / cubetainer",
    "countLabel": "Cubetainer"
  },
  {
    "id": "s1-r12",
    "description": "EDTA Tritant 0.01M",
    "itemNumber": "RC270025",
    "countSize": "Bag in Box",
    "original": "1ea/10Ltr",
    "label": "10 L / cubetainer",
    "countLabel": "Cubetainer"
  },
  {
    "id": "s1-r13",
    "description": "pH Storage Solution",
    "itemNumber": "2756549",
    "countSize": "Bottle",
    "original": "1ea/1BTL",
    "label": "500 mL / bottle"
  },
  {
    "id": "s1-r14",
    "description": "Large 3 mil gloves",
    "confirmedDescription": "Nitrile Gloves - 3 mil - Large",
    "itemNumber": "76457-134",
    "countSize": "Case",
    "original": "2000/cs",
    "label": "10 boxes / case (250 gloves / box; 2,500 total)"
  },
  {
    "id": "s1-r15",
    "description": "XL 3 mil gloves",
    "confirmedDescription": "Nitrile Gloves - 3 mil - XL",
    "itemNumber": "76457-136",
    "countSize": "Case",
    "original": "2000/cs",
    "label": "10 boxes / case (225 gloves / box; 2,250 total)"
  },
  {
    "id": "s1-r16",
    "description": "Kim Wipes",
    "itemNumber": "82003-820",
    "countSize": "Case",
    "original": "16800/cs",
    "label": "60 boxes / case (280 wipes / box; 16,800 total)"
  },
  {
    "id": "s1-r17",
    "description": "Waffle Print Tissues",
    "itemNumber": "40101-003",
    "countSize": "Case",
    "original": "500/cs",
    "label": "500 tissues / case"
  },
  {
    "id": "s1-r18",
    "description": "Sulfuric Acid Dropper Bottle 5.25N",
    "itemNumber": "244953",
    "countSize": "Bottle",
    "original": "1BTL/1L",
    "label": "1 L / bottle"
  },
  {
    "id": "s1-r19",
    "description": "Asorbic Acid Packets",
    "itemNumber": "1457799",
    "countSize": "Bag of 100 ea",
    "original": "1pk/100ea",
    "label": "100 packets / bag"
  },
  {
    "id": "s1-r20",
    "description": "Alkaline Cyanide Reagent",
    "itemNumber": "2122332",
    "countSize": "Bottle",
    "original": "1BTL/100mL",
    "label": "100 mL / bottle"
  },
  {
    "id": "s1-r21",
    "description": "PAN Indicator Solution 0.1%",
    "itemNumber": "2122432",
    "countSize": "Bottle",
    "original": "1BTL/100mL",
    "label": "100 mL / bottle"
  },
  {
    "id": "s1-r22",
    "description": "Salt Bridge Solution",
    "itemNumber": "25M1A1025-115",
    "countSize": "Bottle",
    "original": "1ea/1BTL",
    "label": "500 mL / bottle"
  },
  {
    "id": "s1-r23",
    "description": "RoVer Rust Remover",
    "itemNumber": "30001",
    "countSize": "Bottle",
    "original": "1ea/1BTL",
    "label": "454 g / bottle"
  },
  {
    "id": "s1-r24",
    "description": "Ferrozine Iron Reagent",
    "itemNumber": "230149",
    "countSize": "Bottle",
    "original": "1BTL/500mL",
    "label": "500 mL / bottle"
  },
  {
    "id": "s1-r25",
    "description": "Swiftest Free CL2 Reagent Refill Vial",
    "itemNumber": "21055-60",
    "countSize": "Vial",
    "original": "1ea/1vial",
    "label": "Approx. 250 tests / vial"
  },
  {
    "id": "s1-r26",
    "description": "Swiftest Total CL2 Reagent Refill Vial",
    "itemNumber": "21056-60",
    "countSize": "Vial",
    "original": "1ea/1vial",
    "label": "Approx. 250 tests / vial"
  },
  {
    "id": "s1-r27",
    "description": "DPD Free Chlorine Reagent Powder Pillows",
    "itemNumber": "2105528",
    "countSize": "1000 ea Bottle",
    "original": "1pk/1000ea",
    "label": "1,000 powder pillows / bottle"
  },
  {
    "id": "s1-r28",
    "description": "DPD Total Chlorine Reagent Powder Pillows",
    "itemNumber": "2105628",
    "countSize": "1000 ea Bottle",
    "original": "1pk/1000ea",
    "label": "1,000 powder pillows / bottle"
  },
  {
    "id": "s1-r29",
    "description": "Salt Bridge for DPD1P1 PEEK",
    "itemNumber": "SB-P1SV",
    "countSize": "Each",
    "original": "1ea/1BRG",
    "label": "1 bridge"
  },
  {
    "id": "s1-r30",
    "description": "pH Probe",
    "itemNumber": "DPD1P1",
    "countSize": "Each",
    "original": "1ea",
    "label": "1 probe"
  },
  {
    "id": "s1-r31",
    "description": "CL-17 Colorimeter",
    "itemNumber": "NA",
    "countSize": "Each",
    "original": "1ea",
    "label": "1 colorimeter"
  },
  {
    "id": "s1-r32",
    "description": "Little Giant Pump",
    "itemNumber": "505723",
    "countSize": "Each",
    "original": "1ea/1BRG",
    "label": "1 pump"
  },
  {
    "id": "s1-r33",
    "description": "Turb. Vials",
    "itemNumber": "LZY834",
    "countSize": "Vial",
    "original": "1ea/1vial",
    "label": "1 vial"
  },
  {
    "id": "s1-r34",
    "description": "Chlorine Reagent Set",
    "itemNumber": "25569-00",
    "countSize": "Bag of 3 Bottles",
    "original": "1cs/1Kit",
    "label": "3 bottles / set"
  },
  {
    "id": "s1-r35",
    "description": "Turbidimeter Desicant Cartridge",
    "itemNumber": "LZY876",
    "countSize": "Each",
    "original": "1ea/1ctr",
    "label": "1 cartridge"
  },
  {
    "id": "s1-r36",
    "description": "Turb. Wiper",
    "itemNumber": "LZY915",
    "countSize": "Each",
    "original": "1ea/1wpr",
    "label": "1 wiper"
  },
  {
    "id": "s1-r37",
    "description": "CL-17 Tubing Kit - Pre-Assembled",
    "itemNumber": "8560400",
    "countSize": "Each",
    "original": "1ea/1BRG",
    "label": "1 tubing kit"
  },
  {
    "id": "s1-r38",
    "description": "Crush Tube Large",
    "itemNumber": "A3-SNKL",
    "confirmedItemNumber": "A3-SNKL-T",
    "countSize": "Each",
    "original": "10/pk",
    "label": "10 tubes / pack"
  },
  {
    "id": "s1-r39",
    "description": "Crush Tube Small",
    "itemNumber": "N/A",
    "confirmedItemNumber": "A3-SNF-T",
    "countSize": "Each",
    "original": "10/pk",
    "label": "10 tubes / pack"
  },
  {
    "id": "s1-r40",
    "description": "Black 5 mil Nitrile Gloves LG",
    "confirmedDescription": "Black Nitrile Gloves - 5 mil - Large",
    "itemNumber": "76307-466",
    "countSize": "Case",
    "original": "1000/cs",
    "label": "1,000 gloves / case"
  },
  {
    "id": "s1-r41",
    "description": "Black 5 mil Nitrile Gloves XL",
    "confirmedDescription": "Black Nitrile Gloves - 5 mil - XL",
    "itemNumber": "76307-468",
    "countSize": "Case",
    "original": "1000/cs",
    "label": "1,000 gloves / case"
  },
  {
    "id": "s1-r42",
    "description": "Hydrogen Peroxide",
    "itemNumber": "N/A",
    "countSize": "Bottle",
    "original": "1 ea",
    "previousLabels": ["1 bottle"],
    "label": "16 fl oz / bottle"
  },
  {
    "id": "s1-r43",
    "description": "Vinegar",
    "itemNumber": "N/A",
    "countSize": "Bottle",
    "original": "1 ea",
    "label": "1 gallon / bottle"
  },
  {
    "id": "s1-r44",
    "description": "Filter Cartridge 10\"",
    "itemNumber": "W2T159719",
    "countSize": "Each",
    "original": "1 ea",
    "label": "1 cartridge"
  }
];
function format(item) {
 const rule = rules.find(r=>r.id===item.id && [r.description,r.confirmedDescription].includes(item.description) && [r.itemNumber,r.confirmedItemNumber].filter(Boolean).includes(item.itemNumber) && [r.countSize,r.countLabel,...(r.previousCountLabels || [])].includes(item.countSize) && (r.original===item.caseSize || r.previousLabels?.includes(item.caseSize)));
 return rule ? rule.label : item.caseSize;
}
function countSize(item) {
 const rule = rules.find(r=>r.id===item.id && [r.description,r.confirmedDescription].includes(item.description) && r.itemNumber===item.itemNumber && [r.countSize,r.countLabel,...(r.previousCountLabels || [])].includes(item.countSize));
 return rule?.countLabel || item.countSize;
}
function normalize(item) {
 const result = {...item,caseSize:format(item),countSize:countSize(item)};
 const nameRule = rules.find(r=>r.id===item.id && r.description===item.description && r.itemNumber===item.itemNumber && r.confirmedDescription);
 if (nameRule) result.description = nameRule.confirmedDescription;
 const correction = rules.find(r=>r.id===item.id && [r.description,r.confirmedDescription].includes(item.description) && r.itemNumber===item.itemNumber && r.confirmedItemNumber);
 if (correction) result.itemNumber = correction.confirmedItemNumber;
 if (item.id === 's1-r43' && item.description === 'Vinegar' && ['N/A','',null].includes(item.itemNumber)) result.itemNumber = 'VINE30-128';
 if (item.id === 's1-r42' && item.description === 'Hydrogen Peroxide' && ['N/A','',null].includes(item.itemNumber) && !item.productUrl) result.productUrl = 'https://www.amazon.com/dp/B07VBZ9384';
 return result;
}
const api={format,countSize,normalize};
if(typeof module==='object' && module.exports) module.exports=api; else root.InventoryPackSizes=api;
})(typeof globalThis!=='undefined'?globalThis:this);
