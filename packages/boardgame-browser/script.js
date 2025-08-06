// Board Game Collection Browser
let allGames = [];
let filteredGames = [];
let activeFilters = {
    search: '',
    players: null,
    complexity: null,
    rating: null,
    status: null
};
let currentSort = 'name';

console.log('Board Game Collection Browser loaded');

// API configuration - use same origin since nginx proxies to backend
const API_BASE_URL = window.location.origin;

// Collection management via API
async function saveCollectionToCache(username, games) {
    const cacheData = {
        username: username,
        games: games,
        timestamp: Date.now(),
        version: '1.0'
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/collections/${username}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cacheData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Collection saved to server:', result);
        updateSavedCollectionsList();
    } catch (error) {
        console.warn('Failed to save to server, falling back to localStorage:', error);
        // Fallback to localStorage if server is unavailable
        localStorage.setItem(`bgg_collection_${username.toLowerCase()}`, JSON.stringify(cacheData));
        updateSavedCollectionsList();
    }
}

async function loadCollectionFromCache(username) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/collections/${username}`);
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else if (response.status === 404) {
            return null; // Collection not found
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.warn('Failed to load from server, checking localStorage:', error);
        // Fallback to localStorage
        const cacheKey = `bgg_collection_${username.toLowerCase()}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.warn('Failed to parse localStorage data for', username);
                localStorage.removeItem(cacheKey);
            }
        }
        return null;
    }
}

async function getSavedCollections() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/collections`);
        
        if (response.ok) {
            const collections = await response.json();
            return collections;
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.warn('Failed to load collections from server, checking localStorage:', error);
        // Fallback to localStorage
        const collections = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('bgg_collection_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    collections.push({
                        username: data.username,
                        timestamp: data.timestamp,
                        gameCount: data.games ? data.games.length : 0
                    });
                } catch (e) {
                    console.warn('Failed to parse collection:', key);
                }
            }
        }
        return collections.sort((a, b) => b.timestamp - a.timestamp);
    }
}

async function deleteCachedCollection(username) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/collections/${username}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log(`Deleted collection for ${username} from server`);
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.warn('Failed to delete from server, removing from localStorage:', error);
        // Fallback to localStorage
        localStorage.removeItem(`bgg_collection_${username.toLowerCase()}`);
    }
    
    updateSavedCollectionsList();
}

async function updateSavedCollectionsList() {
    const savedCollectionsList = document.getElementById('savedCollectionsList');
    const savedCollectionsSection = document.getElementById('savedCollections');
    
    try {
        const collections = await getSavedCollections();
        
        if (collections.length === 0) {
            savedCollectionsSection.style.display = 'none';
            return;
        }
        
        savedCollectionsSection.style.display = 'block';
        
        savedCollectionsList.innerHTML = collections.map(collection => {
        const ageHours = Math.floor((Date.now() - collection.timestamp) / (1000 * 60 * 60));
        const ageText = ageHours < 1 ? 'Just now' : 
                       ageHours < 24 ? `${ageHours}h ago` : 
                       `${Math.floor(ageHours / 24)}d ago`;
        
        return `
            <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border">
                <button onclick="loadCollection('${collection.username}')" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
                    🎲 ${collection.username}
                </button>
                <div class="text-xs text-gray-600">
                    <div>${collection.gameCount} games</div>
                    <div>${ageText}</div>
                </div>
                <button onclick="refreshCollection('${collection.username}')" 
                        class="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors" 
                        title="Refresh collection">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                </button>
                <button onclick="deleteSavedCollection('${collection.username}')" 
                        class="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Delete saved collection">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
    } catch (error) {
        console.error('Error updating saved collections list:', error);
        savedCollectionsList.innerHTML = '<p class="text-red-500 text-sm">Error loading saved collections</p>';
    }
}

function refreshCollection(username) {
    // Delete cache and reload fresh
    deleteCachedCollection(username);
    document.getElementById('bggUsername').value = username;
    loadCollection(username);
}

