#!/bin/sh
# Четыре базы и четыре учётные записи (§7, §13): у каждого сервиса своя база и свой владелец.
# Выполняется образом postgres один раз – при первом запуске с пустым томом.
# Имена и пароли приходят из окружения контейнера postgres (docker-compose.yml ← .env).
set -eu

create_database() {
  db="$1"
  user="$2"
  password="$3"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v db="$db" -v usr="$user" -v pwd="$password" <<'SQL'
CREATE ROLE :"usr" LOGIN PASSWORD :'pwd';
CREATE DATABASE :"db" OWNER :"usr";
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
SQL
  echo "Создана база $db, владелец $user"
}

create_database "$USERS_DB_NAME" "$USERS_DB_USER" "$USERS_DB_PASSWORD"
create_database "$PETS_DB_NAME" "$PETS_DB_USER" "$PETS_DB_PASSWORD"
create_database "$CARE_DB_NAME" "$CARE_DB_USER" "$CARE_DB_PASSWORD"
create_database "$NOTIFICATIONS_DB_NAME" "$NOTIFICATIONS_DB_USER" "$NOTIFICATIONS_DB_PASSWORD"
