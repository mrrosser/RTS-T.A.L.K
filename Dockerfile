FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/backend ./backend
COPY --from=build /app/.agents/skills/evaluation-observability ./.agents/skills/evaluation-observability

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "backend/server.mjs"]
