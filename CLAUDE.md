# CLAUDE.md – правила для сессий A–D и E

Курсовая по Backend: серверная часть системы ухода за виртуальными питомцами (тамагочи).
Единственный источник правды – `docs/architecture.md`; классы, поля и методы – `docs/diagrams/Классы подробно.drawio`
(генератор `docs/diagrams/исходники/make_diagrams.py`, раздел «классы»). Диаграммы и генератор не менять.

## Кто что делает

| Сессия | Папка | Что |
|---|---|---|
| A | `apps/users-service` | регистрация, вход, выход, профиль, JWT, `user.registered` через outbox |
| B | `apps/pets-service` | питомцы, `simulate`, планировщик, перемотка, gRPC `PetCare`, события `pet.*` через outbox |
| C | `apps/care-service` | каталог (кэш Redis, иконки Silo), кошелёк, магазин, инвентарь, сага ухода, досылка, обработчики событий |
| D | `apps/notifications-service` | уведомления, курсорная пагинация, настройки, SSE, обработчики событий |
| E | всё | интеграция, `package.json`, склейка OpenAPI, e2e, Postman |

Каркас (S0) готов: все методы §10 с DTO, guard'ами и Swagger, сущности и миграции §7, сид, общие библиотеки.
Тела методов сервисов – `throw new NotImplementedException()` (ответ 501), их и пишет каждая сессия.

## Замороженные файлы – не менять

- `package.json`, `package-lock.json` (зависимости уже стоят; меняет только E);
- `docker-compose.yml`, `Dockerfile`, `.env.example`, `deploy/`, `db/init/`, `nest-cli.json`, `tsconfig*.json`, `eslint.config.mjs`;
- `libs/common/**`, `libs/contracts/**` (включая `pets.proto`);
- чужие `apps/*`.

Нужна правка в замороженном файле – не делать, а записать в отчёт сессии (что и зачем); её сделает E.

## Окружение облачной сессии

Node.js 24 LTS. В образе облака по умолчанию Node 22 – поставить 24 и пользоваться им в каждой команде:

```bash
curl -fsSLO https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-x64.tar.xz && mkdir -p /opt/node24 && tar -xJf node-v24.22.1-linux-x64.tar.xz -C /opt/node24 --strip-components=1
```

```bash
export PATH=/opt/node24/bin:$PATH
```

Docker в облаке установлен, но демон не запущен:

```bash
nohup dockerd > /tmp/dockerd.log 2>&1 &
```

Docker Hub может ответить 429 (лимит анонимных скачиваний) – тогда образы берутся с зеркала и получают обычные имена:

```bash
for i in postgres:18-alpine rabbitmq:4-management-alpine redis:7-alpine adminer:latest nginx:1.29-alpine node:24-alpine; do docker pull mirror.gcr.io/library/$i && docker tag mirror.gcr.io/library/$i $i; done; docker pull pgsty/silo:latest
```

Прокси облака подменяет TLS, поэтому `npm ci` внутри сборки образа нужен его сертификат (секрет `ca` в Dockerfile):

```bash
for s in users-service pets-service care-service notifications-service; do docker build --secret id=ca,src=/root/.ccr/ca-bundle.crt --build-arg SERVICE=$s -t tamagotchi/$s:dev .; done
```

Инфраструктура и сервисы (без `--build`: compose возьмёт собранные образы `tamagotchi/<сервис>:dev`):

```bash
cp .env.example .env && npm run keys && docker compose up -d
```

Только инфраструктура для локального запуска сервиса из исходников:

```bash
docker compose up -d postgres rabbitmq redis silo silo-init
```

Если Docker недоступен – PostgreSQL 18, Redis и RabbitMQ ставятся через apt; базы и учётные записи – как в `db/init/01-databases.sh`.

## Команды

| Что | Команда |
|---|---|
| Зависимости | `npm ci` |
| Сборка всех / одного | `npm run build` / `npm run build:users` (`:pets`, `:care`, `:notifications`) |
| Линт и формат | `npm run lint`, `npm run format` |
| Unit-тесты | `npm test` (Jest с `--experimental-vm-modules`: NestJS 12 – ESM-пакеты) |
| Сервис локально (watch) | `npm run start:users` и т. д.; порты – `USERS_PORT`… из `.env` (3001–3004) |
| Миграции | накатываются при старте (`DB_MIGRATIONS_RUN=true`); вручную после сборки – `npm run migration:users` и т. д. |
| Сид | только после первого старта сервиса (миграции накатываются при старте). Локально после сборки – `npm run seed:users` / `seed:pets` / `seed:care` (файл `dist/apps/<сервис>/apps/<сервис>/src/seed.js`); в Docker образ кладёт `dist/apps/<сервис>` в `/app/dist`, поэтому – `docker compose exec users-service node dist/apps/users-service/src/seed.js` |
| OpenAPI своего сервиса | `npm run build:users && node scripts/export-openapi.js users-service` → `docs/openapi/users-service.json` |
| Swagger UI | `http://localhost:8080/docs/<users\|pets\|care\|notifications>` через nginx, локально – `http://localhost:<порт>/docs/<сервис>` |
| Ключи JWT | `npm run keys` → `secrets/jwt-*.pem` (папка в `.gitignore`) |

