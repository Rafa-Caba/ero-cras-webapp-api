#!/usr/bin/env bash
# scripts/qa/production-fixes-media.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/scripts/qa/.local/production-fixes.env}"
TEMP_DIR=""
BLOG_ID=""
ANNOUNCEMENT_ID=""
TEMP_USER_ID=""

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta el archivo local: $ENV_FILE" >&2
  echo "Copia scripts/qa/production-fixes.env.example y completa las credenciales." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

require_value() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "La variable $name es obligatoria." >&2
    exit 1
  fi
}

for required in API_BASE_URL CHOIR_CODE TENANT_IDENTIFIER TENANT_PASSWORD; do
  require_value "$required"
done

if [[ "$API_BASE_URL" == https://* && "${ALLOW_REMOTE_QA:-false}" != "true" ]]; then
  echo "La suite remota está bloqueada. Configura ALLOW_REMOTE_QA=true conscientemente." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq es obligatorio. En macOS: brew install jq" >&2
  exit 1
fi

TEMP_DIR="$(mktemp -d)"
cleanup() {
  if [[ -n "$BLOG_ID" ]]; then
    curl -sS -X DELETE "$API_BASE_URL/blog/$BLOG_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null || true
  fi
  if [[ -n "$ANNOUNCEMENT_ID" ]]; then
    curl -sS -X DELETE "$API_BASE_URL/announcements/$ANNOUNCEMENT_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null || true
  fi
  if [[ -n "$TEMP_USER_ID" ]]; then
    curl -sS -X DELETE "$API_BASE_URL/users/$TEMP_USER_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null || true
  fi
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

if [[ -n "${MEDIA_FILE:-}" ]]; then
  TEST_IMAGE="$MEDIA_FILE"
else
  TEST_IMAGE="$TEMP_DIR/qa-image.png"
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=' \
    | openssl base64 -d -A > "$TEST_IMAGE"
fi

if [[ ! -s "$TEST_IMAGE" ]]; then
  echo "El archivo de prueba no existe o está vacío: $TEST_IMAGE" >&2
  exit 1
fi

echo "== Login tenant =="
LOGIN_RESPONSE="$(curl -sS -f \
  -X POST "$API_BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg choirCode "$CHOIR_CODE" \
    --arg identifier "$TENANT_IDENTIFIER" \
    --arg password "$TENANT_PASSWORD" \
    '{choirCode: $choirCode, identifier: $identifier, password: $password}')")"
ACCESS_TOKEN="$(jq -r '.accessToken' <<<"$LOGIN_RESPONSE")"
TENANT_ROLE="$(jq -r '.user.role' <<<"$LOGIN_RESPONSE")"
jq '{user: .user | {id, username, role, choirId}, choir: .choir | {id, name, code}}' <<<"$LOGIN_RESPONSE"

STAMP="$(date +%s)"
BLOG_DATA="$(jq -nc \
  --arg title "QA media blog $STAMP" \
  '{title: $title, content: {type: "doc", content: [{type: "paragraph", content: [{type: "text", text: "Prueba automática de imagen"}]}]}, isPublic: false}')"
ANNOUNCEMENT_DATA="$(jq -nc \
  --arg title "QA media announcement $STAMP" \
  '{title: $title, content: {type: "doc", content: [{type: "paragraph", content: [{type: "text", text: "Prueba automática de imagen"}]}]}, isPublic: false}')"


if [[ "$TENANT_ROLE" == "ADMIN" ]]; then
  echo "== Usuario temporal con foto =="
  TEMP_USERNAME="qa_media_$STAMP"
  TEMP_EMAIL="$TEMP_USERNAME@example.invalid"
  TEMP_PASSWORD="QaMedia#${STAMP}Aa1"
  USER_DATA="$(jq -nc \
    --arg name "QA Media User $STAMP" \
    --arg username "$TEMP_USERNAME" \
    --arg email "$TEMP_EMAIL" \
    --arg temporaryPassword "$TEMP_PASSWORD" \
    '{name: $name, username: $username, email: $email, role: "VIEWER", temporaryPassword: $temporaryPassword, instrumentLabel: "QA", bio: "Prueba temporal de carga", voice: false}')"
  USER_RESPONSE="$(curl -sS -f \
    -X POST "$API_BASE_URL/users" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -F "data=$USER_DATA" \
    -F "file=@$TEST_IMAGE;type=image/png;filename=qa-profile.png")"
  TEMP_USER_ID="$(jq -r '.user.id // .user._id' <<<"$USER_RESPONSE")"
  jq '{user: .user | {id, username, role, imageUrl}}' <<<"$USER_RESPONSE"
  test -n "$(jq -r '.user.imageUrl // empty' <<<"$USER_RESPONSE")"
else
  echo "↷ Se omite usuario con foto: la cuenta de QA no tiene rol ADMIN."
fi

echo "== Blog con imagen =="
BLOG_RESPONSE="$(curl -sS -f \
  -X POST "$API_BASE_URL/blog" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "data=$BLOG_DATA" \
  -F "file=@$TEST_IMAGE;type=image/png;filename=qa-blog.png")"
BLOG_ID="$(jq -r '.id // ._id' <<<"$BLOG_RESPONSE")"
jq '{id: (.id // ._id), title, imageUrl}' <<<"$BLOG_RESPONSE"
test -n "$(jq -r '.imageUrl // empty' <<<"$BLOG_RESPONSE")"

echo "== Aviso con imagen =="
ANNOUNCEMENT_RESPONSE="$(curl -sS -f \
  -X POST "$API_BASE_URL/announcements" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "data=$ANNOUNCEMENT_DATA" \
  -F "file=@$TEST_IMAGE;type=image/png;filename=qa-announcement.png")"
ANNOUNCEMENT_ID="$(jq -r '.id // ._id' <<<"$ANNOUNCEMENT_RESPONSE")"
jq '{id: (.id // ._id), title, imageUrl}' <<<"$ANNOUNCEMENT_RESPONSE"
test -n "$(jq -r '.imageUrl // empty' <<<"$ANNOUNCEMENT_RESPONSE")"

echo "✓ API, Multer y Cloudinary aceptaron archivos no vacíos correctamente."
