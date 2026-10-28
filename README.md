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

## Запуск с нуля

Нужны Docker с Compose и Node.js 24.

```bash
cp .env.example .env
```

В `.env` задайте свои пароли (учётка администратора – `ADMIN_LOGIN`, `ADMIN_PASSWORD`). За прокси с подменой
TLS положите его корневой сертификат в `secrets/` и укажите путь в `BUILD_CA_FILE` – он нужен `npm ci` при сборке образов.

Ключи JWT (появятся в `secrets/`, в репозиторий не попадают):

```bash
npm ci && npm run keys
```

```bash
docker compose up -d --build
```

Дождитесь, пока все контейнеры станут healthy (`docker compose ps`).

## Сид

Сид запускается только после первого старта сервисов: таблицы создают миграции, которые накатываются при старте.
Сид создаёт администратора из `.env`, справочник форм питомца с картинками в Silo и каталог предметов;
повторный запуск ничего не дублирует.

```bash
docker compose exec users-service node dist/apps/users-service/src/seed.js
```

```bash
docker compose exec pets-service node dist/apps/pets-service/src/seed.js
```

```bash
docker compose exec care-service node dist/apps/care-service/src/seed.js
```

В образе сборка сервиса лежит в `dist/apps/<сервис>`, поэтому путь короче, чем при локальной сборке
(`dist/apps/<сервис>/apps/<сервис>/src/seed.js`, его запускают `npm run seed:users`, `seed:pets`, `seed:care`).

## Адреса

| Адрес | Что |
|---|---|
| http://localhost:8080/docs | Swagger UI: `/docs/users`, `/docs/pets`, `/docs/care`, `/docs/notifications` |
| http://localhost:8080/api/... | API через nginx |
| http://localhost:8081 | Adminer: сервер `postgres`, учётки баз – `*_DB_USER`, `*_DB_PASSWORD` из `.env` |
| http://localhost:15672 | RabbitMQ management: `RABBITMQ_USER`, `RABBITMQ_PASSWORD` |
| http://localhost:9001 | консоль Silo: `SILO_ACCESS_KEY`, `SILO_SECRET_KEY` |

Администратор – `ADMIN_LOGIN` / `ADMIN_PASSWORD` из `.env` (по умолчанию `admin` / `change-me-admin1`):
вход `POST /api/auth/login`, токен – в Swagger через «Authorize». Перемотка времени питомца работает при `DEMO_MODE=true`.

## Сценарий демо: e2e

Сценарий защиты (10 шагов: регистрация и стартовый набор, яйцо, перемотка, голод и SSE, кормление, ошибка ухода,
остановка pets-service и досылка, покупка без денег, выход, иконка в Silo и кэш) идёт против поднятого compose
после сида и сам останавливает и запускает `pets-service`:

```bash
npm run test:e2e
```

Адреса и учётки берутся из `.env`; около минуты, можно запускать повторно.

## Postman

Импортируйте `docs/postman/tamagotchi.postman_collection.json` и окружение `docs/postman/tamagotchi.postman_environment.json`
(в окружении поправьте `adminPassword` и `rabbitUrl`, если меняли их в `.env`). Папки – те же 10 шагов; токены игрока
и админа сохраняются в переменные сами. Перед папкой 7 выполните `docker compose stop pets-service`, после первого
запроса – `docker compose start pets-service`. Для загрузки иконки укажите файл `docs/postman/teddy.png`.

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

Экспорт OpenAPI без базы и брокера (нужна сборка) и склейка `docs/openapi/tamagotchi.json`:

```bash
node scripts/export-openapi.js
```

Правила разработки и команды для всех сервисов – [`CLAUDE.md`](CLAUDE.md).
