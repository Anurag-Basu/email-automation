#!/bin/sh
set -e
# Named volumes are often root-owned; app runs as nextjs — fix ownership at startup.
mkdir -p /app/.data
chown -R nextjs:nodejs /app/.data
exec su-exec nextjs "$@"
