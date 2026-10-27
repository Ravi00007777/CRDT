# Single image: builds the web app and serves it from the Express/Hocuspocus server.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/apps/server/package.json /app/apps/server/prisma.config.ts apps/server/
COPY --from=build /app/apps/server/prisma apps/server/prisma
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
WORKDIR /app/apps/server
EXPOSE 4000
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
