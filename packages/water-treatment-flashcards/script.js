// Flashcard Data
const flashcardData = {
  'grade1': {
    title: 'Water Treatment Grade 1',
    cards: []
  },
  'grade2': {
    title: 'Water Treatment Grade 2',
    cards: []
  },
  'grade3-4': {
    title: 'Water Treatment Grades 3 & 4',
    chapters: {
      'basic-microbiology-chemistry': {
        title: 'Basic Microbiology and Chemistry',
        cards: [
          {
            term: 'Calcium Carbonate',
            definition: 'A white crystalline compound (CaCO₃) that forms the primary component of limescale deposits in water systems. In water treatment, it serves as a pH buffer and can be intentionally added to reduce water corrosiveness, while excessive amounts can cause scaling problems in pipes and equipment.'
          },
          {
            term: 'Ultraviolet (UV) Disinfection',
            definition: 'A physical disinfection process that uses UV light at 254 nanometers wavelength to destroy bacteria, viruses, and other pathogens by damaging their DNA. UV disinfection provides effective pathogen inactivation without adding chemicals to the water, but requires clear water for optimal effectiveness and provides no residual disinfection.'
          },
          {
            term: 'Membrane Filtration',
            definition: 'A pressure-driven separation process that uses semi-permeable membranes to remove contaminants from water based on size exclusion. Types include microfiltration, ultrafiltration, nanofiltration, and reverse osmosis, each removing progressively smaller particles and dissolved constituents.'
          },
          {
            term: 'Hardness',
            definition: 'The measure of dissolved calcium and magnesium ions in water, typically expressed as milligrams per liter of calcium carbonate equivalent. Hard water causes soap scum, scale formation in pipes and water heaters, and can affect the taste of water, while very soft water may be corrosive to plumbing systems.'
          },
          {
            term: 'Carbonate Hardness',
            definition: 'The portion of total hardness caused by calcium and magnesium ions associated with carbonate and bicarbonate ions, also known as temporary hardness. This type of hardness can be removed by boiling or lime softening processes, as heating converts bicarbonates to less soluble carbonates that precipitate out.'
          },
          {
            term: 'Noncarbonate Hardness',
            definition: 'The portion of total hardness caused by calcium and magnesium ions associated with sulfate, chloride, or nitrate ions, also known as permanent hardness. This hardness cannot be removed by boiling and requires chemical treatment methods such as ion exchange or lime-soda ash softening for removal.'
          },
          {
            term: 'Recarbonation',
            definition: 'The process of adding carbon dioxide gas to water after lime softening treatment to lower pH and stabilize the water. This process converts excess lime to calcium carbonate and bicarbonate, preventing post-treatment precipitation and reducing the corrosiveness of the treated water to distribution system materials.'
          },
          {
            term: 'Ion Exchange Process',
            definition: 'A water treatment method that removes unwanted ions from water by exchanging them with more desirable ions attached to a resin material. Commonly used for water softening by exchanging calcium and magnesium ions with sodium ions, or for removing specific contaminants like nitrates or heavy metals.'
          },
          {
            term: 'Regeneration',
            definition: 'The process of restoring an ion exchange resin to its original ionic form after it becomes saturated with removed ions. Typically involves backwashing the resin bed and then passing a concentrated solution of the desired replacement ions through the resin to recharge it for continued use.'
          },
          {
            term: 'Langelier Saturation Index',
            definition: 'A calculated value that predicts the tendency of water to precipitate or dissolve calcium carbonate, indicating whether water is corrosive or scale-forming. A negative LSI indicates corrosive water that will dissolve pipes and fixtures, while a positive LSI indicates water that will form protective scale deposits.'
          },
          {
            term: 'Saturation',
            definition: 'The condition where water contains the maximum amount of a dissolved substance it can hold at a given temperature and pressure. In water treatment, saturation is important for understanding when precipitation or crystallization will occur, particularly with minerals like calcium carbonate that affect water stability.'
          },
          {
            term: 'Chelation',
            definition: 'A chemical process where organic compounds called chelating agents bind to metal ions, forming stable ring-like molecular structures that keep metals in solution. In water treatment, chelation is used to prevent metal precipitation, control scale formation, and sequester iron and manganese to prevent staining and taste problems.'
          },
          {
            term: 'Sequestration',
            definition: 'The process of chemically binding metal ions in solution to prevent them from participating in unwanted reactions such as oxidation or precipitation. Sequestering agents keep metals like iron, manganese, and calcium in solution, preventing staining, scaling, and catalytic effects that could degrade water quality or treatment chemicals.'
          }
        ]
      },
      'advanced-math-operators': {
        title: 'Advanced Math for Operators',
        cards: [
          {
            term: 'Head',
            definition: 'A measure of the energy per unit weight of water, expressed as the height of a column of water that the energy could lift. In water treatment systems, head represents the pressure energy available to move water through pipes, pumps, and treatment processes, typically measured in feet of water column.'
          },
          {
            term: 'Pounds per Square Inch Gauge (PSIG)',
            definition: 'A unit of pressure measurement that indicates pressure above atmospheric pressure, commonly used in water treatment systems to measure pump discharge pressures and system operating pressures. PSIG readings are relative to atmospheric pressure, with 0 PSIG being equal to atmospheric pressure (14.7 psia at sea level).'
          },
          {
            term: 'Pressure Head',
            definition: 'The height of a column of water that would produce the same pressure as measured at a given point in the system, calculated by dividing pressure by the specific weight of water. In water treatment, pressure head helps determine the energy available to push water through filters, pipes, and other system components.'
          },
          {
            term: 'Hydraulic Grade Line (HGL)',
            definition: 'A graphical representation showing the total energy available at any point in a water system, plotted as the sum of elevation head and pressure head. The HGL slopes downward in the direction of flow due to friction losses and helps operators understand energy distribution throughout the treatment and distribution system.'
          },
          {
            term: 'Elevation Head',
            definition: 'The potential energy component of total head, representing the height of water above a reference datum or elevation. In water treatment facilities, elevation head determines the energy needed to lift water to storage tanks or the energy available from elevated sources like reservoirs.'
          },
          {
            term: 'Velocity Head',
            definition: 'The kinetic energy component of total head, representing the energy due to water motion, calculated as the velocity squared divided by twice the acceleration due to gravity. Velocity head is typically small in water treatment systems but becomes significant in high-velocity applications like pump discharge lines.'
          },
          {
            term: 'Energy Grade Line (EGL)',
            definition: 'A graphical representation of the total energy in a water system at any point, plotted as the sum of elevation head, pressure head, and velocity head. The EGL always lies above the HGL by the amount of velocity head and continuously slopes downward due to energy losses from friction and turbulence.'
          },
          {
            term: 'Friction Head Loss',
            definition: 'The energy loss that occurs as water flows through pipes, valves, and fittings due to friction between the water and the pipe walls or internal turbulence. Friction head loss increases with flow rate, pipe length, and roughness, and must be overcome by pumps to maintain adequate flow and pressure in water treatment systems.'
          },
          {
            term: 'Instantaneous Flow Rate',
            definition: 'The volume of water flowing past a specific point at any given moment, typically measured in gallons per minute (GPM) or cubic feet per second (CFS). In water treatment, instantaneous flow rates are crucial for sizing equipment, calculating detention times, and ensuring proper chemical dosing rates.'
          },
          {
            term: 'Pump Centerline',
            definition: 'The horizontal reference line passing through the center of a pump impeller, used as a datum for calculating suction and discharge head measurements. The pump centerline elevation is critical for determining net positive suction head (NPSH) and proper pump installation in water treatment facilities.'
          },
          {
            term: 'Static Suction Head',
            definition: 'The vertical distance from the pump centerline down to the free surface of the water being pumped when the source is above the pump. Static suction head represents positive pressure at the pump suction and aids in preventing cavitation in water treatment pumping applications.'
          },
          {
            term: 'Static Suction Lift',
            definition: 'The vertical distance from the free surface of the water source up to the pump centerline when the source is below the pump. Static suction lift creates negative pressure at the pump suction and must be minimized to prevent cavitation and maintain reliable pump operation.'
          },
          {
            term: 'Static Discharge Head',
            definition: 'The vertical distance from the pump centerline to the free surface of the water at the discharge point, representing the elevation that the pump must overcome. Static discharge head is a major component of total system head and directly affects pump power requirements and selection.'
          },
          {
            term: 'Total Static Head',
            definition: 'The total vertical distance that a pump must overcome, calculated as the sum of static suction lift (or minus static suction head) and static discharge head. Total static head represents the minimum energy required to move water from source to destination, regardless of flow rate.'
          },
          {
            term: 'Minor Head Losses',
            definition: 'Energy losses that occur at fittings, valves, bends, expansions, and contractions in piping systems, caused by flow turbulence and direction changes. While called "minor," these losses can be significant in water treatment systems with numerous valves and fittings, and must be included in pump sizing calculations.'
          },
          {
            term: 'Dynamic Suction Head',
            definition: 'The static suction head minus the friction losses in the suction piping when water is flowing, representing the actual pressure available at the pump suction during operation. Dynamic suction head decreases as flow rate increases due to higher friction losses in the suction line.'
          },
          {
            term: 'Dynamic Suction Lift',
            definition: 'The static suction lift plus the friction losses in the suction piping when water is flowing, representing the total energy deficit that must be overcome at the pump suction. Dynamic suction lift increases with flow rate and must be carefully managed to prevent pump cavitation.'
          },
          {
            term: 'Total Dynamic Head',
            definition: 'The total energy that a pump must provide to move water through a system at a specific flow rate, including static head plus all friction losses and minor losses. Total dynamic head varies with flow rate and is the key parameter used for pump selection and performance evaluation in water treatment systems.'
          },
          {
            term: 'Horsepower',
            definition: 'A unit of power measurement equal to 550 foot-pounds per second or 746 watts, used to quantify the rate of energy transfer in pumping systems. In water treatment, horsepower calculations help determine pump efficiency, operating costs, and motor sizing requirements for various applications.'
          },
          {
            term: 'Efficiency',
            definition: 'The ratio of useful power output to total power input, expressed as a percentage, indicating how effectively energy is converted from one form to another. In water treatment pumping systems, efficiency affects operating costs and is the product of pump efficiency, motor efficiency, and drive efficiency.'
          },
          {
            term: 'Work',
            definition: 'The energy required to move an object through a distance against a force, measured in foot-pounds in the English system. In water treatment, work represents the energy needed to lift water against gravity or push it through resistance, forming the basis for power and efficiency calculations.'
          },
          {
            term: 'Power',
            definition: 'The rate at which work is performed or energy is transferred, typically measured in horsepower or watts in water treatment applications. Power requirements determine motor sizing, electrical costs, and system operating efficiency for pumps, blowers, and other mechanical equipment.'
          },
          {
            term: 'Water Horsepower',
            definition: 'The theoretical minimum power required to move water through a system, calculated from flow rate and total dynamic head without considering inefficiencies. Water horsepower represents the ideal power requirement and serves as the basis for calculating pump efficiency and actual power needs.'
          },
          {
            term: 'Brake Horsepower',
            definition: 'The actual mechanical power delivered by a motor to a pump shaft, representing the power input to the pump after accounting for motor inefficiencies. Brake horsepower is higher than water horsepower due to pump inefficiencies and is used to size motors and calculate operating costs.'
          },
          {
            term: 'Motor Horsepower',
            definition: 'The electrical power input to a motor, which must exceed brake horsepower due to motor inefficiencies that convert some electrical energy to heat. Motor horsepower determines electrical demand, circuit sizing, and energy costs for water treatment facility operations.'
          },
          {
            term: 'Wire-to-Water Efficiency',
            definition: 'The overall system efficiency from electrical input to useful water pumping output, calculated as water horsepower divided by motor horsepower and expressed as a percentage. Wire-to-water efficiency accounts for all system losses and is the key metric for evaluating pumping system performance and energy costs.'
          },
          {
            term: 'Pump Characteristic Curves',
            definition: 'Graphical representations showing the relationship between flow rate and head, efficiency, and power for a specific pump at a given speed. These curves are essential tools for pump selection, system design, and troubleshooting in water treatment facilities, helping operators understand pump performance under various conditions.'
          },
          {
            term: 'Design Point',
            definition: 'The specific combination of flow rate and head at which a pump operates most efficiently and reliably, representing the optimal match between pump characteristics and system requirements. Operating at or near the design point maximizes efficiency, minimizes energy costs, and extends equipment life in water treatment applications.'
          },
          {
            term: 'Total Hardness',
            definition: 'The sum of all calcium and magnesium ions in water, typically expressed as milligrams per liter of calcium carbonate equivalent, representing the complete measure of water hardness. Total hardness affects soap effectiveness, scale formation, corrosion potential, and taste, making it a critical parameter for water treatment process design and monitoring.'
          },
          {
            term: 'Total Alkalinity',
            definition: 'The measure of water\'s capacity to neutralize acids, primarily due to bicarbonate, carbonate, and hydroxide ions, expressed as milligrams per liter of calcium carbonate equivalent. Total alkalinity affects pH stability, corrosion control, coagulation effectiveness, and disinfection efficiency in water treatment processes.'
          }
        ]
      }
    }
  }
};

