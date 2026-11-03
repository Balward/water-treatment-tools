# Multi-stage build for both Node.js proxy and static files
FROM node:24-alpine AS node-stage

# Set working directory for Node.js app
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy .env template (actual .env will be mounted or passed via environment)
COPY .env.template ./.env.template

# Copy the proxy server
COPY claude-proxy-server.js ./
COPY plant-rounds-api.js ./
COPY application-review-api.js ./
COPY apps/application-review/model.js ./apps/application-review/model.js
COPY apps/application-review/reference-data.js ./apps/application-review/reference-data.js
COPY apps/application-review/hiring-reviews.js ./apps/application-review/hiring-reviews.js
COPY plant-rounds-pdf.js ./
COPY assets/fonts/pdf/ ./assets/fonts/pdf/
COPY apps/plant-rounds/template.json ./apps/plant-rounds/template.json

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
COPY shared/ ./shared/
COPY docs/ ./docs/
COPY sample-data/ ./sample-data/
COPY README.md ./
COPY global-styles.css ./

# Copy dashboard as the root index
COPY apps/dashboard/dashboard.html ./index.html
COPY apps/dashboard/dashboard.css ./dashboard.css

# Create nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
RUN nginx -t

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
