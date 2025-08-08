// Board Game Collection Browser
let allGames = [];
let filteredGames = [];
let activeFilters = {
    search: '',
    players: null,
    playtime: null,
    complexity: null,
    rating: null,
    status: null
};
let currentSort = 'name';

console.log('Board Game Collection Browser loaded');

// API configuration - use same origin since nginx proxies to backend
const API_BASE_URL = window.location.origin;

// Check if API server is available
let apiServerAvailable = false;
async function checkApiAvailability() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`, { 
            method: 'GET'
        });
        apiServerAvailable = response.ok;
        console.log('API server available:', apiServerAvailable);
    } catch (error) {
        apiServerAvailable = false;
        console.log('API server not available, using localStorage fallback only');
    }
}

// Collection management via API
async function saveCollectionToCache(username, games) {
    const cacheData = {
        username: username,
        games: games,
        timestamp: Date.now(),
        version: '1.0'
    };
    
    // Try API server first if available
    if (apiServerAvailable) {
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
            return;
        } catch (error) {
            console.warn('Failed to save to server, falling back to localStorage:', error);
        }
    }
    
    // Fallback to localStorage if server is unavailable
    try {
        const cacheKey = `bgg_collection_${username.toLowerCase()}`;
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log(`Saved collection for ${username} to localStorage with ${games.length} games`);
        
        // Verify the save worked
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
            const parsed = JSON.parse(saved);
            console.log(`Verification: saved collection has ${parsed.games?.length || 0} games`);
        }
    } catch (saveError) {
        console.error('Failed to save to localStorage:', saveError);
    }
}

async function loadCollectionFromCache(username) {
    // Try API server first if available
    if (apiServerAvailable) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/collections/${username}`);
            
            if (response.ok) {
                const data = await response.json();
                return data;
            } else if (response.status === 404) {
                // Not found on server, try localStorage
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.warn('Failed to load from server, checking localStorage:', error);
        }
    }
    
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

async function getSavedCollections() {
    // Try API server first if available
    if (apiServerAvailable) {
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
        }
    }
    
    // Fallback to localStorage
    const collections = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('bgg_collection_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const gameCount = data.games && Array.isArray(data.games) ? data.games.length : 0;
                console.log(`Collection ${data.username}: ${gameCount} games`);
                collections.push({
                    username: data.username,
                    timestamp: data.timestamp,
                    gameCount: gameCount
                });
            } catch (e) {
                console.warn('Failed to parse collection:', key);
            }
        }
    }
    return collections.sort((a, b) => b.timestamp - a.timestamp);
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
}

