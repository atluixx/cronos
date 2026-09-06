FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run --workspace frontend build
RUN npx prisma generate --schema backend/prisma/schema.prisma
RUN npm run --workspace backend build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/frontend/dist ./public
COPY backend/package.json ./package.json

RUN mkdir -p /app/media /app/data

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node dist/index.js"]
