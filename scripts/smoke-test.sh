#!/usr/bin/env bash
#
# Checks a running deployment from the outside: that the app is served, that
# the sync API refuses everyone without the token, and that optimistic
# concurrency actually rejects a stale write.
#
# Read-only unless --write is passed. With it the script PUTs a junk blob, so
# only use it against an empty store or a deployment you do not mind
# overwriting -- it will replace whatever is there.
#
#   BASE=https://todo.example.com SYNC_TOKEN=... scripts/smoke-test.sh
#   BASE=http://127.0.0.1:3000 SYNC_TOKEN=... scripts/smoke-test.sh --write
set -u

BASE="${BASE:-http://127.0.0.1:3000}"
TOKEN="${SYNC_TOKEN:-}"
WRITE=0
[ "${1:-}" = "--write" ] && WRITE=1

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@"; }
row() { printf '  %-26s %s\n' "$1" "$2"; }

AUTH="Authorization: Bearer $TOKEN"
JSON="Content-Type: application/json"
BODY='{"salt":"c2FsdA==","iv":"aXZpdml2aXZpdg==","ciphertext":"Y3Q="}'

echo "$BASE"
echo "reachable"
row "health" "$(code "$BASE/health")"
row "app" "$(code "$BASE/")"
row "manifest" "$(code "$BASE/manifest.webmanifest")"

echo "locked down (expect 401)"
row "GET no token" "$(code "$BASE/api/blob")"
row "GET wrong token" "$(code -H 'Authorization: Bearer wrong' "$BASE/api/blob")"

if [ -z "$TOKEN" ]; then
  echo
  echo "SYNC_TOKEN not set; skipping authenticated checks."
  echo "If the server has no token either, /api/blob should answer 503."
  exit 0
fi

echo "authenticated"
row "GET with token" "$(code -H "$AUTH" "$BASE/api/blob")   (404 = empty store)"

if [ "$WRITE" -eq 0 ]; then
  echo
  echo "Read-only. Pass --write to exercise PUT; it OVERWRITES the stored blob."
  exit 0
fi

echo "writes (this overwrites the stored blob)"
row "PUT without If-Match" "$(code -X PUT -H "$AUTH" -H "$JSON" -d "$BODY" "$BASE/api/blob")   (expect 428)"

V=$(curl -s -H "$AUTH" "$BASE/api/blob" | sed -n 's/.*"version":\([0-9]*\).*/\1/p')
V=${V:-0}
row "current version" "$V"
row "PUT at $V" "$(code -X PUT -H "$AUTH" -H "$JSON" -H "If-Match: $V" -d "$BODY" "$BASE/api/blob")   (expect 200)"
row "PUT at $V again" "$(code -X PUT -H "$AUTH" -H "$JSON" -H "If-Match: $V" -d "$BODY" "$BASE/api/blob")   (expect 412)"
row "PUT garbage body" "$(code -X PUT -H "$AUTH" -H "$JSON" -H "If-Match: 99" -d '{"nope":1}' "$BASE/api/blob")   (expect 400)"