// Flashcard Application Class
class FlashcardApp {
  constructor() {
    this.currentBook = null;
    this.currentChapter = null;
    this.currentCards = [];
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.studyMode = 'sequential'; // or 'random'
    this.cardDifficulties = {};
    this.favorites = new Set();
    this.studyStats = {
      cardsStudied: 0,
      correctAnswers: 0,
      startTime: null
    };
    
    this.loadData();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.showBookSelection();
  }

  loadData() {
    // Load saved progress from localStorage
    const savedFavorites = localStorage.getItem('flashcard-favorites');
    if (savedFavorites) {
      this.favorites = new Set(JSON.parse(savedFavorites));
    }

    const savedDifficulties = localStorage.getItem('flashcard-difficulties');
    if (savedDifficulties) {
      this.cardDifficulties = JSON.parse(savedDifficulties);
    }
  }

  saveData() {
    localStorage.setItem('flashcard-favorites', JSON.stringify([...this.favorites]));
    localStorage.setItem('flashcard-difficulties', JSON.stringify(this.cardDifficulties));
  }

  setupEventListeners() {
    // Book selection
    document.querySelectorAll('.book-card.available').forEach(card => {
      card.addEventListener('click', () => {
        const bookId = card.dataset.book;
        this.selectBook(bookId);
      });
    });

    // Chapter selection
    document.querySelectorAll('.chapter-card').forEach(card => {
      card.addEventListener('click', () => {
        const chapterId = card.dataset.chapter;
        this.selectChapter(chapterId);
      });
    });

    // Navigation
    document.getElementById('backToBooksHeader').addEventListener('click', () => {
      this.showBookSelection();
    });

    document.getElementById('backToChaptersHeader').addEventListener('click', () => {
      this.showChapterSelection();
    });

    document.getElementById('backToBooks').addEventListener('click', () => {
      this.showBookSelection();
    });

    // Flashcard interactions
    document.getElementById('flashcard').addEventListener('click', () => {
      this.flipCard();
    });

    // Card navigation
    document.getElementById('prevCard').addEventListener('click', () => {
      this.previousCard();
    });

    document.getElementById('nextCard').addEventListener('click', () => {
      this.nextCard();
    });

    // Difficulty buttons
    document.getElementById('easyBtn').addEventListener('click', () => {
      this.rateDifficulty('easy');
    });

    document.getElementById('mediumBtn').addEventListener('click', () => {
      this.rateDifficulty('medium');
    });

    document.getElementById('hardBtn').addEventListener('click', () => {
      this.rateDifficulty('hard');
    });

    // Control buttons
    document.getElementById('shuffleBtn').addEventListener('click', () => {
      this.shuffleCards();
    });

    document.getElementById('progressBtn').addEventListener('click', () => {
      this.showProgress();
    });

    document.getElementById('favoriteBtn').addEventListener('click', () => {
      this.toggleFavorite();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetProgress();
    });

    document.getElementById('studyOptions').addEventListener('click', () => {
      this.showStudyOptions();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (this.currentBook) {
        switch(e.key) {
          case ' ':
          case 'Enter':
            e.preventDefault();
            this.flipCard();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.previousCard();
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.nextCard();
            break;
          case '1':
            this.rateDifficulty('easy');
            break;
          case '2':
            this.rateDifficulty('medium');
            break;
          case '3':
            this.rateDifficulty('hard');
            break;
          case 'f':
            this.toggleFavorite();
            break;
          case 's':
            this.shuffleCards();
            break;
        }
      }
    });
  }

