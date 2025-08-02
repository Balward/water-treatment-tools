# Use nginx alpine image for lightweight static file serving
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

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

# Create nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]