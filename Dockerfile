# Один образ для любого сервиса монорепозитория:
#   docker build --build-arg SERVICE=users-service -t tamagotchi/users-service .
# В docker-compose.yml SERVICE задаётся у каждого сервиса.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# за прокси с подменой TLS: docker build --secret id=ca,src=<корневой сертификат прокси> ...
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY libs ./libs
COPY apps ./apps
ARG SERVICE
RUN test -n "$SERVICE" || (echo "Укажите --build-arg SERVICE=<сервис>" && exit 1)
RUN npx nest build "$SERVICE" && npm prune --omit=dev

FROM node:24-alpine
ARG SERVICE
ENV NODE_ENV=production \
    SERVICE=${SERVICE}
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/${SERVICE} ./dist
# pets.proto читается во время работы (gRPC-сервер в pets, клиент в care)
COPY libs/contracts/proto ./libs/contracts/proto
USER node
EXPOSE 3000
# миграции накатываются при старте (DB_MIGRATIONS_RUN), сид – отдельно: node dist/apps/<сервис>/src/seed.js
CMD ["sh", "-c", "exec node dist/apps/$SERVICE/src/main.js"]
