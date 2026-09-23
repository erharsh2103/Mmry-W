# Build context is the repository root, so the image can include database/
# (migrations and Mongo validators) for the db-setup job.

FROM node:20-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/package.json ./

ENV DATABASE_DIR=/app/database
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
