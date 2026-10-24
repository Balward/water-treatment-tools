// Function to get the correct video path based on environment
function getVideoPath(filename) {
    // Check if we're running locally (file://) or on the hosted server
    if (window.location.protocol === 'file:') {
        // Local file system - use Z: drive path for Windows
        return `Z:/water-treatment-tools/Videos/${filename}`;
    } else {
        // Hosted server - videos should be accessible at /Videos/
        return `/Videos/${filename}`;
    }
}

// Function to get thumbnail path
function getThumbnailPath(filename) {
    // Extract base name and replace with .svg extension
    const baseName = filename.replace('.mp4', '');
    
    // Map video filenames to thumbnail filenames (handle special characters)
    const thumbnailMapping = {
        // No mappings needed - using exact filenames
    };
    
    // Use mapped name if it exists, otherwise use the base name
    const thumbnailName = thumbnailMapping[baseName] || baseName;
    
    // Add cache-busting parameter to force browser to reload thumbnails
    const cacheBuster = '20250813015';
    return `thumbnails/${thumbnailName}.svg?v=${cacheBuster}`;
}

// Function to get static video list
function getVideos() {
    return getStaticVideos();
}

// Static video list
function getStaticVideos() {
    return [
        {
            filename: '1 - Unit Conversions.mp4',
            title: '1 - Unit Conversions',
            description: 'Master converting between metric and imperial units for flow rates, volumes, pressures, and chemical concentrations in water treatment'
        },
        {
            filename: '2 - Working With Formulas.mp4',
            title: '2 - Working With Formulas',
            description: 'Step-by-step approach to solving water treatment formulas including detention time, flow calculations, and chemical dosing equations'
        },
        {
            filename: '3 - Understanding Percentages.mp4',
            title: '3 - Understanding Percentages',
            description: 'Apply percentage calculations to chemical concentrations, removal efficiencies, and treatment performance metrics'
        },
        {
            filename: '4 - Calculating Area.mp4',
            title: '4 - Calculating Area',
            description: 'Calculate surface areas for tanks, basins, and treatment units - essential for loading rates, detention times, and process design'
        },
        {
            filename: '5 - Calculating Volume.mp4',
            title: '5 - Calculating Volume',
            description: 'Learn to calculate volumes for tanks, reservoirs, and treatment units - critical for storage capacity and chemical dosing calculations'
        },
        {
            filename: '6 - Weight-Volume Relationships.mp4',
            title: '6 - Weight-Volume Relationships',
            description: 'Understand density, specific gravity, and weight-volume relationships for chemical mixing and treatment process calculations'
        },
        {
            filename: '7 - Force-Pressure-Head.mp4',
            title: '7 - Force, Pressure & Head',
            description: 'Understand relationships between force, pressure, and head calculations essential for pump operations and system design'
        },
        {
            filename: '8 - Velocity and Flow Rate.mp4',
            title: '8 - Velocity and Flow Rate',
            description: 'Calculate velocity and flow rates in pipes, channels, and treatment units - fundamental for hydraulic design and operations'
        },
        {
            filename: '9 - Pumps.mp4',
            title: '9 - Pumps',
            description: 'Learn pump calculations including efficiency, power requirements, and performance curves for water treatment applications'
        },
        {
            filename: '10 - The Metric System.mp4',
            title: '10 - The Metric System',
            description: 'Master metric system fundamentals and conversions essential for water treatment calculations and international standards'
        },
        {
            filename: '11 - Problem Solving.mp4',
            title: '11 - Problem Solving',
            description: 'Develop systematic approaches to tackle complex water treatment math problems and exam questions with confidence'
        },
        {
            filename: '12 - Flow Problems.mp4',
            title: '12 - Flow Problems',
            description: 'Solve flow rate problems, including pump calculations, pipe sizing, and hydraulic loading rates for treatment processes'
        },
        {
            filename: '13 - Chemical Dose Problems.mp4',
            title: '13 - Chemical Dose Problems',
            description: 'Master chemical dosing calculations including chlorine, coagulants, and pH adjustment chemicals for optimal treatment performance'
        },
        {
            filename: '14 - Source Water.mp4',
            title: '14 - Source Water',
            description: 'Comprehensive review of source water quality parameters, sampling procedures, and regulatory requirements for treatment planning'
        },
        {
            filename: '15 - Water Wells.mp4',
            title: '15 - Water Wells',
            description: 'Learn about water well systems, pumping calculations, and groundwater quality considerations for water treatment'
        },
        {
            filename: '16 - Reservoir Problems.mp4',
            title: '16 - Reservoir Problems',
            description: 'Solve problems related to reservoir storage, capacity calculations, and water supply management'
        },
        {
            filename: '17 - Coagulation and Flocculation.mp4',
            title: '17 - Coagulation and Flocculation',
            description: 'Understand the theory and process of coagulation and flocculation in water treatment systems'
        },
        {
            filename: '18 - Coagulation and Flocculation Problems.mp4',
            title: '18 - Coagulation and Flocculation Problems',
            description: 'Practice calculations for coagulant dosing, mixing requirements, and flocculation basin design'
        },
        {
            filename: '19 - Sedimentation.mp4',
            title: '19 - Sedimentation',
            description: 'Learn the principles of sedimentation basins and settling processes in water treatment'
        },
        {
            filename: '20 - Sedimentation Problems.mp4',
            title: '20 - Sedimentation Problems',
            description: 'Practice sedimentation calculations including settling velocity, overflow rates, and basin design'
        },
        {
            filename: '21 - Filtration.mp4',
            title: '21 - Filtration',
            description: 'Understand filtration processes, filter media, and backwashing procedures in water treatment'
        },
        {
            filename: '22 - Filtration Problems.mp4',
            title: '22 - Filtration Problems',
            description: 'Practice filtration calculations including filter loading rates, headloss, and backwash requirements'
        },
        {
            filename: '23 - Disinfection.mp4',
            title: '23 - Disinfection',
            description: 'Learn about disinfection methods, chlorine chemistry, and CT calculations for pathogen inactivation'
        },
        {
            filename: '24 - Disinfection Problems.mp4',
            title: '24 - Disinfection Problems',
            description: 'Practice disinfection calculations including chlorine dosing, CT values, and disinfection byproduct formation'
        },
        {
            filename: '25 - Pumps and Motors.mp4',
            title: '25 - Pumps and Motors',
            description: 'Learn about pump types, motor efficiency calculations, and electrical power requirements for water treatment systems'
        },
        {
            filename: '26 - Electricity.mp4',
            title: '26 - Electricity',
            description: 'Understand electrical fundamentals, power calculations, and energy costs for water treatment facility operations'
        },
        {
            filename: '27 - Corrosion Control.mp4',
            title: '27 - Corrosion Control',
            description: 'Learn about corrosion mechanisms, inhibitor dosing, and pH adjustment for distribution system protection'
        },
        {
            filename: '28 - Fluoridation.mp4',
            title: '28 - Fluoridation',
            description: 'Understand fluoride dosing calculations, equipment calibration, and monitoring procedures for dental health benefits'
        },
        {
            filename: '29 - Iron and Manganese.mp4',
            title: '29 - Iron and Manganese',
            description: 'Learn about iron and manganese removal processes, oxidation calculations, and filtration design'
        },
        {
            filename: '30 - Lime Softening.mp4',
            title: '30 - Lime Softening',
            description: 'Master lime softening calculations, hardness removal, and chemical feed system design'
        },
        {
            filename: '31 - Regulations.mp4',
            title: '31 - Regulations',
            description: 'Understand drinking water regulations, monitoring requirements, and compliance calculations'
        },
        {
            filename: '32 - Membrane Technology.mp4',
            title: '32 - Membrane Technology',
            description: 'Learn about membrane processes including RO, nanofiltration, and ultrafiltration design calculations'
        },
        {
            filename: '33 - Aeration.mp4',
            title: '33 - Aeration',
            description: 'Understand aeration processes, oxygen transfer calculations, and equipment sizing for treatment applications'
        },
        {
            filename: '34 - Adsorption.mp4',
            title: '34 - Adsorption',
            description: 'Learn about activated carbon adsorption, contact time calculations, and carbon replacement schedules'
        },
        {
            filename: '35 - Laboratory.mp4',
            title: '35 - Laboratory',
            description: 'Understand laboratory testing procedures, quality control, and data interpretation for water treatment monitoring'
        },
        {
            filename: '36 - Laboratory Problems.mp4',
            title: '36 - Laboratory Problems',
            description: 'Practice laboratory calculations including dilutions, standard preparations, and analytical result interpretations'
        },
        {
            filename: '37 - Treatment Plant Chemicals.mp4',
            title: '37 - Treatment Plant Chemicals',
            description: 'Learn about chemical selection, storage requirements, and safety considerations for water treatment operations'
        },
        {
            filename: '38 - Management Principles.mp4',
            title: '38 - Management Principles',
            description: 'Understand management fundamentals, personnel supervision, and operational decision-making for water treatment facilities'
        }
    ];
}

