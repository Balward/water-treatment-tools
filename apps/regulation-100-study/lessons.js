/* Editorial summaries, not official exam questions. Sources and section references accompany each lesson. */
window.reg100Lessons = [
  {
    title:'Start Here: What Reg 100 Covers', section:'100.1', tag:'The Big Picture',
    takeaway:'Regulation 100 connects qualified operators with the facilities they supervise.',
    body:'<p>Colorado uses this rule for operator certification and supervision of water treatment, domestic and industrial wastewater treatment, distribution, and collection facilities.</p><ul><li><strong>The person has a certificate.</strong> The facility has a classification.</li><li><strong>Match category and level.</strong> Required supervision generally comes from a certified operator at or above the facility\'s class.</li><li><strong>Check applicability.</strong> Section 100.1 includes exemptions; do not assume every private or small facility is covered identically.</li></ul>',
    example:'Before taking responsibility for a new plant, identify its official classification and the certification category it needs.',
    question:'What is the central purpose of Regulation 100?',
    choices:['Set every plant\'s chemical feed rate','Establish operator certification and qualified facility supervision','Replace all drinking water and discharge requirements'], correct:1,
    explanation:'Reg 100 addresses operator qualifications and supervision. A plant also has its own applicable operating and compliance requirements.'
  },
  {
    title:'Know The People And Terms', section:'100.2', tag:'Key Definitions',
    takeaway:'An operator certificate and an ORC designation describe different things.',
    body:'<div class="definition-grid"><div class="definition-item"><strong>Certified Operator</strong>A person certified in Colorado to perform operational responsibilities.</div><div class="definition-item"><strong>Operator In Responsible Charge (ORC)</strong>A certified operator the owner designates to make process-control or system-integrity decisions affecting public health or the environment.</div><div class="definition-item"><strong>Facility Classification</strong>The Division\'s assessment of facility complexity and/or size.</div><div class="definition-item"><strong>Division</strong>The Water Quality Control Division within CDPHE.</div></div>',
    example:'Two employees can hold the same certificate, while only one has been designated by the owner as ORC. A facility can have more than one designated ORC.',
    question:'Does holding a certificate automatically make you the facility\'s ORC?', choices:['Yes','No; the owner must designate the ORC'],correct:1,
    explanation:'Certification qualifies a person. ORC designation assigns that person responsibility for a particular facility.'
  },
  {
    title:'Who Handles What?', section:'100.3', tag:'Find The Right Help',
    takeaway:'Certification administration, facility oversight, and Board authority have different roles.',
    body:'<ul><li><strong>The Board</strong> retains final authority over actions taken on its behalf.</li><li><strong>The Division</strong> oversees owner compliance and operator discipline under this rule.</li><li><strong>The Board\'s contractor</strong> may administer applications, exams, operator records, experience reviews, and training approvals.</li></ul><p>For everyday application and renewal tasks, use the Colorado Certified Water Professionals (CCWP) portal. Use the state operator resource hub to locate the right program contact.</p>',
    example:'For a missing course entry, start with certification administration. For the plant\'s assigned classification, seek the Division\'s facility-classification resources.',
    question:'Who retains final authority over the contractor\'s program decisions?',choices:['The facility owner','The examination vendor','The Board'],correct:2,
    explanation:'The contractor administers assigned functions; the Board retains final authority under section 100.3.3.'
  },
  {
    title:'Water Treatment Classes', section:'100.4', tag:'Drinking Water',
    takeaway:'Treatment runs D → C → B → A, with A the highest class.',
    body:'<p>The classification table uses <strong>treatment type and plant design flow in GPM</strong>. It is not based only on today\'s operating flow.</p><p>Selected table examples, not a complete classification tool:</p><div class="table-scroll"><table><caption>Selected Water Treatment Criteria</caption><thead><tr><th scope="col">Treatment</th><th scope="col">Under 350 GPM</th><th scope="col">350–1,400 GPM</th><th scope="col">Over 1,400 GPM</th></tr></thead><tbody><tr><th scope="row">Conventional / direct filtration with coagulants or polymers</th><td>B</td><td>A</td><td>A</td></tr><tr><th scope="row">Microfiltration / ultrafiltration</th><td>C</td><td>B</td><td>A</td></tr></tbody></table></div><p>The Division can account for facility-specific complexity. Confirm the assigned classification instead of self-classifying from these examples.</p>',
    example:'At 1,000 GPM design flow, conventional filtration falls in the table\'s A column, even if the plant is currently running below design flow.',
    question:'Which flow belongs in this water-treatment classification table?',choices:['The lowest flow last night','Plant design flow in GPM','Population only'],correct:1,
    explanation:'The table uses design flow and treatment type. Actual daily flow alone does not determine classification.'
  },
  {
    title:'Wastewater Treatment Classes', section:'100.5; 100.7', tag:'Domestic And Industrial',
    takeaway:'Domestic and industrial wastewater treatment have separate classification criteria.',
    body:'<p><strong>Domestic wastewater:</strong> section 100.5 uses process type and design hydraulic capacity in MGD. D is lowest; A is highest. Selected examples:</p><div class="table-scroll"><table><caption>Selected Domestic Wastewater Criteria</caption><thead><tr><th scope="col">Process</th><th scope="col">Below 0.5 MGD</th><th scope="col">0.5–1.00 MGD</th><th scope="col">Above 4.00 MGD</th></tr></thead><tbody><tr><th scope="row">Waste stabilization ponds</th><td>D</td><td>C</td><td>B</td></tr><tr><th scope="row">Trickling filter / RBC</th><td>C</td><td>C</td><td>A</td></tr></tbody></table></div><p><strong>Industrial wastewater:</strong> section 100.7 uses a separate process-based table. For example, neutralization appears under C, while reverse osmosis appears under A.</p><p>These are selected criteria. The full process train and facility-specific conditions matter; use the Division\'s assigned class.</p>',
    example:'A small industrial plant is not automatically Class D. Its treatment process may require a higher classification.',
    question:'Can you classify an industrial wastewater plant using only the domestic wastewater flow table?', choices:['Yes, if its flow is small','No; industrial treatment has its own criteria'],correct:1,
    explanation:'Section 100.7 provides industrial criteria. Section 100.5 addresses domestic wastewater treatment.'
  },
  {
    title:'Distribution: Population Plus Complexity', section:'100.8', tag:'Water Distribution',
    takeaway:'Distribution runs 1 → 2 → 3 → 4, with 4 the highest class.',
    body:'<p>Start with population, then check the additional complexity criteria.</p><div class="table-scroll"><table><caption>Step 1: Distribution Population Bands</caption><thead><tr><th scope="col">Class</th><th scope="col">Population Served</th></tr></thead><tbody><tr><th scope="row">1</th><td>3,300 or fewer</td></tr><tr><th scope="row">2</th><td>3,301–25,000</td></tr><tr><th scope="row">3</th><td>25,001–100,000</td></tr><tr><th scope="row">4</th><td>Over 100,000</td></tr></tbody></table></div><p>Population here is the average daily population in the busiest month or normal operating period, including resident and nonresident users.</p><p>Step 2 can raise a population-based Class 1 or 2. Examples include six or more qualifying pressure zones or normal pressure above 150 psi, each indicating at least Class 3.</p>',
    example:'A population of 20,000 starts at Class 2. Six qualifying pressure zones raise the table result to Class 3.',
    question:'Can complexity reduce a system below its population-based class?', choices:['Yes','No'],correct:1,
    explanation:'Step 2 accounts for additional complexity; it cannot lower the Step 1 classification.'
  },
  {
    title:'Collection: More Than Population', section:'100.9', tag:'Wastewater Collection',
    takeaway:'Collection also has Classes 1–4 and a two-step classification process.',
    body:'<p>Population bands are 3,300 or fewer (1), 3,301–25,000 (2), 25,001–100,000 (3), and over 100,000 (4).</p><p>Then assess the collection-specific criteria: lift-station capacities and counts, and significant industrial users. Selected examples:</p><ul><li>A single lift station with firm capacity of <strong>0.35–2.49 MGD</strong> indicates at least Class 2.</li><li>A single lift station with firm capacity of <strong>2.5 MGD or more</strong> indicates at least Class 3.</li></ul><p><strong>Firm capacity</strong> means installed pumping capacity with the largest unit out of service. Use the full rule for lift-station qualifications and exclusions.</p>',
    example:'A community may start at Class 1 by population but need Class 2 because of one qualifying lift station\'s capacity.',
    question:'How do you determine firm pumping capacity?',choices:['Add every pump, including the largest','Exclude the largest unit from installed pumping capacity'],correct:1,
    explanation:'Firm capacity accounts for the largest unit being out of service, rather than assuming all installed pumps are available.'
  },
  {
    title:'Your Duties As An Operator', section:'100.11', tag:'Every Shift',
    takeaway:'Use reasonable care, keep records, and report problems to the ORC.',
    body:'<ul><li><strong>Observe and respond:</strong> interpret readings and changes in operating conditions within your training and authority.</li><li><strong>Control and maintain:</strong> chemical addition, pumps, valves, flow, and treatment processes are operational responsibilities.</li><li><strong>Document:</strong> maintain logs and collect or analyze process-control samples.</li><li><strong>Communicate:</strong> report noncompliance and situations that could become noncompliance to the ORC.</li></ul><p>Work within the applicable written operating plan. Also update certification contact information within 30 days of a change.</p>',
    example:'A reading moves outside normal conditions. Record what you observed, follow the authorized response, and report the problem to the ORC.',
    question:'Should you wait for a confirmed violation before telling the ORC about a potential compliance problem?',choices:['Yes','No; report situations that could result in noncompliance too'],correct:1,
    explanation:'The reporting duty includes both actual noncompliance and situations that could lead to it.'
  },
  {
    title:'What Responsible Charge Means', section:'100.12.1–100.12.5', tag:'ORC Responsibilities',
    takeaway:'Responsible charge is active operational accountability.',
    body:'<p>The owner-designated ORC must hold a valid certificate meeting the facility\'s required level. Duties include process decisions, timely action, maintenance programs, and understanding applicable permits and rules.</p><p>The ORC also reports compliance problems as appropriate to the owner and Department.</p>',
    example:'Being named ORC requires involvement in operations, rather than simply letting the facility list your certificate.',
    question:'Does an ORC\'s role end after being listed on a contact form?',choices:['Yes','No; operational accountability continues'],correct:1,
    explanation:'The designation carries ongoing duties for facility operation and maintenance.'
  },
  {
    title:'Delegation And Operating Limits', section:'100.12.6', tag:'Working Under A Plan',
    takeaway:'Written limits explain what you may do and when to consult.',
    body:'<p>The ORC can delegate activities through a precise written operating plan, including work while the ORC is off-site. Review and update it as needed at least each calendar year; keep it available to staff and the owner.</p>',
    example:'A task exceeds the plan\'s limits. Immediately consult and involve the ORC or another operator certified at or above the facility class.',
    question:'Does delegation remove the ORC\'s accountability?',choices:['Yes','No'],correct:1,
    explanation:'The ORC remains accountable for delegated work.'
  },
  {
    title:'Qualifying For Certification', section:'100.14', tag:'Your Certification Path',
    takeaway:'Check education, experience, prior certification, and approved regulatory training.',
    body:'<div class="table-scroll"><table><caption>Baseline Experience And Prior Certification</caption><thead><tr><th scope="col">Target Class</th><th scope="col">Prior Certificate</th><th scope="col">Experience</th></tr></thead><tbody><tr><th scope="row">T</th><td>None</td><td>No minimum</td></tr><tr><th scope="row">S / D / 1</th><td>None</td><td>1 month</td></tr><tr><th scope="row">C / 2</th><td>D or S / 1 or S</td><td>2 years</td></tr><tr><th scope="row">B / 3</th><td>C / 2</td><td>3 years</td></tr><tr><th scope="row">A / 4</th><td>B / 3</td><td>4 years</td></tr></tbody></table></div><p>Prior certification must be in the same category. Approved substitutions and entry-level alternatives have conditions; request an eligibility review.</p><p>Approved mandatory regulatory training (MRT) is required before applying; each completion is valid for three years. A new certificate requires a passing exam score of at least 70%.</p>',
    example:'Class B requires three years of qualifying experience, not an automatic additional three years after earning C.',
    question:'Can training automatically replace all experience at every level?',choices:['Yes','No; substitution limits and approval apply'],correct:1,
    explanation:'Eligibility depends on approved education, experience, and the target category and class.'
  },
  {
    title:'Exams And New Certificates', section:'100.15', tag:'Application To Certification',
    takeaway:'Use exam results to guide your next study session.',
    body:'<ol><li>Obtain approval for the appropriate examination.</li><li>Follow the exam administrator\'s current scheduling and testing instructions.</li><li>Review the performance analysis by topic after testing.</li><li>After all qualifications are satisfied, confirm issuance and the effective date of your certificate.</li></ol><p>A new certificate lasts three years from its effective date.</p><p>If unsuccessful, the rule allows retesting within the 100-day eligibility period without another application/administration fee. This does not mean the next examination is free; exam fees are separate.</p>',
    example:'A weak result in one topic gives you a focused review target before retesting.',
    question:'Does a retest within the eligibility period necessarily waive the exam fee?',choices:['Yes','No; the rule distinguishes application fees from exam fees'],correct:1,
    explanation:'Section 100.15.1(e) addresses additional application and administration fees, not a blanket waiver of exam fees.'
  },
  {
    title:'Renewal: Units, Dates, And Expiration', section:'100.16', tag:'Keep Your Certificate Current',
    takeaway:'Plan your training by certificate category and renew before expiration.',
    body:'<div class="table-scroll"><table><caption>Training Units Per Renewal Cycle</caption><thead><tr><th scope="col">Class</th><th scope="col">Required TUs</th></tr></thead><tbody><tr><th scope="row">T / D / 1</th><td>1.2</td></tr><tr><th scope="row">S / C / 2</th><td>1.8</td></tr><tr><th scope="row">B / 3</th><td>2.4</td></tr><tr><th scope="row">A / 4</th><td>3.0</td></tr></tbody></table></div><ul><li>At least half must be approved in the certificate\'s specific category.</li><li>MRT credits count within the required total, not on top.</li><li>Unused units do not carry into the next cycle.</li></ul><p>A certificate is invalid at expiration. The two-year restoration window is not permission to operate as ORC with an expired certificate. After that window, automatic revocation applies. Renewed validity runs from the prior expiration date.</p>',
    example:'For B renewal, 2.4 TUs are needed, including at least 1.2 approved for that category.',
    question:'Is the two-year restoration period an extension of valid ORC certification?',choices:['Yes','No'],correct:1,
    explanation:'The certificate is invalid upon expiration; restoration is a separate process.'
  },
  {
    title:'What The Facility Owner Must Do', section:'100.10', tag:'Owner Responsibilities',
    takeaway:'The owner must arrange qualified supervision and make it workable.',
    body:'<ul><li>Designate ORCs through the appropriate Division contact update form.</li><li>Make agreements detailed enough to cover the ORC\'s duties.</li><li>Ensure the ORC is available, or operations follow the written operating plan, whenever the facility operates.</li><li>Reserve the relevant process-control and integrity decisions to appropriately qualified operators under the rule.</li></ul><p>A sampling-only contract does not satisfy the requirement for ORC supervision. Availability means on-site or contactable as needed for timely decisions and action.</p>',
    example:'Hiring someone to collect monthly samples does not by itself establish responsible charge for the treatment facility.',
    question:'Does a compliance-sampling contract alone meet the owner\'s ORC obligation?',choices:['Yes','No'],correct:1,
    explanation:'Limited services are different from the full responsibility required of an ORC.'
  },
  {
    title:'Professional Conduct And Fees', section:'100.13; 100.17', tag:'Protect Your Certification',
    takeaway:'Accurate records and professional judgment are part of certification.',
    body:'<p>False information, negligent operation, exam dishonesty, and misrepresenting an expired certificate can lead to discipline. Outcomes can include reprimand, suspension, or revocation.</p><p><strong>Fees are separate items:</strong> the published schedule lists $50 for an examination application, $104 per exam, $85 for renewal, $100 for late renewal, and $150 for reciprocity applications. Check the current rule and portal when applying.</p><p>Use official sources below to confirm requirements for your situation.</p>',
    example:'If you discover an incorrect record, preserve an honest account of the issue and follow the facility\'s correction procedure instead of concealing it.',
    question:'Can an operator keep claiming a valid certificate after it expires?', choices:['Yes, while planning renewal','No'],correct:1,
    explanation:'Misrepresenting an expired certificate is a disciplinary issue, not just a paperwork delay.'
  }
];

