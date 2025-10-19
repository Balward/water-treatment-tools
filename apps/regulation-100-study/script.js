class RegulationStudyApp {
  constructor() {
    this.slides = Array.from(document.querySelectorAll(".slide"));
    this.totalSlides = this.slides.length;
    this.currentSlide = 1;

    this.prevBtn = document.getElementById("prevBtn");
    this.nextBtn = document.getElementById("nextBtn");

    this.updateSlideCounter();
    this.updateNavigationButtons();
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.prevBtn.addEventListener("click", () => this.previousSlide());
    this.nextBtn.addEventListener("click", () => this.nextSlide());

    document.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          this.previousSlide();
          break;
        case "ArrowRight":
          event.preventDefault();
          this.nextSlide();
          break;
        case "Home":
          event.preventDefault();
          this.goToSlide(1);
          break;
        case "End":
          event.preventDefault();
          this.goToSlide(this.totalSlides);
          break;
        default:
          break;
      }
    });

    let startX = 0;
    let endX = 0;

    document.addEventListener("touchstart", (event) => {
      if (event.touches.length === 1) {
        startX = event.touches[0].clientX;
      }
    });

    document.addEventListener("touchend", (event) => {
      if (event.changedTouches.length === 1) {
        endX = event.changedTouches[0].clientX;
        this.handleSwipe(startX, endX);
      }
    });
  }

  handleSwipe(startX, endX) {
    const minSwipeDistance = 50;
    const swipeDistance = Math.abs(startX - endX);

    if (swipeDistance > minSwipeDistance) {
      if (startX > endX) {
        this.nextSlide();
      } else {
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
    if (slideNumber < 1 || slideNumber > this.totalSlides || slideNumber === this.currentSlide) {
      return;
    }

    const currentSlideElement = document.querySelector(".slide.active");
    if (currentSlideElement) {
      currentSlideElement.classList.remove("active");
    }

    const newSlideElement = document.querySelector(`[data-slide="${slideNumber}"]`);
    if (newSlideElement) {
      newSlideElement.classList.add("active");
    }

    this.currentSlide = slideNumber;
    this.updateSlideCounter();
    this.updateNavigationButtons();
  }

  updateSlideCounter() {
    const current = document.getElementById("currentSlide");
    const total = document.getElementById("totalSlides");

    if (current) {
      current.textContent = String(this.currentSlide);
    }

    if (total) {
      total.textContent = String(this.totalSlides);
    }
  }

  updateNavigationButtons() {
    this.prevBtn.disabled = this.currentSlide === 1;
    this.nextBtn.disabled = this.currentSlide === this.totalSlides;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new RegulationStudyApp();
});
