# StepAway Lightweight Node.js Docker Container
FROM node:20-alpine AS runner

WORKDIR /app

# Install dependencies first for Docker caching
COPY package.json ./
RUN npm install --omit=dev

# Copy application files
COPY server.js ./
COPY public/ ./public/

# Ensure data directory exists and is writable
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