function setupCacheModal() {
    const modal = document.getElementById('cacheModal');
    const useCacheBtn = document.getElementById('useCacheBtn');
    const fetchFreshBtn = document.getElementById('fetchFreshBtn');
    
    let resolveModal = null;
    
    useCacheBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (resolveModal) resolveModal(true);
    });
    
    fetchFreshBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (resolveModal) resolveModal(false);
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            if (resolveModal) resolveModal(false);
        }
    });
    
    // Export function to show modal
    window.showCacheModal = function(username, cacheAge, gameCount) {
        return new Promise((resolve) => {
            resolveModal = resolve;
            const hours = Math.floor(cacheAge / (1000 * 60 * 60));
            const ageText = hours < 1 ? 'just now' : 
                           hours < 24 ? `${hours} hours ago` : 
                           `${Math.floor(hours / 24)} days ago`;
            
            document.getElementById('cacheModalText').textContent = 
                `Found cached collection for ${username} with ${gameCount} games (updated ${ageText}). Load from cache or fetch fresh data with latest weights?`;
            
            modal.classList.remove('hidden');
        });
    };
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Check API server availability first
    await checkApiAvailability();
    
    setupEventListeners();
    setupCacheModal();
    
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
            if (this.classList.contains('active')) {
                // Remove filter
                this.classList.remove('active');
                activeFilters[filterType] = null;
            } else {
                // Clear other filters of same type
                document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(otherChip => {
                    otherChip.classList.remove('active');
                });
                
                // Add filter
                this.classList.add('active');
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
    
    // Load complexity data button
    document.getElementById('loadComplexityBtn').addEventListener('click', async function() {
        this.disabled = true;
        this.textContent = 'Loading...';
        
        try {
            await enrichWithComplexityData(allGames);
            applyFiltersAndSort();
            this.classList.add('hidden');
        } catch (error) {
            console.error('Failed to load complexity data:', error);
            this.textContent = 'Load Complexity Data';
            this.disabled = false;
        }
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
    const cached = await loadCollectionFromCache(username);
    if (cached && cached.games) {
        const cacheAge = Date.now() - cached.timestamp;
        
        const useCache = await showCacheModal(username, cacheAge, cached.games.length);
        if (useCache) {
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
        
        // Try multiple CORS proxies for better reliability
        const corsProxies = [
            {
                name: 'corsproxy.io',
                url: (targetUrl) => `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
                parseResponse: async (response) => {
                    try {
                        return await response.json();
                    } catch (e) {
                        // If JSON parsing fails, try as text
                        const text = await response.text();
                        return JSON.parse(text);
                    }
                }
            },
            {
                name: 'allorigins',
                url: (targetUrl) => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
                parseResponse: async (response) => {
                    const data = await response.json();
                    return JSON.parse(data.contents);
                }
            },
            {
                name: 'thingproxy',
                url: (targetUrl) => `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
                parseResponse: async (response) => await response.json()
            },
            {
                name: 'cors-anywhere',
                url: (targetUrl) => `https://cors-anywhere.herokuapp.com/${targetUrl}`,
                parseResponse: async (response) => await response.json()
            }
        ];
        
        const targetUrl = `https://bgg-json.azurewebsites.net/collection/${username}?grouped=false`;
        let data = null;
        let lastError = null;
        
        for (const proxy of corsProxies) {
            try {
                updateLoadingProgress(`Trying ${proxy.name} proxy...`);
                console.log(`Attempting to fetch via ${proxy.name}: ${proxy.url(targetUrl)}`);
                
                const response = await fetch(proxy.url(targetUrl), {
                    headers: {
                        'Accept': 'application/json',
                    },
                    timeout: 15000 // 15 second timeout
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                updateLoadingProgress('Processing collection data...');
                data = await proxy.parseResponse(response);
                
                console.log(`Successfully fetched data via ${proxy.name}`);
                break;
                
            } catch (error) {
                console.warn(`${proxy.name} proxy failed:`, error);
                lastError = error;
                continue;
            }
        }
        
        if (!data) {
            throw new Error(`All CORS proxies failed. Last error: ${lastError?.message || 'Unknown error'}`);
        }
        
        // Debug: log the first game to see the structure
        console.log('BGG API Response sample:', data[0]);
        
        if (!data || data.length === 0) {
            throw new Error('No games found in collection. Make sure your collection is public.');
        }
        
        updateLoadingProgress('Processing game information...');
        allGames = await processGameData(data);
        
        // Always load complexity/weight data when fetching fresh
        updateLoadingProgress('Fetching complexity ratings...');
        await enrichWithComplexityData(allGames);
        
        // Save to cache
        console.log(`Saving collection for ${username} with ${allGames.length} games`);
        saveCollectionToCache(username, allGames);
        
        hideLoading();
        showCollection();
        displayStats();
        applyFiltersAndSort();
        
    } catch (error) {
        console.error('Error loading collection:', error);
        hideLoading();
        
        // Provide more helpful error messages
        let errorMessage = 'Failed to load collection. Please try again.';
        if (error.message.includes('CORS') || error.message.includes('Cross-Origin') || error.message.includes('NetworkError')) {
            errorMessage = 'Network access blocked by browser security. Please try refreshing the page or try again in a few minutes.';
        } else if (error.message.includes('proxies failed')) {
            errorMessage = 'All proxy servers are currently unavailable. Please try again in a few minutes.';
        } else if (error.message.includes('No games found')) {
            errorMessage = 'No games found in collection. Make sure your BoardGameGeek collection is public.';
        } else if (error.message.includes('timeout') || error.message.includes('fetch')) {
            errorMessage = 'Request timed out or network error. Please check your connection and try again.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showError(errorMessage);
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
    // Check if we have cached complexity data
    const complexityCache = JSON.parse(localStorage.getItem('bgg_complexity_cache') || '{}');
    const cacheAge = Date.now() - (complexityCache.timestamp || 0);
    const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 1 week
    
    // Filter games that need complexity data
    const gamesNeedingComplexity = games.filter(game => {
        if (complexityCache.data && complexityCache.data[game.id] && cacheAge < maxCacheAge) {
            game.complexity = complexityCache.data[game.id];
            return false;
        }
        return true;
    });
    
    if (gamesNeedingComplexity.length === 0) {
        updateLoadingProgress('Using cached complexity data...');
        return;
    }
    
    // Parallel batch processing for faster API calls
    const batchSize = 20; // Increased batch size for better performance
    const maxConcurrentBatches = 3; // Process multiple batches in parallel
    const batches = [];
    
    for (let i = 0; i < gamesNeedingComplexity.length; i += batchSize) {
        batches.push(gamesNeedingComplexity.slice(i, i + batchSize));
    }
    
    // Process batches in parallel chunks
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
        const batchChunk = batches.slice(i, i + maxConcurrentBatches);
        const batchPromises = batchChunk.map(async (batch, localIndex) => {
            const batchIndex = i + localIndex;
            const gameIds = batch.map(game => game.id).join(',');
            
            try {
                updateLoadingProgress(`Fetching complexity data (${batchIndex + 1}/${batches.length})...`);
                
                // Try multiple CORS proxies for complexity data too
                const complexityProxies = [
                    {
                        name: 'corsproxy.io',
                        url: (targetUrl) => `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
                        parseResponse: async (response) => {
                            const contentType = response.headers.get('content-type');
                            if (contentType && contentType.includes('application/json')) {
                                return await response.json();
                            } else {
                                return await response.text();
                            }
                        }
                    },
                    {
                        name: 'allorigins',
                        url: (targetUrl) => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
                        parseResponse: async (response) => {
                            const data = await response.json();
                            return data.contents;
                        }
                    },
                    {
                        name: 'thingproxy',
                        url: (targetUrl) => `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
                        parseResponse: async (response) => await response.text()
                    }
                ];
                
                const targetUrl = `https://boardgamegeek.com/xmlapi/boardgame/${gameIds}?stats=1`;
                let xmlData = null;
                
                for (const proxy of complexityProxies) {
                    try {
                        const response = await fetch(proxy.url(targetUrl), {
                            headers: { 'Accept': 'text/xml, application/xml, text/plain, */*' },
                            signal: AbortSignal.timeout(10000) // 10 second timeout
                        });
                        
                        if (!response.ok) continue;
                        
                        xmlData = await proxy.parseResponse(response);
                        if (xmlData && (typeof xmlData === 'string' || xmlData.length > 0)) {
                            break;
                        }
                        
                    } catch (error) {
                        console.warn(`Complexity ${proxy.name} proxy failed:`, error);
                        continue;
                    }
                }
                
                if (!xmlData) {
                    console.warn(`All complexity proxies failed for batch ${batchIndex + 1}`);
                    return; // Return from this map function instead of continue
                }
                
                // Parse XML data directly
                if (xmlData) {
                    try {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
                        
                        // Check for parsing errors
                        const parserError = xmlDoc.querySelector('parsererror');
                        if (parserError) {
                            console.warn(`XML parsing error for batch ${batchIndex + 1}:`, parserError.textContent);
                            return;
                        }
                        
                        const boardgames = xmlDoc.querySelectorAll('boardgame');
                        
                        boardgames.forEach(boardgame => {
                            const gameId = parseInt(boardgame.getAttribute('objectid'));
                            const game = batch.find(g => g.id === gameId);
                            
                            if (game) {
                                const averageWeight = boardgame.querySelector('averageweight');
                                const complexity = parseFloat(averageWeight?.textContent) || 0;
                                game.complexity = complexity;
                                
                                // Cache the result
                                if (!complexityCache.data) complexityCache.data = {};
                                complexityCache.data[gameId] = complexity;
                            }
                        });
                    } catch (parseError) {
                        console.warn(`Failed to parse XML for batch ${batchIndex + 1}:`, parseError);
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch complexity for batch ${batchIndex + 1}:`, error);
            }
        });
        
        // Wait for this chunk to complete
        await Promise.all(batchPromises);
        
        // Short delay between chunks to avoid overwhelming servers
        if (i + maxConcurrentBatches < batches.length) {
            await new Promise(resolve => setTimeout(resolve, 1200)); // Increased for stability
        }
    }
    
    // Update cache
    complexityCache.timestamp = Date.now();
    localStorage.setItem('bgg_complexity_cache', JSON.stringify(complexityCache));
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
                case '3':
                    return game.minPlayers <= 3 && game.maxPlayers >= 3;
                case '4':
                    return game.minPlayers <= 4 && game.maxPlayers >= 4;
                case '5+':
                    return game.maxPlayers >= 5;
                default:
                    return true;
            }
        });
    }
    
    // Apply playtime filter
    if (activeFilters.playtime) {
        filteredGames = filteredGames.filter(game => {
            if (!game.playingTime) return true; // Include games without playtime data
            const maxTime = parseInt(activeFilters.playtime);
            return game.playingTime <= maxTime;
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
    
    const rating = game.bggRating > 0 ? game.bggRating : (game.userRating > 0 ? game.userRating : 0);
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
            </div>
            
            <div class="p-6">
                <h3 class="font-bold text-lg text-gray-800 mb-4 leading-tight" style="height: 3.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${game.name}${game.yearPublished ? ` (${game.yearPublished})` : ''}</h3>
                
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
                            '<span class="bg-green-100 text-green-800 px-4 py-2.5 rounded-full text-xs font-medium">Owned</span>' : ''
                        }
                        ${game.wishlist ? 
                            '<span class="bg-purple-100 text-purple-800 px-4 py-2.5 rounded-full text-xs font-medium">Wishlist</span>' : ''
                        }
                        ${game.wantToPlay ? 
                            '<span class="bg-yellow-100 text-yellow-800 px-4 py-2.5 rounded-full text-xs font-medium">Want to Play</span>' : ''
                        }
                        ${!game.owned && !game.wishlist && !game.wantToPlay ? 
                            '<span class="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-full text-xs font-medium">Other</span>' : ''
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
        playtime: null,
        complexity: null,
        rating: null,
        status: null
    };
    
    // Clear search input
    document.getElementById('searchInput').value = '';
    
    // Reset filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
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