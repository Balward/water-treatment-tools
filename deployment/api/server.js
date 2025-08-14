const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for game collections

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = path.join(dataDir, 'collections.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// API Routes

// Get all saved collections (just usernames and metadata)
app.get('/api/collections', (req, res) => {
    db.all(`SELECT username, created_at, updated_at, 
            length(data) as data_size 
            FROM collections 
            ORDER BY updated_at DESC`, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const collections = rows.map(row => {
            const data = JSON.parse(row.data || '{}');
            return {
                username: row.username,
                gameCount: data.games ? data.games.length : 0,
                timestamp: new Date(row.updated_at).getTime(),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                dataSizeKB: Math.round(row.data_size / 1024)
            };
        });
        
        res.json(collections);
    });
});

// Get a specific collection
app.get('/api/collections/:username', (req, res) => {
    const username = req.params.username.toLowerCase();
    
    db.get(`SELECT * FROM collections WHERE username = ?`, [username], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        try {
            const collection = JSON.parse(row.data);
            res.json(collection);
        } catch (parseErr) {
            console.error('JSON parse error:', parseErr);
            res.status(500).json({ error: 'Invalid collection data' });
        }
    });
});

// Save or update a collection
app.post('/api/collections/:username', (req, res) => {
    const username = req.params.username.toLowerCase();
    const collectionData = req.body;
    
    if (!collectionData || !collectionData.games) {
        return res.status(400).json({ error: 'Invalid collection data' });
    }
    
    const dataString = JSON.stringify(collectionData);
    
    db.run(`INSERT OR REPLACE INTO collections (username, data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)`, 
            [username, dataString], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to save collection' });
        }
        
        console.log(`Saved collection for ${username} (${collectionData.games.length} games)`);
        res.json({ 
            success: true, 
            username: username,
            gameCount: collectionData.games.length,
            timestamp: Date.now()
        });
    });
});

// Delete a collection
app.delete('/api/collections/:username', (req, res) => {
    const username = req.params.username.toLowerCase();
    
    db.run(`DELETE FROM collections WHERE username = ?`, [username], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete collection' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        
        console.log(`Deleted collection for ${username}`);
        res.json({ success: true, deleted: username });
    });
});

// Video discovery endpoint
app.get('/api/videos', (req, res) => {
    const videosDir = path.join(__dirname, '../Videos');
    
    try {
        // Check if Videos directory exists
        if (!fs.existsSync(videosDir)) {
            return res.json([]);
        }
        
        // Read directory contents
        const files = fs.readdirSync(videosDir);
        
        // Filter for video files and create video objects
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext);
        });
        
        const videos = videoFiles.map(filename => {
            // Extract title from filename (remove extension and clean up)
            const title = path.basename(filename, path.extname(filename))
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            
            return {
                filename: filename,
                title: title,
                description: `Learn ${title.toLowerCase()} - Essential water treatment concepts and calculations`
            };
        });
        
        res.json(videos);
    } catch (error) {
        console.error('Error reading videos directory:', error);
        res.status(500).json({ error: 'Failed to read videos directory' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    db.get("SELECT COUNT(*) as count FROM collections", (err, row) => {
        if (err) {
            return res.status(500).json({ status: 'error', error: err.message });
        }
        res.json({ 
            status: 'healthy', 
            collections: row.count,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`BGG Collection API server running on port ${PORT}`);
    console.log(`Database: ${dbPath}`);
});