  showBookSelection() {
    document.getElementById('bookSelection').classList.remove('hidden');
    document.getElementById('chapterSelection').classList.add('hidden');
    document.getElementById('studyInterface').classList.add('hidden');
    document.getElementById('studyInfo').classList.add('hidden');
    document.getElementById('headerTagline').classList.remove('hidden');
    this.currentBook = null;
    this.currentChapter = null;
  }

  showChapterSelection() {
    if (!this.currentBook || !flashcardData[this.currentBook].chapters) {
      this.showBookSelection();
      return;
    }

    document.getElementById('bookSelection').classList.add('hidden');
    document.getElementById('chapterSelection').classList.remove('hidden');
    document.getElementById('studyInterface').classList.add('hidden');
    document.getElementById('studyInfo').classList.add('hidden');
    document.getElementById('headerTagline').classList.add('hidden');
    this.currentChapter = null;
  }

  selectBook(bookId) {
    if (!flashcardData[bookId]) {
      this.showToast('This book is not available yet. Coming soon!');
      return;
    }

    // Check if book has chapters or cards
    if (flashcardData[bookId].chapters) {
      // Show chapter selection
      this.currentBook = bookId;
      document.getElementById('bookSelection').classList.add('hidden');
      document.getElementById('chapterSelection').classList.remove('hidden');
      document.getElementById('headerTagline').classList.add('hidden');
      return;
    } else if (flashcardData[bookId].cards && flashcardData[bookId].cards.length === 0) {
      this.showToast('This book is not available yet. Coming soon!');
      return;
    }

    // Legacy books with direct cards array
    this.currentBook = bookId;
    this.currentCards = [...flashcardData[bookId].cards];
    this.startStudy();
  }

