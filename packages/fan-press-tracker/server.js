const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
});

// Store data in memory and optionally persist to file
let fanPressData = [];
const DATA_FILE = path.join(__dirname, 'data.json');

// Load existing data on startup
try {
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        fanPressData = JSON.parse(data);
        console.log(`Loaded ${fanPressData.length} existing records`);
    }
} catch (error) {
    console.error('Error loading existing data:', error);
}

// Save data to file
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(fanPressData, null, 2));
        console.log(`Saved ${fanPressData.length} records to ${DATA_FILE}`);
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// API endpoint to get all data
app.get('/api/data', (req, res) => {
    res.json(fanPressData);
});

// API endpoint to add new data
app.post('/api/data', (req, res) => {
    const newRecord = req.body;
    newRecord._timestamp = new Date().toISOString();
    newRecord._id = Date.now() + Math.random(); // Simple ID generation
    
    fanPressData.push(newRecord);
    saveData();
    
    // Broadcast to all connected clients
    const message = JSON.stringify({
        type: 'dataAdded',
        record: newRecord,
        totalRecords: fanPressData.length
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
    
    res.json({ success: true, id: newRecord._id });
});

// API endpoint to clear all data
app.delete('/api/data', (req, res) => {
    fanPressData = [];
    saveData();
    
    // Broadcast to all connected clients
    const message = JSON.stringify({
        type: 'dataCleared'
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
    
    res.json({ success: true });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const clientIp = req.connection.remoteAddress;
    console.log(`New WebSocket connection from ${clientIp}`);
    
    // Send current data count to new client
    ws.send(JSON.stringify({
        type: 'connected',
        totalRecords: fanPressData.length,
        message: 'Connected to Fan Press real-time sync'
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received WebSocket message:', data.type);
            
            // Handle different message types
            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                case 'requestData':
                    ws.send(JSON.stringify({
                        type: 'allData',
                        data: fanPressData
                    }));
                    break;
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log(`WebSocket connection closed from ${clientIp}`);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        connections: wss.clients.size,
        records: fanPressData.length
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Fan Press Tracker Server running on port ${PORT}`);
    console.log(`WebSocket server ready for real-time sync`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    saveData();
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    saveData();
    server.close(() => {
        process.exit(0);
    });
});