function deleteSavedCollection(username) {
    if (confirm(`Delete saved collection for ${username}?`)) {
        deleteCachedCollection(username);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateSavedCollectionsList();
    
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

async function loadCollection(username = null) {
    if (!username) {
        username = document.getElementById('bggUsername').value.trim();
    }
    
    if (!username) {
        showError('Please enter a BoardGameGeek username');
        return;
    }
    
    // Check cache first
    const cached = loadCollectionFromCache(username);
    if (cached) {
        const cacheAge = Date.now() - cached.timestamp;
        const hours = Math.floor(cacheAge / (1000 * 60 * 60));
        
        if (confirm(`Found cached collection for ${username} (${hours} hours old, ${cached.games.length} games). Load from cache or fetch fresh data?\n\nClick OK for cache, Cancel for fresh data.`)) {
            allGames = cached.games;
            showCollection();
            displayStats();
            applyFiltersAndSort();
            return;
        }
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
        
        // Debug: log the first game to see the structure
        console.log('BGG API Response sample:', data[0]);
        
        if (!data || data.length === 0) {
            throw new Error('No games found in collection. Make sure your collection is public.');
        }
        
        updateLoadingProgress('Processing game information...');
        allGames = await processGameData(data);
        
        updateLoadingProgress('Fetching complexity ratings...');
        await enrichWithComplexityData(allGames);
        
        // Save to cache
        saveCollectionToCache(username, allGames);
        
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
        
        // Debug first few games to understand structure
        if (i < 3) {
            console.log(`Game ${i}:`, game);
        }
        
        // Extract game data - try multiple possible field names
        const processedGame = {
            id: game.gameId || game.id || game.objectId,
            name: game.name || game.gameName || 'Unknown Game',
            image: game.image || game.imageUrl || 'https://via.placeholder.com/400x400?text=No+Image',
            thumbnail: game.image || game.thumbnail || game.thumbnailUrl || 'https://via.placeholder.com/300x300?text=No+Image',
            yearPublished: parseInt(game.yearPublished) || parseInt(game.year) || 0,
            minPlayers: parseInt(game.minPlayers) || parseInt(game.minplaytime) || 1,
            maxPlayers: parseInt(game.maxPlayers) || parseInt(game.maxplaytime) || parseInt(game.minPlayers) || 1,
            playingTime: parseInt(game.playingTime) || parseInt(game.playTime) || parseInt(game.maxplaytime) || 0,
            minAge: parseInt(game.minAge) || parseInt(game.minage) || 0,
            
            // BGG ratings and stats
            bggRating: parseFloat(game.averageRating) || 0, // averageRating is the community rating
            averageRating: parseFloat(game.averageRating) || 0,
            bggRank: parseInt(game.rank) || parseInt(game.bggRank) || 999999,
            complexity: parseFloat(game.averageWeight) || parseFloat(game.complexity) || parseFloat(game.weight) || 0,
            
            // User specific data - rating is -1.0 when not rated
            userRating: (game.rating && game.rating > 0) ? parseFloat(game.rating) : 0,
            owned: game.owned === 'true' || game.owned === true || game.own === 'true' || game.own === true,
            wantToPlay: game.wantToPlay === 'true' || game.wantToPlay === true,
            wishlist: game.wishlist === 'true' || game.wishlist === true,
            numPlays: parseInt(game.numPlays) || parseInt(game.plays) || 0,
            
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

async function enrichWithComplexityData(games) {
    // Batch fetch complexity data from BGG XML API in smaller groups
    const batchSize = 10; // Smaller batches to avoid issues
    const batches = [];
    
    for (let i = 0; i < games.length; i += batchSize) {
        batches.push(games.slice(i, i + batchSize));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const gameIds = batch.map(game => game.id).join(',');
        
        try {
            updateLoadingProgress(`Fetching complexity data (batch ${batchIndex + 1}/${batches.length})...`);
            
            // Use BGG XML API directly with stats=1 to get averageweight
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://boardgamegeek.com/xmlapi/boardgame/${gameIds}?stats=1`)}`);
            const data = await response.json();
            
            if (data.contents) {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
                const boardgames = xmlDoc.querySelectorAll('boardgame');
                
                boardgames.forEach(boardgame => {
                    const gameId = parseInt(boardgame.getAttribute('objectid'));
                    const game = batch.find(g => g.id === gameId);
                    
                    if (game) {
                        const averageWeight = boardgame.querySelector('averageweight');
                        if (averageWeight) {
                            game.complexity = parseFloat(averageWeight.textContent) || 0;
                        }
                    }
                });
            }
            
            // Rate limiting - wait between batches
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
        } catch (error) {
            console.warn(`Failed to fetch complexity for batch ${batchIndex + 1}:`, error);
        }
    }
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
    const wishlistCount = allGames.filter(game => game.wishlist || game.wantToPlay || !game.owned).length;
    
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
    
    // Apply status filter
    if (activeFilters.status) {
        filteredGames = filteredGames.filter(game => {
            switch (activeFilters.status) {
                case 'owned':
                    return game.owned;
                case 'wishlist':
                    return game.wishlist || (!game.owned && !game.wantToPlay);
                case 'wantToPlay':
                    return game.wantToPlay;
                default:
                    return true;
            }
        });
    }
    
    // Apply complexity filter
    if (activeFilters.complexity) {
        filteredGames = filteredGames.filter(game => {
            if (game.complexity === 0) return true; // Include games without complexity data
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
            case 'owned':
                if (a.owned && !b.owned) return -1;
                if (!a.owned && b.owned) return 1;
                return a.name.localeCompare(b.name);
            case 'wishlist':
                if (a.wishlist && !b.wishlist) return -1;
                if (!a.wishlist && b.wishlist) return 1;
                return a.name.localeCompare(b.name);
            case 'wantToPlay':
                if (a.wantToPlay && !b.wantToPlay) return -1;
                if (!a.wantToPlay && b.wantToPlay) return 1;
                return a.name.localeCompare(b.name);
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
    // Complexity display logic
    const hasComplexity = game.complexity > 0;
    const complexityColor = hasComplexity ? 
        (game.complexity <= 2.0 ? 'text-green-600' : 
         game.complexity <= 3.5 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-500';
    
    const complexityText = hasComplexity ? 
        (game.complexity <= 2.0 ? 'Light' : 
         game.complexity <= 3.5 ? 'Medium' : 'Heavy') : 'Unknown';
    
    const rating = game.userRating > 0 ? game.userRating : game.bggRating;
    const ratingColor = rating >= 8 ? 'text-green-600' : 
                       rating >= 7 ? 'text-blue-600' : 
                       rating >= 6 ? 'text-yellow-600' : 'text-gray-600';
    const displayRating = rating > 0 ? rating.toFixed(1) : 'N/A';
    
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
                        <div class="text-2xl font-bold ${ratingColor} mb-1">${displayRating}</div>
                        <div class="text-xs text-gray-600 uppercase tracking-wide">Rating</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold ${complexityColor} mb-1">${hasComplexity ? game.complexity.toFixed(1) : 'N/A'}</div>
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
                    <div class="flex items-center gap-2 flex-wrap">
                        ${game.owned ? 
                            '<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Owned</span>' : ''
                        }
                        ${game.wishlist ? 
                            '<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">Wishlist</span>' : ''
                        }
                        ${game.wantToPlay ? 
                            '<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">Want to Play</span>' : ''
                        }
                        ${!game.owned && !game.wishlist && !game.wantToPlay ? 
                            '<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">Other</span>' : ''
                        }
                    </div>
                    <button onclick="showGameDetails(${game.id})" class="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors duration-200 flex-shrink-0">
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
        rating: null,
        status: null
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