// Slideshow functionality
class RegulationStudyApp {
  constructor() {
    this.currentSlide = 1;
    this.totalSlides = document.querySelectorAll('.slide').length;
    this.bookmarks = JSON.parse(localStorage.getItem('regulation100-bookmarks') || '[]');
    this.studyProgress = JSON.parse(localStorage.getItem('regulation100-progress') || '{}');
    this.notes = JSON.parse(localStorage.getItem('regulation100-notes') || '{}');
    
    this.init();
  }

  init() {
    this.updateSlideCounter();
    this.setupEventListeners();
    this.loadProgress();
    this.markSlideAsViewed(this.currentSlide);
  }

  setupEventListeners() {
    // Navigation buttons
    document.getElementById('prevBtn').addEventListener('click', () => this.previousSlide());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextSlide());
    
    // Study control buttons
    document.getElementById('progressBtn').addEventListener('click', () => this.showProgress());
    document.getElementById('bookmarkBtn').addEventListener('click', () => this.toggleBookmark());
    document.getElementById('notesBtn').addEventListener('click', () => this.showNotes());
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.previousSlide();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextSlide();
          break;
        case 'Home':
          e.preventDefault();
          this.goToSlide(1);
          break;
        case 'End':
          e.preventDefault();
          this.goToSlide(this.totalSlides);
          break;
        case 'b':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.toggleBookmark();
          }
          break;
      }
    });

    // Touch/swipe support for mobile
    let startX = 0;
    let endX = 0;
    
    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });
    
    document.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX;
      this.handleSwipe(startX, endX);
    });
  }

  handleSwipe(startX, endX) {
    const minSwipeDistance = 50;
    const swipeDistance = Math.abs(startX - endX);
    
    if (swipeDistance > minSwipeDistance) {
      if (startX > endX) {
        // Swipe left - next slide
        this.nextSlide();
      } else {
        // Swipe right - previous slide
        this.previousSlide();
      }
    }
  }

  nextSlide() {
    if (this.currentSlide < this.totalSlides) {
      this.goToSlide(this.currentSlide + 1);
    }
  }

  previousSlide() {
    if (this.currentSlide > 1) {
      this.goToSlide(this.currentSlide - 1);
    }
  }

  goToSlide(slideNumber) {
    if (slideNumber < 1 || slideNumber > this.totalSlides) return;
    
    // Hide current slide
    const currentSlideElement = document.querySelector('.slide.active');
    if (currentSlideElement) {
      currentSlideElement.classList.remove('active');
    }
    
    // Show new slide
    const newSlideElement = document.querySelector(`[data-slide="${slideNumber}"]`);
    if (newSlideElement) {
      newSlideElement.classList.add('active');
    }
    
    this.currentSlide = slideNumber;
    this.updateSlideCounter();
    this.updateNavigationButtons();
    this.markSlideAsViewed(slideNumber);
    this.saveProgress();
    
    // Scroll to top of slide
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateSlideCounter() {
    document.getElementById('currentSlide').textContent = this.currentSlide;
    document.getElementById('totalSlides').textContent = this.totalSlides;
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    prevBtn.disabled = this.currentSlide === 1;
    nextBtn.disabled = this.currentSlide === this.totalSlides;
  }

  markSlideAsViewed(slideNumber) {
    if (!this.studyProgress.viewedSlides) {
      this.studyProgress.viewedSlides = [];
    }
    
    if (!this.studyProgress.viewedSlides.includes(slideNumber)) {
      this.studyProgress.viewedSlides.push(slideNumber);
    }
    
    this.studyProgress.lastViewed = slideNumber;
    this.studyProgress.lastAccessDate = new Date().toISOString();
  }

  saveProgress() {
    localStorage.setItem('regulation100-progress', JSON.stringify(this.studyProgress));
  }

  loadProgress() {
    // Progress is still tracked but no resume prompt is shown
    // Users always start from slide 1
  }

  toggleBookmark() {
    const slideIndex = this.bookmarks.indexOf(this.currentSlide);
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    
    if (slideIndex === -1) {
      // Add bookmark
      this.bookmarks.push(this.currentSlide);
      bookmarkBtn.style.background = 'linear-gradient(45deg, #ffc107, #ffb300)';
      bookmarkBtn.textContent = '★ Bookmarked';
      this.showToast('Slide bookmarked!');
    } else {
      // Remove bookmark
      this.bookmarks.splice(slideIndex, 1);
      bookmarkBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      bookmarkBtn.textContent = 'Bookmark';
      this.showToast('Bookmark removed!');
    }
    
    localStorage.setItem('regulation100-bookmarks', JSON.stringify(this.bookmarks));
    
    // Reset button after 2 seconds
    setTimeout(() => {
      this.updateBookmarkButton();
    }, 2000);
  }

  updateBookmarkButton() {
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    const isBookmarked = this.bookmarks.includes(this.currentSlide);
    
    if (isBookmarked) {
      bookmarkBtn.style.background = 'linear-gradient(45deg, #ffc107, #ffb300)';
      bookmarkBtn.textContent = '★ Bookmarked';
    } else {
      bookmarkBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      bookmarkBtn.textContent = 'Bookmark';
    }
  }

  showProgress() {
    const viewedCount = this.studyProgress.viewedSlides ? this.studyProgress.viewedSlides.length : 0;
    const progressPercent = Math.round((viewedCount / this.totalSlides) * 100);
    
    let bookmarksList = '';
    if (this.bookmarks.length > 0) {
      bookmarksList = this.bookmarks
        .sort((a, b) => a - b)
        .map(slide => `<li>Slide ${slide}</li>`)
        .join('');
    } else {
      bookmarksList = '<li>No bookmarks yet</li>';
    }
    
    const progressHTML = `
      <div class="progress-modal">
        <div class="progress-content">
          <h3>📊 Study Progress</h3>
          <div class="progress-stats">
            <div class="stat-item">
              <span class="stat-value">${viewedCount}/${this.totalSlides}</span>
              <span class="stat-label">Slides Viewed</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${progressPercent}%</span>
              <span class="stat-label">Progress</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${this.bookmarks.length}</span>
              <span class="stat-label">Bookmarks</span>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="bookmarks-section">
            <h4>📌 Your Bookmarks</h4>
            <ul class="bookmarks-list">${bookmarksList}</ul>
          </div>
          <div class="modal-actions">
            <button onclick="app.goToRandomBookmark()" class="action-btn" ${this.bookmarks.length === 0 ? 'disabled' : ''}>
              🔀 Random Bookmark
            </button>
            <button onclick="app.closeModal()" class="action-btn primary">Close</button>
          </div>
        </div>
      </div>
    `;
    
    this.showModal(progressHTML);
  }

  showNotes() {
    const currentNotes = this.notes[this.currentSlide] || '';
    
    const notesHTML = `
      <div class="notes-modal">
        <div class="notes-content">
          <h3>📝 Notes for Slide ${this.currentSlide}</h3>
          <textarea 
            id="notesTextarea" 
            placeholder="Add your study notes for this slide..."
            rows="8"
          >${currentNotes}</textarea>
          <div class="modal-actions">
            <button onclick="app.saveNotes()" class="action-btn primary">💾 Save Notes</button>
            <button onclick="app.closeModal()" class="action-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    this.showModal(notesHTML);
    
    // Focus on textarea
    setTimeout(() => {
      document.getElementById('notesTextarea').focus();
    }, 100);
  }

  saveNotes() {
    const notesText = document.getElementById('notesTextarea').value;
    
    if (notesText.trim()) {
      this.notes[this.currentSlide] = notesText.trim();
    } else {
      delete this.notes[this.currentSlide];
    }
    
    localStorage.setItem('regulation100-notes', JSON.stringify(this.notes));
    this.showToast('Notes saved!');
    this.closeModal();
  }

  goToRandomBookmark() {
    if (this.bookmarks.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * this.bookmarks.length);
    const randomSlide = this.bookmarks[randomIndex];
    
    this.closeModal();
    this.goToSlide(randomSlide);
    this.showToast(`Jumped to bookmarked slide ${randomSlide}!`);
  }

  showModal(html) {
    // Remove existing modal
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = html;
    
    // Add click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal();
      }
    });
    
    document.body.appendChild(overlay);
    
    // Add ESC key to close
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
      modal.remove();
    }
  }

  showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Add modal and toast styles
const additionalStyles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
  }

  .progress-content,
  .notes-content {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .progress-content h3,
  .notes-content h3 {
    color: #00677f;
    margin-bottom: 1.5rem;
    text-align: center;
    font-size: 1.5rem;
  }

  .progress-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    text-align: center;
    padding: 1rem;
    background: rgba(0, 103, 127, 0.05);
    border-radius: 12px;
    border: 2px solid rgba(0, 103, 127, 0.1);
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: bold;
    color: #00677f;
    margin-bottom: 0.5rem;
  }

  .stat-label {
    font-size: 0.9rem;
    color: #666;
  }

  .progress-bar {
    background: #e0e0e0;
    border-radius: 10px;
    height: 20px;
    margin-bottom: 1.5rem;
    overflow: hidden;
  }

  .progress-fill {
    background: linear-gradient(45deg, #00677f, #4a90a4);
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s ease;
  }

  .bookmarks-section h4 {
    color: #00677f;
    margin-bottom: 1rem;
  }

  .bookmarks-list {
    list-style: none;
    padding: 0;
    background: rgba(0, 103, 127, 0.05);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    max-height: 150px;
    overflow-y: auto;
  }

  .bookmarks-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(0, 103, 127, 0.1);
  }

  .bookmarks-list li:last-child {
    border-bottom: none;
  }

  #notesTextarea {
    width: 100%;
    border: 2px solid rgba(0, 103, 127, 0.2);
    border-radius: 8px;
    padding: 1rem;
    font-family: inherit;
    font-size: 1rem;
    resize: vertical;
    margin-bottom: 1.5rem;
  }

  #notesTextarea:focus {
    outline: none;
    border-color: #00677f;
    box-shadow: 0 0 0 3px rgba(0, 103, 127, 0.1);
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .action-btn {
    background: #f0f0f0;
    color: #333;
    border: none;
    padding: 0.8rem 1.5rem;
    border-radius: 25px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .action-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: linear-gradient(45deg, #00677f, #4a90a4);
    color: white;
  }

  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(45deg, #4caf50, #66bb6a);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 25px;
    font-weight: 600;
    z-index: 1001;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  }

  .toast.show {
    transform: translateY(0);
    opacity: 1;
  }

  @media (max-width: 768px) {
    .progress-stats {
      grid-template-columns: 1fr;
    }
    
    .modal-actions {
      justify-content: center;
    }
    
    .action-btn {
      flex: 1;
      min-width: 120px;
    }
    
    .toast {
      right: 10px;
      left: 10px;
      text-align: center;
    }
  }
`;

// Inject additional styles
const styleElement = document.createElement('style');
styleElement.textContent = additionalStyles;
document.head.appendChild(styleElement);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new RegulationStudyApp();
});

