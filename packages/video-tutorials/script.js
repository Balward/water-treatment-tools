// Function to get the correct video path based on environment
function getVideoPath(filename) {
    // Check if we're running locally (file://) or on the hosted server
    if (window.location.protocol === 'file:') {
        return `../../Videos/${filename}`;
    } else if (window.location.hostname === 'water.gibbhub.io') {
        return `/Videos/${filename}`;
    } else {
        // For local development or other environments
        return `/Videos/${filename}`;
    }
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
        }
    ];
}

const videoGrid = document.getElementById('videoGrid');
const modal = document.getElementById('videoModal');
const modalVideo = document.getElementById('modalVideo');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.querySelector('.close');

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    const videoPath = getVideoPath(video.filename);
    
    card.innerHTML = `
        <div class="video-info">
            <div class="video-title">${video.title}</div>
            <div class="video-description">${video.description}</div>
        </div>
        <div class="video-thumbnail">
            <video muted preload="metadata">
                <source src="${videoPath}" type="video/mp4">
            </video>
            <div class="play-icon">▶</div>
        </div>
    `;

    card.addEventListener('click', () => {
        openModal(video);
    });

    // Set thumbnail to show frame from middle portion of video
    const thumbnailVideo = card.querySelector('video');
    thumbnailVideo.addEventListener('loadedmetadata', () => {
        if (thumbnailVideo.duration && isFinite(thumbnailVideo.duration)) {
            // Use a consistent frame from the middle 60% of the video (20%-80%)
            // Create a hash from filename for consistent thumbnail selection
            const hash = video.filename.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            
            // Use hash to select consistent frame position for this video
            const normalizedHash = Math.abs(hash) / 2147483647; // Normalize to 0-1
            const framePosition = 0.2 + (normalizedHash * 0.6); // 20% to 80% of video
            const thumbnailTime = thumbnailVideo.duration * framePosition;
            
            thumbnailVideo.currentTime = thumbnailTime;
        }
    });
    
    // Handle video loading errors gracefully
    thumbnailVideo.addEventListener('error', (e) => {
        console.warn(`Failed to load thumbnail for ${video.filename}:`, e);
        // Hide the play icon if video fails to load
        const playIcon = card.querySelector('.play-icon');
        if (playIcon) playIcon.style.display = 'none';
    });

    return card;
}

function openModal(video) {
    modalVideo.src = getVideoPath(video.filename);
    modalTitle.textContent = video.title;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.style.display = 'none';
    modalVideo.pause();
    modalVideo.src = '';
    document.body.style.overflow = 'auto';
}

// Event listeners
closeBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Function to load and display videos
function loadVideos() {
    // Clear existing video cards
    videoGrid.innerHTML = '';
    
    const videos = getVideos();
    
    if (videos.length === 0) {
        videoGrid.innerHTML = '<div class="error-message">No videos found.</div>';
        return;
    }
    
    videos.forEach(video => {
        const card = createVideoCard(video);
        videoGrid.appendChild(card);
    });
}


// Load videos on page load
document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
});