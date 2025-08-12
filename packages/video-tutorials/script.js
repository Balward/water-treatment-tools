const videos = [
    {
        filename: 'Unit Conversions.mp4',
        title: 'Unit Conversions',
        description: 'Master converting between metric and imperial units for flow rates, volumes, pressures, and chemical concentrations in water treatment',
        path: '../../Videos/Unit Conversions.mp4'
    },
    {
        filename: 'Working with Formulas.mp4',
        title: 'Working with Formulas',
        description: 'Step-by-step approach to solving water treatment formulas including detention time, flow calculations, and chemical dosing equations',
        path: '../../Videos/Working with Formulas.mp4'
    },
    {
        filename: 'Calculating Area.mp4',
        title: 'Calculating Area',
        description: 'Calculate surface areas for tanks, basins, and treatment units - essential for loading rates, detention times, and process design',
        path: '../../Videos/Calculating Area.mp4'
    },
    {
        filename: 'Understanding Percentages.mp4',
        title: 'Understanding Percentages',
        description: 'Apply percentage calculations to chemical concentrations, removal efficiencies, and treatment performance metrics',
        path: '../../Videos/Understanding Percentages.mp4'
    }
];

const videoGrid = document.getElementById('videoGrid');
const modal = document.getElementById('videoModal');
const modalVideo = document.getElementById('modalVideo');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.querySelector('.close');

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    
    card.innerHTML = `
        <div class="video-thumbnail">
            <video muted preload="metadata">
                <source src="${video.path}" type="video/mp4">
            </video>
            <div class="play-icon">▶</div>
        </div>
        <div class="video-info">
            <div class="video-title">${video.title}</div>
            <div class="video-description">${video.description}</div>
        </div>
    `;

    card.addEventListener('click', () => {
        openModal(video);
    });

    // Set thumbnail to show random frame
    const thumbnailVideo = card.querySelector('video');
    thumbnailVideo.addEventListener('loadedmetadata', () => {
        // Generate random time between 10% and 80% of video duration
        const randomTime = thumbnailVideo.duration * (0.1 + Math.random() * 0.7);
        thumbnailVideo.currentTime = randomTime;
    });

    return card;
}

function openModal(video) {
    modalVideo.src = video.path;
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

// Load videos on page load
document.addEventListener('DOMContentLoaded', () => {
    videos.forEach(video => {
        const card = createVideoCard(video);
        videoGrid.appendChild(card);
    });
});