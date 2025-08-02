# Use nginx alpine image for lightweight static file serving
FROM nginx:alpine

# Install Node.js and npm for WebSocket server
RUN apk add --no-cache curl nodejs npm

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx files
RUN rm -rf /usr/share/nginx/html/*

# Copy the entire project structure
COPY packages/ ./packages/
COPY city-logos/ ./city-logos/
COPY README.md ./
COPY data/ ./data/

# Copy dashboard as the root index
COPY packages/dashboard/dashboard.html ./index.html
COPY packages/dashboard/dashboard-styles.css ./dashboard-styles.css

# Install Node.js dependencies for WebSocket server
WORKDIR /usr/share/nginx/html/packages/fan-press-tracker
RUN npm ci --only=production

# Create data directory for WebSocket server
RUN mkdir -p /app/data && chown nginx:nginx /app/data

# Go back to web root
WORKDIR /usr/share/nginx/html

# Create nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose ports 80 (nginx) and 3002 (WebSocket server)
EXPOSE 80 3002

# Add health check for both services
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ && curl -f http://localhost:3002/health || exit 1

# Start both nginx and Node.js server
CMD ["/start.sh"]