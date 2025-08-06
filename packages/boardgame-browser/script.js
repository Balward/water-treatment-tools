// Board Game Collection Browser
let allGames = [];
let filteredGames = [];
let activeFilters = {
    search: '',
    players: null,
    complexity: null,
    rating: null
};
let currentSort = 'name';

console.log('Board Game Collection Browser loaded');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    // Handle Enter key on username input
    document.getElementById('bggUsername').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadCollection();
        }
    });
});

function setupEventListeners() {
    // Search input
    document.getElementById('searchInput').addEventListener('input', function(e) {
        activeFilters.search = e.target.value.toLowerCase();
        applyFiltersAndSort();
    });
    
    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const filterType = this.getAttribute('data-filter');
            const filterValue = this.getAttribute('data-value');
            
            // Toggle active state
            if (this.classList.contains('bg-blue-500')) {
                // Remove filter
                this.classList.remove('bg-blue-500', 'text-white');
                this.classList.add('bg-gray-100', 'text-gray-700');
                activeFilters[filterType] = null;
            } else {
                // Clear other filters of same type
                document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(otherChip => {
                    otherChip.classList.remove('bg-blue-500', 'text-white');
                    otherChip.classList.add('bg-gray-100', 'text-gray-700');
                });
                
                // Add filter
                this.classList.remove('bg-gray-100', 'text-gray-700');
                this.classList.add('bg-blue-500', 'text-white');
                activeFilters[filterType] = filterValue;
            }
            
            applyFiltersAndSort();
        });
    });
    
    // Sort select
    document.getElementById('sortSelect').addEventListener('change', function(e) {
        currentSort = e.target.value;
        applyFiltersAndSort();
    });
    
    // Clear filters button
    document.getElementById('clearFilters').addEventListener('click', function() {
        clearAllFilters();
    });
}