  selectChapter(chapterId) {
    if (!this.currentBook || !flashcardData[this.currentBook].chapters) {
      return;
    }

    this.currentChapter = chapterId;
    
    if (chapterId === 'all') {
      // Combine all chapters
      this.currentCards = [];
      Object.values(flashcardData[this.currentBook].chapters).forEach(chapter => {
        this.currentCards = this.currentCards.concat(chapter.cards);
      });
    } else {
      // Select specific chapter
      this.currentCards = [...flashcardData[this.currentBook].chapters[chapterId].cards];
    }

    this.startStudy();
  }

  startStudy() {
    this.currentCardIndex = 0;
    this.studyStats.startTime = Date.now();
    this.studyStats.cardsStudied = 0;
    this.studyStats.correctAnswers = 0;

    document.getElementById('bookSelection').classList.add('hidden');
    document.getElementById('chapterSelection').classList.add('hidden');
    document.getElementById('studyInterface').classList.remove('hidden');
    document.getElementById('studyInfo').classList.remove('hidden');
    document.getElementById('headerTagline').classList.add('hidden');
    
    let headerText = flashcardData[this.currentBook].title;
    if (this.currentChapter && this.currentChapter !== 'all') {
      headerText += ' - ' + flashcardData[this.currentBook].chapters[this.currentChapter].title;
    } else if (this.currentChapter === 'all') {
      headerText += ' - All Chapters';
    }
    
    document.getElementById('currentBookHeader').textContent = headerText;
    document.getElementById('totalCards').textContent = this.currentCards.length;

    // Show/hide chapter button based on book structure
    const chapterBtn = document.getElementById('backToChaptersHeader');
    if (flashcardData[this.currentBook].chapters) {
      chapterBtn.classList.remove('hidden');
    } else {
      chapterBtn.classList.add('hidden');
    }

    this.displayCurrentCard();
    this.updateNavigationButtons();
    this.updateFavoriteButton();
  }