Перед коммитом: `npm run build`, `npm run lint`, `npm test` – зелёные.

## Правила кода (§14)

- Слои: контроллер → сервис → репозиторий TypeORM → сущность; вход и выход – только DTO с `class-validator` и `@ApiProperty`.
- Имена классов, полей и методов – как на диаграммах; там нет `Promise<>` и текущего пользователя, в коде он – `@CurrentUser() user: JwtUser`, id игрока – `user.sub`.
- Идентификаторы по-английски; комментарии короткие, по-русски и только там, где неочевидно «зачем».
- Ошибки – только `ProblemException` (`libs/common/src/errors`): свой `type` (например `insufficient-funds`), `title` и `detail` по-русски. Чужой объект – 404, не 403.
- Каждый метод в Swagger: `@ApiOperation`, успешный ответ со схемой, `@ApiProblems(...)` со всеми ошибками из таблицы §10. Добавил ошибку – добавь в `@ApiProblems` и в §10.
- Доступ: все методы закрыты глобальным `JwtAuthGuard`; открытые – `@Public()`, админские – `@Roles(Role.ADMIN)`; `@ApiBearerAuth(BEARER_AUTH)` на закрытых.
- id в пути – `@Param('id', ParseIdPipe)` (неверный UUID – 404).
- Схема БД – только миграциями: новый файл в `apps/<сервис>/migrations/` и в конец списка `migrations/index.ts`; `synchronize: false`.
- Связанные изменения – одной транзакцией (`dataSource.transaction`); события – только через `OutboxService.add(manager, createEnvelope(RoutingKey.X, payload))` в той же транзакции.
- Обработчик события – провайдер с `@EventConsumer()`, реализует `EventHandler`; все записи – через переданный `manager` (транзакция inbox), повтор `eventId` пропускается сам. Один ключ маршрутизации – один обработчик.
- Планировщики (`LifecycleScheduler.tick`, `CareActionRetrier.retryPending`) регистрируют свой интервал сами (`SchedulerRegistry` или `@Interval`); `ScheduleModule.forRoot()` уже есть в `AppModule`.
- Unit-тесты – рядом с кодом, `*.spec.ts`; у B обязательно `simulate` и `CareRules`.
- Ничего сверх стека §3.

## Документы

- Каждая сессия обновляет только свой `docs/openapi/<сервис>.json` (экспорт выше); склейку `docs/openapi/tamagotchi.json` делает E: `node scripts/export-openapi.js --merge-only`.
- Код отступил от `docs/architecture.md` – поправить architecture.md в том же коммите и записать «было → стало» в отчёт (по нему перерисуют диаграммы).

## Что осталось A–D

- **A (users):** `Argon2PasswordHasher`, `JwtTokenService.issue` (sub, role, jti, exp 60 мин), `AuthService` (регистрация: пользователь и `user.registered` в outbox одной транзакцией; 409 логин занят; 401 неверный пароль; выход – `TokenRevocationService.revoke`), `UsersService`.
- **B (pets):** `PetsService` (не больше 3 живых – 409, 404 на чужого), `Simulation.simulate` и unit-тесты, `LifecycleService.processDue` (FOR UPDATE SKIP LOCKED, outbox) и `timeTravel` (403 без `DEMO_MODE`), `LifecycleScheduler` с интервалом `TICK_MS`, `CareRules.applyCare`, `PetCareService` (идемпотентность по `applied_care_actions`, `RpcException` с кодами §5), `imageUrl` формы из `SILO_PUBLIC_URL`; картинки форм в Silo.
- **C (care):** `ItemsService` с `ItemCatalogCache` и `IconStorage`, `WalletService`, `InventoryService`, `ShopService` (одна транзакция, 409 нет монет), сага `CareActionsService` с `PetCareClient.apply` (политика cockatiel готова, маппинг кодов gRPC → 404/409/503), `CareActionRetrier` (30 с), `StarterKitHandler`, `EvolutionRewardHandler`.
- **D (notifications):** `NotificationsService` (курсор по `created_at, id`, настройки), `NotificationStream` (SSE), `NotificationTexts`, `WelcomeHandler`, `PetEventsHandler`.