async function loadCollection() {
    const username = document.getElementById('bggUsername').value.trim();
    
    if (!username) {
        showError('Please enter a BoardGameGeek username');
        return;
    }
    
    try {
        showLoading();
        updateLoadingProgress('Connecting to BoardGameGeek...');
        
        // Use the JSON wrapper API for easier parsing
        const response = await fetch(`https://bgg-json.azurewebsites.net/collection/${username}?grouped=false`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch collection: ${response.status}`);
        }
        
        updateLoadingProgress('Processing collection data...');
        const data = await response.json();
        
        if (!data || data.length === 0) {
            throw new Error('No games found in collection. Make sure your collection is public.');
        }
        
        updateLoadingProgress('Fetching detailed game information...');
        allGames = await processGameData(data);
        
        hideLoading();
        showCollection();
        displayStats();
        applyFiltersAndSort();
        
    } catch (error) {
        console.error('Error loading collection:', error);
        hideLoading();
        showError(error.message || 'Failed to load collection. Please try again.');
    }
}

async function processGameData(rawData) {
    const games = [];
    
    for (let i = 0; i < rawData.length; i++) {
        const game = rawData[i];
        
        // Update progress
        if (i % 10 === 0) {
            updateLoadingProgress(`Processing game ${i + 1} of ${rawData.length}...`);
            await new Promise(resolve => setTimeout(resolve, 10)); // Allow UI update
        }
        
        // Extract game data
        const processedGame = {
            id: game.gameId,
            name: game.name || 'Unknown Game',
            image: game.image || 'https://via.placeholder.com/300x300?text=No+Image',
            thumbnail: game.thumbnail || 'https://via.placeholder.com/150x150?text=No+Image',
            yearPublished: game.yearPublished || 0,
            minPlayers: game.minPlayers || 1,
            maxPlayers: game.maxPlayers || 1,
            playingTime: game.playingTime || 0,
            minAge: game.minAge || 0,
            
            // BGG ratings and stats
            bggRating: parseFloat(game.bggRating) || 0,
            averageRating: parseFloat(game.averageRating) || 0,
            bggRank: parseInt(game.bggRank) || 999999,
            complexity: parseFloat(game.averageWeight) || 0,
            
            // User specific data
            userRating: parseFloat(game.rating) || 0,
            owned: game.owned === 'true' || game.owned === true,
            numPlays: parseInt(game.numPlays) || 0,
            
            // Categories and mechanics (if available)
            categories: game.categories || [],
            mechanics: game.mechanics || [],
            
            // Additional info
            description: game.description || '',
            designers: game.designers || [],
            publishers: game.publishers || []
        };
        
        games.push(processedGame);
    }
    
    return games;
}

function showLoading() {
    document.getElementById('usernameSection').classList.add('hidden');
    document.getElementById('loadingSection').classList.remove('hidden');
    document.getElementById('errorSection').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingSection').classList.add('hidden');
}

function showCollection() {
    document.getElementById('collectionStats').classList.remove('hidden');
    document.getElementById('filtersSection').classList.remove('hidden');
    document.getElementById('gamesGrid').classList.remove('hidden');
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorSection').classList.remove('hidden');
    document.getElementById('usernameSection').classList.add('hidden');
    document.getElementById('loadingSection').classList.add('hidden');
}

function updateLoadingProgress(message) {
    document.getElementById('loadingProgress').textContent = message;
}

function displayStats() {
    const totalGames = allGames.length;
    const avgRating = totalGames > 0 ? 
        (allGames.reduce((sum, game) => sum + (game.userRating || game.bggRating), 0) / totalGames).toFixed(1) : 
        '0.0';
    const totalPlays = allGames.reduce((sum, game) => sum + game.numPlays, 0);
    const wishlistCount = allGames.filter(game => !game.owned).length;
    
    document.getElementById('totalGames').textContent = totalGames;
    document.getElementById('avgRating').textContent = avgRating;
    document.getElementById('totalPlays').textContent = totalPlays;
    document.getElementById('wishlistCount').textContent = wishlistCount;
}

function applyFiltersAndSort() {
    // Start with all games
    filteredGames = [...allGames];
    
    // Apply search filter
    if (activeFilters.search) {
        filteredGames = filteredGames.filter(game => 
            game.name.toLowerCase().includes(activeFilters.search)
        );
    }
    
    // Apply player count filter
    if (activeFilters.players) {
        filteredGames = filteredGames.filter(game => {
            switch (activeFilters.players) {
                case '1':
                    return game.minPlayers <= 1;
                case '2':
                    return game.minPlayers <= 2 && game.maxPlayers >= 2;
                case '3-4':
                    return game.minPlayers <= 4 && game.maxPlayers >= 3;
                case '5+':
                    return game.maxPlayers >= 5;
                default:
                    return true;
            }
        });
    }
    
    // Apply complexity filter
    if (activeFilters.complexity) {
        filteredGames = filteredGames.filter(game => {
            switch (activeFilters.complexity) {
                case 'light':
                    return game.complexity <= 2.0;
                case 'medium':
                    return game.complexity > 2.0 && game.complexity <= 3.5;
                case 'heavy':
                    return game.complexity > 3.5;
                default:
                    return true;
            }
        });
    }
    
    // Apply rating filter
    if (activeFilters.rating) {
        const minRating = parseFloat(activeFilters.rating);
        filteredGames = filteredGames.filter(game => 
            (game.userRating || game.bggRating) >= minRating
        );
    }
    
    // Apply sorting
    filteredGames.sort((a, b) => {
        switch (currentSort) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'rating':
                return (b.userRating || b.bggRating) - (a.userRating || a.bggRating);
            case 'year':
                return b.yearPublished - a.yearPublished;
            case 'plays':
                return b.numPlays - a.numPlays;
            case 'complexity':
                return b.complexity - a.complexity;
            default:
                return 0;
        }
    });
    
    renderGames();
}

function renderGames() {
    const gamesList = document.getElementById('gamesList');
    const gameCount = document.getElementById('gameCount');
    
    gameCount.textContent = `${filteredGames.length} games`;
    
    if (filteredGames.length === 0) {
        gamesList.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="text-6xl mb-4">🎲</div>
                <h3 class="text-2xl font-bold text-gray-800 mb-2">No games found</h3>
                <p class="text-gray-600">Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }
    
    gamesList.innerHTML = filteredGames.map(game => createGameCard(game)).join('');
}

function createGameCard(game) {
    const complexityColor = game.complexity <= 2.0 ? 'text-green-600' : 
                           game.complexity <= 3.5 ? 'text-yellow-600' : 'text-red-600';
    
    const complexityText = game.complexity <= 2.0 ? 'Light' : 
                          game.complexity <= 3.5 ? 'Medium' : 'Heavy';
    
    const rating = game.userRating || game.bggRating;
    const ratingColor = rating >= 8 ? 'text-green-600' : 
                       rating >= 7 ? 'text-blue-600' : 
                       rating >= 6 ? 'text-yellow-600' : 'text-gray-600';
    
    return `
        <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200 hover:border-blue-300">
            <div class="relative">
                <img src="${game.thumbnail}" alt="${game.name}" 
                     class="w-full h-48 object-cover"
                     onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'" />
                <div class="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-lg text-sm font-medium">
                    ${game.yearPublished || 'N/A'}
                </div>
                ${game.numPlays > 0 ? `
                    <div class="absolute top-3 left-3 bg-blue-600 text-white px-2 py-1 rounded-lg text-sm font-medium">
                        ${game.numPlays} plays
                    </div>
                ` : ''}
            </div>
            
            <div class="p-6">
                <h3 class="font-bold text-lg text-gray-800 mb-3 line-clamp-2 leading-tight">${game.name}</h3>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold ${ratingColor} mb-1">${rating.toFixed(1)}</div>
                        <div class="text-xs text-gray-600 uppercase tracking-wide">Rating</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold ${complexityColor} mb-1">${game.complexity.toFixed(1)}</div>
                        <div class="text-xs text-gray-600 uppercase tracking-wide">${complexityText}</div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        ${game.minPlayers === game.maxPlayers ? game.minPlayers : `${game.minPlayers}-${game.maxPlayers}`} players
                    </div>
                    <div class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        ${game.playingTime || 'N/A'} min
                    </div>
                </div>
                
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        ${game.owned ? 
                            '<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Owned</span>' :
                            '<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">Wishlist</span>'
                        }
                    </div>
                    <button onclick="showGameDetails(${game.id})" class="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors duration-200">
                        View Details →
                    </button>
                </div>
            </div>
        </div>
    `;
}

function showGameDetails(gameId) {
    const game = allGames.find(g => g.id === gameId);
    if (!game) return;
    
    // For now, open BGG page in new tab
    window.open(`https://boardgamegeek.com/boardgame/${gameId}`, '_blank');
}

function clearAllFilters() {
    // Reset active filters
    activeFilters = {
        search: '',
        players: null,
        complexity: null,
        rating: null
    };
    
    // Clear search input
    document.getElementById('searchInput').value = '';
    
    // Reset filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('bg-blue-500', 'text-white');
        chip.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    // Reset sort
    document.getElementById('sortSelect').value = 'name';
    currentSort = 'name';
    
    // Reapply filters and sort
    applyFiltersAndSort();
}

function resetApp() {
    // Reset all data
    allGames = [];
    filteredGames = [];
    clearAllFilters();
    
    // Reset UI
    document.getElementById('usernameSection').classList.remove('hidden');
    document.getElementById('loadingSection').classList.add('hidden');
    document.getElementById('errorSection').classList.add('hidden');
    document.getElementById('collectionStats').classList.add('hidden');
    document.getElementById('filtersSection').classList.add('hidden');
    document.getElementById('gamesGrid').classList.add('hidden');
    
    // Clear username input
    document.getElementById('bggUsername').value = '';
}