  displayCurrentCard() {
    if (this.currentCards.length === 0) return;

    const card = this.currentCards[this.currentCardIndex];
    document.getElementById('cardTerm').textContent = card.term;
    document.getElementById('cardDefinition').textContent = card.definition;
    document.getElementById('currentCard').textContent = this.currentCardIndex + 1;

    // Reset flip state
    this.isFlipped = false;
    document.getElementById('flashcard').classList.remove('flipped');

    this.updateFavoriteButton();
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    const flashcard = document.getElementById('flashcard');
    
    if (this.isFlipped) {
      flashcard.classList.add('flipped');
    } else {
      flashcard.classList.remove('flipped');
    }
  }

  nextCard() {
    if (this.currentCardIndex < this.currentCards.length - 1) {
      this.currentCardIndex++;
    } else {
      this.currentCardIndex = 0; // Loop back to first card
    }
    this.displayCurrentCard();
    this.updateNavigationButtons();
  }

  previousCard() {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
    } else {
      this.currentCardIndex = this.currentCards.length - 1; // Loop to last card
    }
    this.displayCurrentCard();
    this.updateNavigationButtons();
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevCard');
    const nextBtn = document.getElementById('nextCard');
    
    // For now, always enable both buttons to allow looping
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }

  shuffleCards() {
    // Fisher-Yates shuffle algorithm
    for (let i = this.currentCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.currentCards[i], this.currentCards[j]] = [this.currentCards[j], this.currentCards[i]];
    }
    
    this.currentCardIndex = 0;
    this.displayCurrentCard();
    this.updateNavigationButtons();
    this.showToast('Cards shuffled!');
  }

  rateDifficulty(difficulty) {
    if (this.currentCards.length === 0) return;

    const currentCard = this.currentCards[this.currentCardIndex];
    const cardKey = `${this.currentBook}-${this.currentChapter || 'all'}-${currentCard.term}`;
    
    this.cardDifficulties[cardKey] = difficulty;
    this.studyStats.cardsStudied++;
    
    if (difficulty === 'easy') {
      this.studyStats.correctAnswers++;
    }

    this.saveData();
    
    // Visual feedback
    const buttons = document.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => btn.style.transform = 'scale(1)');
    
    const clickedBtn = document.getElementById(difficulty + 'Btn');
    clickedBtn.style.transform = 'scale(1.1)';
    
    setTimeout(() => {
      clickedBtn.style.transform = 'scale(1)';
      this.nextCard();
    }, 500);

    this.showToast(`Marked as ${difficulty}!`);
  }

  toggleFavorite() {
    if (this.currentCards.length === 0) return;

    const currentCard = this.currentCards[this.currentCardIndex];
    const cardKey = `${this.currentBook}-${this.currentChapter || 'all'}-${currentCard.term}`;
    
    if (this.favorites.has(cardKey)) {
      this.favorites.delete(cardKey);
      this.showToast('Removed from favorites');
    } else {
      this.favorites.add(cardKey);
      this.showToast('Added to favorites');
    }

    this.saveData();
    this.updateFavoriteButton();
  }

  updateFavoriteButton() {
    if (this.currentCards.length === 0) return;

    const currentCard = this.currentCards[this.currentCardIndex];
    const cardKey = `${this.currentBook}-${this.currentChapter || 'all'}-${currentCard.term}`;
    const favoriteBtn = document.getElementById('favoriteBtn');
    
    if (this.favorites.has(cardKey)) {
      favoriteBtn.style.background = 'linear-gradient(45deg, #ffc107, #ffb300)';
      favoriteBtn.textContent = '⭐ Favorited';
    } else {
      favoriteBtn.style.background = 'rgba(255, 255, 255, 0.9)';
      favoriteBtn.style.color = '#00677f';
      favoriteBtn.textContent = '⭐ Favorite';
    }
  }

  showProgress() {
    const totalCards = this.currentCards.length;
    const studiedCount = this.studyStats.cardsStudied;
    const accuracy = studiedCount > 0 ? Math.round((this.studyStats.correctAnswers / studiedCount) * 100) : 0;
    const studyTime = this.studyStats.startTime ? Math.round((Date.now() - this.studyStats.startTime) / 60000) : 0;

    const progressHTML = `
      <div class="modal-content">
        <h3>📊 Study Progress</h3>
        <div class="progress-stats">
          <div class="stat-item">
            <span class="stat-value">${studiedCount}/${totalCards}</span>
            <span class="stat-label">Cards Studied</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${accuracy}%</span>
            <span class="stat-label">Accuracy</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${studyTime}</span>
            <span class="stat-label">Minutes</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${this.favorites.size}</span>
            <span class="stat-label">Favorites</span>
          </div>
        </div>
        <div class="modal-actions">
          <button onclick="app.showFavoritesOnly()" class="modal-btn" ${this.favorites.size === 0 ? 'disabled' : ''}>
            Study Favorites Only
          </button>
          <button onclick="app.closeModal()" class="modal-btn primary">Close</button>
        </div>
      </div>
    `;

    this.showModal(progressHTML);
  }

  showStudyOptions() {
    const optionsHTML = `
      <div class="modal-content">
        <h3>⚙️ Study Options</h3>
        <div class="option-group">
          <h4>Study Mode</h4>
          <button onclick="app.setStudyMode('sequential')" class="modal-btn ${this.studyMode === 'sequential' ? 'primary' : ''}">
            Sequential Order
          </button>
          <button onclick="app.setStudyMode('random')" class="modal-btn ${this.studyMode === 'random' ? 'primary' : ''}">
            Random Order
          </button>
        </div>
        <div class="option-group">
          <h4>Keyboard Shortcuts</h4>
          <div class="shortcuts-info">
            <p><strong>Space/Enter:</strong> Flip card</p>
            <p><strong>←/→:</strong> Navigate cards</p>
            <p><strong>1/2/3:</strong> Rate difficulty</p>
            <p><strong>F:</strong> Toggle favorite</p>
            <p><strong>S:</strong> Shuffle cards</p>
          </div>
        </div>
        <div class="modal-actions">
          <button onclick="app.closeModal()" class="modal-btn primary">Close</button>
        </div>
      </div>
    `;

    this.showModal(optionsHTML);
  }

  setStudyMode(mode) {
    this.studyMode = mode;
    if (mode === 'random') {
      this.shuffleCards();
    }
    this.closeModal();
    this.showToast(`Study mode: ${mode}`);
  }

  showFavoritesOnly() {
    const favoriteCards = this.currentCards.filter(card => {
      const cardKey = `${this.currentBook}-${this.currentChapter || 'all'}-${card.term}`;
      return this.favorites.has(cardKey);
    });

    if (favoriteCards.length === 0) {
      this.showToast('No favorite cards yet!');
      return;
    }

    this.currentCards = favoriteCards;
    this.currentCardIndex = 0;
    this.displayCurrentCard();
    this.updateNavigationButtons();
    
    document.getElementById('totalCards').textContent = this.currentCards.length;
    this.closeModal();
    this.showToast(`Studying ${favoriteCards.length} favorite cards`);
  }

  resetProgress() {
    if (confirm('Are you sure you want to reset your progress for this book?')) {
      // Reset current session stats
      this.studyStats = {
        cardsStudied: 0,
        correctAnswers: 0,
        startTime: Date.now()
      };

      // Clear difficulties for current book/chapter
      const prefix = `${this.currentBook}-${this.currentChapter || 'all'}-`;
      Object.keys(this.cardDifficulties).forEach(key => {
        if (key.startsWith(prefix)) {
          delete this.cardDifficulties[key];
        }
      });

      // Clear favorites for current book/chapter
      const currentFavorites = [...this.favorites].filter(key => 
        key.startsWith(prefix)
      );
      currentFavorites.forEach(key => this.favorites.delete(key));

      // Reset cards to original order
      if (this.currentChapter === 'all') {
        this.currentCards = [];
        Object.values(flashcardData[this.currentBook].chapters).forEach(chapter => {
          this.currentCards = this.currentCards.concat(chapter.cards);
        });
      } else if (this.currentChapter) {
        this.currentCards = [...flashcardData[this.currentBook].chapters[this.currentChapter].cards];
      } else {
        this.currentCards = [...flashcardData[this.currentBook].cards];
      }
      this.currentCardIndex = 0;
      
      this.saveData();
      this.displayCurrentCard();
      this.updateNavigationButtons();
      this.updateFavoriteButton();
      
      document.getElementById('totalCards').textContent = this.currentCards.length;
      
      this.showToast('Progress reset successfully!');
    }
  }

  showModal(html) {
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = html;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal();
      }
    });

    document.body.appendChild(overlay);

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
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Add additional modal styles for options
const additionalStyles = `
  .option-group {
    margin-bottom: 2rem;
  }

  .option-group h4 {
    color: #00677f;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .option-group .modal-btn {
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .shortcuts-info {
    background: rgba(0, 103, 127, 0.05);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(0, 103, 127, 0.1);
  }

  .shortcuts-info p {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .shortcuts-info strong {
    color: #00677f;
  }

  @media (max-width: 768px) {
    .modal-actions {
      justify-content: center;
    }
    
    .modal-btn {
      flex: 1;
      min-width: 120px;
    }
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = additionalStyles;
document.head.appendChild(styleElement);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FlashcardApp();
});