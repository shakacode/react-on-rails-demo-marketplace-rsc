#!/bin/sh
set -e

echo "-- Starting entrypoint.sh"
echo "-- Container image: ${CPLN_IMAGE:-local}"

# Wait for database to be reachable (if DATABASE_URL is set)
if [ -n "$DATABASE_URL" ]; then
  # Extract host and port from DATABASE_URL
  # Handles both postgres://user:pass@host:port/db and postgres://user:pass@host/db
  DB_HOSTPORT=$(echo "$DATABASE_URL" | sed -e 's|^.*@||' -e 's|/.*$||')
  case "$DB_HOSTPORT" in
    *:*)
      DB_HOST=$(echo "$DB_HOSTPORT" | sed 's|:.*||')
      DB_PORT=$(echo "$DB_HOSTPORT" | sed 's|.*:||')
      ;;
    *)
      DB_HOST="$DB_HOSTPORT"
      DB_PORT=5432
      ;;
  esac

  echo "-- Waiting for database at $DB_HOST:$DB_PORT..."
  SECONDS_WAITED=0
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; do
    if [ "$SECONDS_WAITED" -ge 180 ]; then
      echo "-- ERROR: Database not available after 3 minutes, exiting"
      exit 1
    fi
    if [ "$((SECONDS_WAITED % 10))" -eq 0 ] && [ "$SECONDS_WAITED" -gt 0 ]; then
      echo "-- Retrying... (${SECONDS_WAITED}s elapsed)"
    fi
    sleep 1
    SECONDS_WAITED=$((SECONDS_WAITED + 1))
  done
  echo "-- Database is available"
fi

echo "-- Finishing entrypoint.sh, executing: $@"
exec "$@"
