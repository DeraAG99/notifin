#!/bin/bash
set -e

DB="${OPENWA_DB:-openwa}"
USER="${OPENWA_USER:-${POSTGRES_USER:-notifin}}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE "$DB" OWNER "$USER"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB')\gexec
EOSQL
