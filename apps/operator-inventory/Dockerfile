FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3080 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.js email.js catalog.json ./
COPY public ./public
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
