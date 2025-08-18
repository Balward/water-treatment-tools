# Static file serving with nginx
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

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

# Create nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose web port
EXPOSE 80

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]