window.reg100RuleIndex='https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2392&seriesNum=5+CCR+1003-2';
const escapeStudyText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('.slideshow-container').innerHTML=window.reg100Lessons.map((lesson,index)=>{
  const sections=[...new Set(lesson.section.match(/100\.\d+/g))];
  return `<article class="slide${index===0?' active':''}" data-slide="${index+1}"><div class="slide-content"><p class="lesson-kicker">${escapeStudyText(lesson.tag)} <span>Section ${escapeStudyText(lesson.section)}</span></p><h2>${escapeStudyText(lesson.title)}</h2><div class="key-takeaway"><strong>Remember This</strong><p>${escapeStudyText(lesson.takeaway)}</p></div><div class="content-section">${lesson.body}</div><div class="lesson-example"><h3>Put It Into Practice</h3><p>${escapeStudyText(lesson.example)}</p><small>Illustrative study example</small></div><fieldset class="knowledge-check" data-question="${index}"><legend>Check Your Understanding</legend><p>${escapeStudyText(lesson.question)}</p><div class="answer-options">${lesson.choices.map((choice,i)=>`<button type="button" class="answer-option" data-answer="${i}" aria-pressed="false">${escapeStudyText(choice)}</button>`).join('')}</div><p class="answer-feedback" role="status" hidden></p><p class="print-answer">Answer: ${escapeStudyText(lesson.choices[lesson.correct])}</p></fieldset><div class="lesson-bottom"><button type="button" class="nav-btn review-lesson" aria-pressed="false">Mark As Reviewed</button><p class="lesson-source">Read The Rule: ${sections.map(s=>`<a href="https://www.law.cornell.edu/regulations/colorado/5-CCR-1003-2-${s}" target="_blank" rel="noopener">${s} Section Text</a>`).join(' · ')}<br><a href="${window.reg100RuleIndex}" target="_blank" rel="noopener">Official Current Version (Colorado SOS)</a></p></div></div></article>`;
}).join('');
