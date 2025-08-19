# Multi-stage build for both Node.js proxy and static files
FROM node:18-alpine as node-stage

# Set working directory for Node.js app
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install --production

# Copy the proxy server
COPY claude-proxy-server.js ./

# Production stage with nginx + node
FROM nginx:alpine

# Install Node.js and curl
RUN apk add --no-cache nodejs npm curl

# Set up Node.js app
WORKDIR /app
COPY --from=node-stage /app ./

# Set up static files
WORKDIR /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/*

# Copy the entire project structure
COPY apps/ ./apps/
COPY assets/ ./assets/
COPY docs/ ./docs/
COPY sample-data/ ./sample-data/
COPY README.md ./
COPY global-styles.css ./

# Copy dashboard as the root index
COPY apps/dashboard/dashboard.html ./index.html

# Create nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'cd /app && node claude-proxy-server.js &' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

# Expose both ports
EXPOSE 80 3001

# Environment variable for API key
ENV CLAUDE_API_KEY=""

# Add health check for both services
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost/ && curl -f http://localhost:3001/health || exit 1

# Start both services
CMD ["/start.sh"]