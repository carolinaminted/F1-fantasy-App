FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev

COPY worker/server.js ./server.js
COPY api/scoring.js ./scoring.js

USER node
EXPOSE 8080

CMD ["node", "server.js"]
