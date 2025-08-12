const videos = [
    {
        filename: 'Unit Conversions.mp4',
        title: 'Unit Conversions',
        description: 'Learn essential unit conversion techniques for water treatment calculations',
        path: '../../Videos/Unit Conversions.mp4'
    },
    {
        filename: 'Working with Formulas.mp4',
        title: 'Working with Formulas',
        description: 'Master formula applications in water treatment operations and calculations',
        path: '../../Videos/Working with Formulas.mp4'
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