# Тамагочи – серверная часть системы ухода за виртуальными питомцами

Курсовой проект по Backend. Игрок заводит питомца из яйца, кормит, играет, лечит и воспитывает его;
питомец живёт и без игрока – голодает, болеет, растёт и может умереть. Сервер хранит питомцев,
моделирует их жизнь во времени, ведёт игровую экономику и присылает уведомления.

Четыре микросервиса на NestJS 12 (Node.js 24) за шлюзом nginx:

| Сервис | Что делает |
|---|---|
| `users-service` | регистрация, вход, JWT RS256, профиль |
| `pets-service` | питомцы и их жизнь во времени, gRPC `PetCare` |
| `care-service` | каталог предметов, магазин, кошелёк, инвентарь, уход за питомцем |
| `notifications-service` | уведомления, живой поток SSE |

PostgreSQL 18 (база на сервис), RabbitMQ 4 (события, outbox и inbox), Redis 7 (кэш, отзыв токенов),
Silo (S3, иконки). Подробно – [`docs/architecture.md`](docs/architecture.md), диаграммы – `docs/diagrams/`,
описание API – [`docs/openapi/tamagotchi.json`](docs/openapi/tamagotchi.json).

## Запуск

Нужны Docker с Compose и Node.js 24.

```bash
cp .env.example .env
```

В `.env` задайте свои пароли, затем создайте ключи JWT (появятся в `secrets/`, в репозиторий не попадают):

```bash
npm ci && npm run keys
```

```bash
docker compose up -d --build
```

Когда все контейнеры станут healthy, заполните справочники и создайте администратора (`ADMIN_LOGIN`, `ADMIN_PASSWORD` из `.env`):

```bash
docker compose exec users-service node dist/apps/users-service/src/seed.js
```

```bash
docker compose exec pets-service node dist/apps/pets-service/src/seed.js
```

```bash
docker compose exec care-service node dist/apps/care-service/src/seed.js
```

| Адрес | Что |
|---|---|
| http://localhost:8080/docs | Swagger UI сервисов |
| http://localhost:8080/api/... | API (через nginx) |
| http://localhost:8081 | Adminer (сервер `postgres`) |
| http://localhost:15672 | RabbitMQ management |
| http://localhost:9001 | консоль Silo |

## Разработка

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm test
```

Сервис из исходников при работающей инфраструктуре (`docker compose up -d postgres rabbitmq redis silo silo-init`):

```bash
npm run start:users
```

Экспорт OpenAPI без базы и брокера (нужна сборка):

```bash
node scripts/export-openapi.js
```

Правила разработки и команды для всех сервисов – [`CLAUDE.md`](CLAUDE.md).
