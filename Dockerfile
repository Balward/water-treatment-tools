# Multi-stage build for Node.js API and static files
FROM node:18-alpine AS api-builder

# Set working directory for API
WORKDIR /app/api

# Copy API package files
COPY deployment/api/package*.json ./

# Install API dependencies
RUN npm install --production

# Copy API source code
COPY deployment/api/ ./

# Final stage - nginx with supervisor to run both nginx and node
FROM nginx:alpine

# Install supervisor, node, and curl
RUN apk add --no-cache supervisor nodejs npm curl

# Create directories for supervisor and logs
RUN mkdir -p /var/log/supervisor /etc/supervisor/conf.d

# Set working directory for static files
WORKDIR /usr/share/nginx/html

# Remove default nginx files
RUN rm -rf /usr/share/nginx/html/*

# Copy the entire project structure
COPY apps/ ./apps/
COPY assets/ ./assets/
COPY docs/ ./docs/
COPY sample-data/ ./sample-data/
COPY README.md ./
COPY global-styles.css ./
COPY dev-server.js ./

# Copy dashboard as the root index
COPY apps/dashboard/dashboard.html ./index.html

# Copy API from builder stage
COPY --from=api-builder /app/api /app/api

# Create nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create supervisor configuration
RUN echo '[supervisord]' > /etc/supervisor/conf.d/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'logfile=/var/log/supervisor/supervisord.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'pidfile=/var/run/supervisord.pid' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:nginx]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/supervisor/nginx.err.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/supervisor/nginx.out.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:api]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=node /app/api/server.js' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'directory=/app/api' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/supervisor/api.err.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/supervisor/api.out.log' >> /etc/supervisor/conf.d/supervisord.conf

# Create volume mount point for API data persistence
RUN mkdir -p /app/api/data
VOLUME ["/app/api/data"]

# Expose only web port (API is internal and proxied by nginx)
EXPOSE 80

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ && curl -f http://localhost:3001/api/health || exit 1

# Start supervisor (which starts both nginx and node API)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]