// Add keyboard shortcuts help
document.addEventListener('keydown', (e) => {
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
    e.preventDefault();
    showKeyboardShortcuts();
  }
});

function showKeyboardShortcuts() {
  const shortcutsHTML = `
    <div class="shortcuts-modal">
      <div class="shortcuts-content">
        <h3>⌨️ Keyboard Shortcuts</h3>
        <div class="shortcuts-grid">
          <div class="shortcut-item">
            <kbd>←</kbd> <span>Previous slide</span>
          </div>
          <div class="shortcut-item">
            <kbd>→</kbd> <span>Next slide</span>
          </div>
          <div class="shortcut-item">
            <kbd>Home</kbd> <span>First slide</span>
          </div>
          <div class="shortcut-item">
            <kbd>End</kbd> <span>Last slide</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>B</kbd> <span>Toggle bookmark</span>
          </div>
          <div class="shortcut-item">
            <kbd>?</kbd> <span>Show shortcuts</span>
          </div>
          <div class="shortcut-item">
            <kbd>Esc</kbd> <span>Close modal</span>
          </div>
        </div>
        <div class="modal-actions">
          <button onclick="app.closeModal()" class="action-btn primary">Got it!</button>
        </div>
      </div>
    </div>
  `;
  
  window.app.showModal(shortcutsHTML);
}

// Add shortcuts styles
const shortcutsStyles = `
  .shortcuts-content {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .shortcuts-content h3 {
    color: #00677f;
    margin-bottom: 1.5rem;
    text-align: center;
    font-size: 1.5rem;
  }

  .shortcuts-grid {
    display: grid;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem;
    background: rgba(0, 103, 127, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(0, 103, 127, 0.1);
  }

  .shortcut-item kbd {
    background: #333;
    color: white;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
    margin-right: 0.5rem;
  }

  .shortcut-item span {
    color: #666;
    font-size: 0.9rem;
  }
`;

const shortcutsStyleElement = document.createElement('style');
shortcutsStyleElement.textContent = shortcutsStyles;
document.head.appendChild(shortcutsStyleElement);