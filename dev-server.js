#!/usr/bin/env node

/**
 * Development Server for Water Treatment Tools
 * Mimics the Docker/nginx routing for local development
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const ROOT_DIR = __dirname;

// MIME types mapping
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel'
};

// Route mapping (mimics nginx configuration)
const ROUTES = {
    // Dashboard routes
    '/': '/apps/dashboard/dashboard.html',
    '/dashboard/': '/apps/dashboard/dashboard.html',
    
    // App routes
    '/robojar-analyzer/': '/apps/robojar-analyzer/index.html',
    '/dose-predictor/': '/apps/dose-predictor/index.html',
    '/data-parser/': '/apps/data-parser/index.html',
    '/regulation-100-study/': '/apps/regulation-100-study/index.html',
    '/water-treatment-flashcards/': '/apps/water-treatment-flashcards/index.html',
    '/sodium-hypochlorite-calculator/': '/apps/sodium-hypochlorite-calculator/index.html',
    '/data-analyzer/': '/apps/data-analyzer/index.html',
    '/video-tutorials/': '/apps/video-tutorials/index.html',
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
    // Decode URL-encoded characters (like %20 for spaces)
    const decodedFilePath = decodeURIComponent(filePath);
    const fullPath = path.join(ROOT_DIR, decodedFilePath);
    
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            console.log(`404: ${decodedFilePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }
        
        const mimeType = getMimeType(filePath);
        const headers = {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        };
        
        // Add caching headers
        if (filePath.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|ttf|otf|woff|woff2)$/)) {
            headers['Cache-Control'] = 'public, max-age=3600';
        }
        
        res.writeHead(200, headers);
        res.end(data);
        console.log(`200: ${decodedFilePath} (${mimeType})`);
    });
}

function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    
    console.log(`${req.method} ${pathname}`);
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        });
        res.end();
        return;
    }
    
    // Handle favicon specially
    if (pathname === '/favicon.ico') {
        serveFile(res, '/assets/logos/favicon.png');
        return;
    }
    
    // Check for direct route mapping
    if (ROUTES[pathname]) {
        serveFile(res, ROUTES[pathname]);
        return;
    }
    
    // Check if it's a direct file request
    if (pathname.startsWith('/apps/') || 
        pathname.startsWith('/assets/') || 
        pathname.startsWith('/sample-data/') || 
        pathname.startsWith('/docs/') ||
        pathname === '/global-styles.css') {
        serveFile(res, pathname);
        return;
    }
    
    // Handle app sub-routes (e.g., /robojar-analyzer/script.js)
    for (const route in ROUTES) {
        if (pathname.startsWith(route) && route !== '/') {
            const subPath = pathname.substring(route.length);
            const appDir = ROUTES[route].replace('/index.html', '');
            const fullPath = `${appDir}/${subPath}`;
            serveFile(res, fullPath);
            return;
        }
    }
    
    // Handle global styles
    if (pathname === '/global-styles.css') {
        serveFile(res, '/global-styles.css');
        return;
    }
    
    // 404 for everything else
    console.log(`404: No route found for ${pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
        <h1>404 Not Found</h1>
        <p>Path: ${pathname}</p>
        <h2>Available Routes:</h2>
        <ul>
            ${Object.keys(ROUTES).map(route => `<li><a href="${route}">${route}</a></li>`).join('')}
        </ul>
    `);
}

// Create and start the server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`🚀 Water Treatment Tools Development Server`);
    console.log(`📍 Running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${ROOT_DIR}`);
    console.log(`🔗 Available routes:`);
    Object.entries(ROUTES).forEach(([route, file]) => {
        console.log(`   ${route} → ${file}`);
    });
    console.log(`\n🛑 Press Ctrl+C to stop the server\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server shutting down...');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

module.exports = server;