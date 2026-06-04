#!/bin/sh
set -e

echo "-- Starting entrypoint.sh"
echo "-- Container image: ${CPLN_IMAGE:-local}"

# Wait for database to be reachable (if DATABASE_URL is set)
if [ -n "${DATABASE_URL:-}" ]; then
  echo "-- Waiting for database..."
  SECONDS_WAITED=0
  DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-180}"
  DB_WAIT_REQUIRED="${DB_WAIT_REQUIRED:-false}"
  DB_READY="false"

  while :; do
    if pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
      DB_READY="true"
      break
    fi

    if [ "$SECONDS_WAITED" -ge "$DB_WAIT_TIMEOUT" ]; then
      echo "-- WARNING: Database probe still failing after ${DB_WAIT_TIMEOUT}s"
      echo "-- pg_isready: connection check failed"
      if [ "$DB_WAIT_REQUIRED" = "true" ]; then
        echo "-- ERROR: DB_WAIT_REQUIRED=true, exiting"
        exit 1
      fi
      echo "-- Continuing so the application command can handle database errors"
      break
    fi
    if [ "$((SECONDS_WAITED % 10))" -eq 0 ] && [ "$SECONDS_WAITED" -gt 0 ]; then
      echo "-- Retrying... (${SECONDS_WAITED}s elapsed)"
    fi
    sleep 1
    SECONDS_WAITED=$((SECONDS_WAITED + 1))
  done

  if [ "$DB_READY" = "true" ]; then
    echo "-- Database is available"
  fi
fi

echo "-- Finishing entrypoint.sh, executing: $@"
exec "$@"
