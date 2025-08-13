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

// Function to fetch videos from multiple sources
async function fetchVideos() {
    try {
        // First, try to load from generated video data (Z: drive scanning)
        if (typeof DISCOVERED_VIDEOS !== 'undefined' && DISCOVERED_VIDEOS.length > 0) {
            console.log('Using discovered videos from Z: drive mapping');
            return DISCOVERED_VIDEOS;
        }
        
        // Fallback to API for server deployment
        const response = await fetch('/api/videos');
        if (response.ok) {
            const videos = await response.json();
            console.log('Using videos from API');
            return videos;
        }
        
        // Final fallback to hardcoded videos
        console.warn('Neither discovered videos nor API available, using fallback videos');
        return getFallbackVideos();
    } catch (error) {
        console.warn('Failed to fetch videos, using fallback:', error);
        return getFallbackVideos();
    }
}

// Fallback videos for local development or if API fails
function getFallbackVideos() {
    return [
        {
            filename: 'Unit Conversions.mp4',
            title: 'Unit Conversions',
            description: 'Master converting between metric and imperial units for flow rates, volumes, pressures, and chemical concentrations in water treatment'
        },
        {
            filename: 'Working with Formulas.mp4',
            title: 'Working with Formulas',
            description: 'Step-by-step approach to solving water treatment formulas including detention time, flow calculations, and chemical dosing equations'
        },
        {
            filename: 'Calculating Area.mp4',
            title: 'Calculating Area',
            description: 'Calculate surface areas for tanks, basins, and treatment units - essential for loading rates, detention times, and process design'
        },
        {
            filename: 'Understanding Percentages.mp4',
            title: 'Understanding Percentages',
            description: 'Apply percentage calculations to chemical concentrations, removal efficiencies, and treatment performance metrics'
        },
        {
            filename: 'Calculating Volume.mp4',
            title: 'Calculating Volume',
            description: 'Learn to calculate volumes for tanks, reservoirs, and treatment units - critical for storage capacity and chemical dosing calculations'
        },
        {
            filename: 'Chemical Dose Problems.mp4',
            title: 'Chemical Dose Problems',
            description: 'Master chemical dosing calculations including chlorine, coagulants, and pH adjustment chemicals for optimal treatment performance'
        },
        {
            filename: 'Flow Problems.mp4',
            title: 'Flow Problems',
            description: 'Solve flow rate problems, including pump calculations, pipe sizing, and hydraulic loading rates for treatment processes'
        },
        {
            filename: 'Force-Pressure-Head.mp4',
            title: 'Force, Pressure & Head',
            description: 'Understand relationships between force, pressure, and head calculations essential for pump operations and system design'
        },
        {
            filename: 'Problem Solving.mp4',
            title: 'Problem Solving',
            description: 'Develop systematic approaches to tackle complex water treatment math problems and exam questions with confidence'
        },
        {
            filename: 'Pumps.mp4',
            title: 'Pumps',
            description: 'Learn pump calculations including efficiency, power requirements, and performance curves for water treatment applications'
        },
        {
            filename: 'Source Water Review 1.mp4',
            title: 'Source Water Review 1',
            description: 'Comprehensive review of source water quality parameters, sampling procedures, and regulatory requirements for treatment planning'
        },
        {
            filename: 'The Metric System.mp4',
            title: 'The Metric System',
            description: 'Master metric system fundamentals and conversions essential for water treatment calculations and international standards'
        },
        {
            filename: 'Velocity and Flow Rate.mp4',
            title: 'Velocity and Flow Rate',
            description: 'Calculate velocity and flow rates in pipes, channels, and treatment units - fundamental for hydraulic design and operations'
        },
        {
            filename: 'Weight-Volume Relationships.mp4',
            title: 'Weight-Volume Relationships',
            description: 'Understand density, specific gravity, and weight-volume relationships for chemical mixing and treatment process calculations'
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
async function loadVideos() {
    try {
        // Clear existing video cards
        videoGrid.innerHTML = '';
        
        const videos = await fetchVideos();
        
        if (videos.length === 0) {
            videoGrid.innerHTML = '<div class="error-message">No videos found. Please add video files to the Videos directory.</div>';
            return;
        }
        
        videos.forEach(video => {
            const card = createVideoCard(video);
            videoGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load videos:', error);
        // Show error message to user
        videoGrid.innerHTML = '<div class="error-message">Failed to load videos. Please refresh the page.</div>';
    }
}

// Add refresh button functionality
function addRefreshButton() {
    const header = document.querySelector('.header .nav');
    if (header && !document.getElementById('refreshBtn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshBtn';
        refreshBtn.className = 'refresh-btn';
        refreshBtn.innerHTML = '🔄 Refresh Videos';
        refreshBtn.title = 'Reload video list to detect new or removed videos';
        refreshBtn.addEventListener('click', () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '🔄 Loading...';
            loadVideos().finally(() => {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄 Refresh Videos';
            });
        });
        header.insertBefore(refreshBtn, header.firstChild);
    }
}

// Load videos on page load
document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
    addRefreshButton();
});