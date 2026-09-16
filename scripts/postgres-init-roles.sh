#!/bin/sh
# Runs once, inside the postgres container, on first initialisation
# (mounted into /docker-entrypoint-initdb.d by docker-compose.yml).
#
# Creates the two least-privileged login roles. Passwords come from the
# environment; nothing is hard-coded. Table-level grants are applied later by
# `npm run db:migrate`, once the tables exist.
set -eu

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"
: "${POSTGRES_ANALYTICS_USER:?POSTGRES_ANALYTICS_USER is required}"
: "${POSTGRES_ANALYTICS_PASSWORD:?POSTGRES_ANALYTICS_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$POSTGRES_APP_USER" -v app_pw="$POSTGRES_APP_PASSWORD" \
  -v an_user="$POSTGRES_ANALYTICS_USER" -v an_pw="$POSTGRES_ANALYTICS_PASSWORD" \
  -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE :"an_user"  LOGIN PASSWORD :'an_pw'  NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO :"app_user", :"an_user";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_user", :"an_user";
SQL
