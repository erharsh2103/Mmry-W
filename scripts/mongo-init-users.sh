#!/bin/sh
# Runs once, inside the mongo container, on first initialisation
# (mounted into /docker-entrypoint-initdb.d by docker-compose.yml).
#
# Creates a read/write user for the API and a read-only user for analytics.
# Passwords come from the environment; nothing is hard-coded.
set -eu

: "${MONGO_INITDB_DATABASE:?MONGO_INITDB_DATABASE is required}"
: "${MONGO_APP_USER:?MONGO_APP_USER is required}"
: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is required}"
: "${MONGO_ANALYTICS_USER:?MONGO_ANALYTICS_USER is required}"
: "${MONGO_ANALYTICS_PASSWORD:?MONGO_ANALYTICS_PASSWORD is required}"

mongosh --quiet \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  "$MONGO_INITDB_DATABASE" \
  --eval '
    const env = process.env;
    db.createUser({ user: env.MONGO_APP_USER, pwd: env.MONGO_APP_PASSWORD,
      roles: [{ role: "readWrite", db: env.MONGO_INITDB_DATABASE }] });
    db.createUser({ user: env.MONGO_ANALYTICS_USER, pwd: env.MONGO_ANALYTICS_PASSWORD,
      roles: [{ role: "read", db: env.MONGO_INITDB_DATABASE }] });
  '
