# ResumeX API (the Express server) for Google Cloud Run or any container host.
# Built from the repository root so the shared resume guide is included.
FROM node:22-slim

WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

COPY server/ server/
COPY shared/ shared/

ENV NODE_ENV=production
WORKDIR /app/server
USER node

# Cloud Run sets PORT (8080); the server reads it.
CMD ["node", "server.js"]
