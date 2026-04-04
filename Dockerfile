FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration development

FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package*.json ./
ENV npm_config_ignore_scripts=true
RUN npm ci --omit=dev

COPY --from=builder /app/dist/frontend /app/dist

EXPOSE 4000
CMD ["node", "dist/server/server.mjs"]