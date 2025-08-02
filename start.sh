#!/bin/sh

# Start the Node.js WebSocket server in the background
echo "Starting Fan Press WebSocket server..."
cd /usr/share/nginx/html/packages/fan-press-tracker
node server.js &

# Wait a moment for Node.js server to start
sleep 2

# Start nginx in the foreground
echo "Starting nginx web server..."
nginx -g "daemon off;" &

# Wait for all background processes
wait