const videoGrid = document.getElementById('videoGrid');
const modal = document.getElementById('videoModal');
const modalVideo = document.getElementById('modalVideo');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.querySelector('.wt-modal-close');

function getVideoCategory(videoNum) {
    if (videoNum <= 13) return { name: 'Basics', class: 'basics' };
    if (videoNum <= 30) return { name: 'Processes', class: 'processes' };
    if (videoNum <= 36) return { name: 'Advanced', class: 'advanced' };
    return { name: 'Management', class: 'management' };
}

function getEstimatedDuration(videoNum) {
    // Actual video durations extracted from video files
    const durations = {
        1: '24m 47s',
        2: '15m 49s',
        3: '7m 35s',
        4: '13m 50s',
        5: '8m 25s',
        6: '9m 50s',
        7: '13m 16s',
        8: '10m 49s',
        9: '12m 46s',
        10: '6m 38s',
        11: '30m 21s',
        12: '10m 50s',
        13: '48m 8s',
        14: '63m 44s',
        15: '9m 38s',
        16: '20m 59s',
        17: '56m 59s',
        18: '19m 26s',
        19: '56m 55s',
        20: '25m 11s',
        21: '55m 45s',
        22: '26m 57s',
        23: '95m 51s',
        24: '24m 46s',
        25: '54m 10s',
        26: '8m 36s',
        27: '43m 49s',
        28: '20m 59s',
        29: '23m 33s',
        30: '54m 25s',
        31: '88m 49s',
        32: '25m 41s',
        33: '18m 36s',
        34: '23m 38s',
        35: '15m 34s',
        36: '12m',
        37: '13m 5s',
        38: '8m 45s'
    };
    
    return durations[videoNum] || '30m';
}

