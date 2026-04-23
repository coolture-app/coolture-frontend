FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx ng build

FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist /app/dist

ENV NODE_ENV=production

EXPOSE 4000
CMD ["node", "/app/dist/frontend/server/server.mjs"]