const categories=[['all','All Lessons','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 8 6 4-6 4V8Z"/>'],['basics','Basics','<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h1m6 0h1M8 16h1m6 0h1"/>'],['processes','Processes','<path d="M3 4h6v6H3zM15 14h6v6h-6zM9 7h9v7M6 10v7h9"/>'],['advanced','Advanced','<path d="M8 3h8M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 16h10"/>'],['management','Management','<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>']];
const lessons=getVideos().map(video=>{const number=parseInt(video.filename,10);return{...video,number,category:getVideoCategory(number),duration:getEstimatedDuration(number)}});
let selected='all',opener=null;
const search=document.getElementById('lessonSearch');
function renderCategories(){
  document.getElementById('categoryNav').innerHTML=categories.map(([id,name,paths])=>'<button type="button" class="nav-item" data-category="'+id+'" aria-pressed="'+(selected===id)+'"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg></span><span>'+name+'</span><small class="nav-count">'+(id==='all'?lessons.length:lessons.filter(v=>v.category.class===id).length)+'</small></button>').join('');
}
function renderLessons(){
  const query=search.value.trim().toLowerCase();
  const matches=lessons.filter(v=>(selected==='all'||v.category.class===selected)&&[v.title,v.description,v.category.name].join(' ').toLowerCase().includes(query));
  videoGrid.replaceChildren();
  matches.forEach(video=>{
    const article=document.createElement('article');article.className='video-card '+video.category.class;
    const button=document.createElement('button');button.className='watch-lesson';button.type='button';button.dataset.lesson=video.number;button.setAttribute('aria-label','Watch '+video.title);
    button.innerHTML='<div class="lesson-art" aria-hidden="true"><span class="art-caption">CLASS A TRAINING</span><span class="lesson-number">'+String(video.number).padStart(2,'0')+'</span><span class="play-icon"><svg viewBox="0 0 24 24"><path d="m9 5 11 7-11 7V5Z"/></svg></span><span class="art-duration">'+video.duration+'</span></div><div class="lesson-info"><div class="lesson-meta"><span class="category-label">'+video.category.name+'</span><span>Lesson '+String(video.number).padStart(2,'0')+'</span></div><h3>'+video.title.replace(/^\d+ - /,'')+'</h3><p>'+video.description+'</p><span class="watch-label">Watch Lesson <span aria-hidden="true">→</span></span></div>';
    button.addEventListener('click',()=>openModal(video,button));article.append(button);videoGrid.append(article);
  });
  document.getElementById('lessonCount').textContent=matches.length===lessons.length?'38 Lessons':matches.length+' of 38 Lessons';
  document.getElementById('libraryTitle').textContent=selected==='all'?'Video Library':categories.find(c=>c[0]===selected)[1]+' Lessons';
  document.getElementById('clearFilters').hidden=selected==='all'&&!query;
  document.getElementById('emptyState').hidden=matches.length>0;
}
function openModal(video,button){
  opener=button;modalTitle.textContent=video.title;
  document.getElementById('modalMeta').textContent=video.category.name+' · '+video.duration;
  document.getElementById('playerMessage').textContent='Use the video controls to play, pause, or enter full screen.';
  modalVideo.src=getVideoPath(video.filename);document.getElementById('openVideo').href=modalVideo.src;
  modal.showModal();document.body.classList.add('video-playing');
}
function closeModal(){if(modal.open)modal.close()}
modal.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.fullscreenElement){event.preventDefault();closeModal()}});
modal.addEventListener('close',()=>{modalVideo.pause();modalVideo.removeAttribute('src');modalVideo.load();document.body.classList.remove('video-playing');opener?.focus({preventScroll:true})});
closeBtn.addEventListener('click',closeModal);
modal.addEventListener('click',event=>{const r=modal.getBoundingClientRect();if(event.target===modal&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))closeModal()});
modalVideo.addEventListener('error',()=>{if(modal.open)document.getElementById('playerMessage').textContent='This lesson could not be loaded. Try opening the video in a new tab.'});
document.getElementById('categoryNav').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(!button)return;selected=button.dataset.category;document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderLessons()});
search.addEventListener('input',renderLessons);
function resetFilters(){selected='all';search.value='';renderCategories();renderLessons()}
document.getElementById('clearFilters').addEventListener('click',resetFilters);document.getElementById('emptyReset').addEventListener('click',resetFilters);
renderCategories();renderLessons();
