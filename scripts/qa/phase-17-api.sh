#!/usr/bin/env bash
# scripts/qa/phase-17-api.sh

set -Eeuo pipefail

ENV_FILE="${PHASE17_ENV_FILE:-scripts/qa/.local/phase-17.env}"

if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

API_ORIGIN="${QA_API_ORIGIN:-http://localhost:10000}"
API_ORIGIN="${API_ORIGIN%/}"
API_BASE_URL="${QA_API_BASE_URL:-${API_ORIGIN}/api}"
API_BASE_URL="${API_BASE_URL%/}"
PLATFORM_IDENTIFIER="${QA_PLATFORM_IDENTIFIER:-}"
PLATFORM_PASSWORD="${QA_PLATFORM_PASSWORD:-}"
CONFIRMATION="${QA_CONFIRMATION:-}"
ALLOW_REMOTE="${QA_ALLOW_REMOTE:-false}"
KEEP_FIXTURES="${QA_KEEP_FIXTURES:-false}"
EXPECTED_CONFIRMATION="RUN_CHOIR_PHASE_17_TESTS"
RUN_ID="$(date +%y%m%d%H%M%S)-$$"
RUN_KEY="$(printf '%s' "$RUN_ID" | tr -d '-')"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/choirs-phase17.XXXXXX")"
RESPONSE_BODY="$WORK_DIR/response.json"
RESPONSE_HEADERS="$WORK_DIR/response.headers"
STATE_FILE="$WORK_DIR/phase-17-state.json"
PLATFORM_SESSION="$WORK_DIR/platform-session.json"
CHOIR_A_ID=""
CHOIR_B_ID=""
CHOIR_A_CODE="qa-a-${RUN_ID}"
CHOIR_B_CODE="qa-b-${RUN_ID}"
TOTAL_TESTS=0
PASSED_TESTS=0

RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
PURPLE='\033[35m'

print_header() {
    printf '\n%b%s%b\n' "$BOLD$PURPLE" "$1" "$RESET"
}

print_info() {
    printf '%bℹ%b %s\n' "$YELLOW" "$RESET" "$1"
}

print_pass() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    PASSED_TESTS=$((PASSED_TESTS + 1))
    printf '%b✓%b %s\n' "$GREEN" "$RESET" "$1"
}

fail() {
    printf '%b✗ %s%b\n' "$RED" "$1" "$RESET" >&2

    if [[ -s "$RESPONSE_BODY" ]]; then
        jq 'del(.accessToken, .refreshToken, .sessionId)' "$RESPONSE_BODY" 2>/dev/null || cat "$RESPONSE_BODY" >&2
    fi

    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Falta el comando requerido: $1"
}

require_value() {
    local name="$1"
    local value="$2"

    [[ -n "$value" ]] || fail "Falta la variable requerida: $name"
}

is_local_origin() {
    [[ "$API_ORIGIN" == http://localhost:* ]] ||
        [[ "$API_ORIGIN" == https://localhost:* ]] ||
        [[ "$API_ORIGIN" == http://127.0.0.1:* ]] ||
        [[ "$API_ORIGIN" == https://127.0.0.1:* ]]
}

api_request() {
    local method="$1"
    local path="$2"
    local token="${3:-}"
    local target_choir_id="${4:-}"
    local body="${5:-}"
    local conditional_etag="${6:-}"
    local curl_args=(
        -sS
        -X "$method"
        -D "$RESPONSE_HEADERS"
        -o "$RESPONSE_BODY"
        -w '%{http_code}'
        -H 'Accept: application/json'
        -H 'x-device-id: phase-17-curl-jq'
    )

    : > "$RESPONSE_BODY"
    : > "$RESPONSE_HEADERS"

    if [[ -n "$token" ]]; then
        curl_args+=( -H "Authorization: Bearer $token" )
    fi

    if [[ -n "$target_choir_id" ]]; then
        curl_args+=( -H "x-target-choir-id: $target_choir_id" )
    fi

    if [[ -n "$conditional_etag" ]]; then
        curl_args+=( -H "If-None-Match: $conditional_etag" )
    fi

    if [[ -n "$body" ]]; then
        curl_args+=( -H 'Content-Type: application/json' --data "$body" )
    fi

    HTTP_STATUS="$(curl "${curl_args[@]}" "${API_BASE_URL}${path}")"
}

expect_status() {
    local label="$1"
    shift
    local expected

    for expected in "$@"; do
        if [[ "$HTTP_STATUS" == "$expected" ]]; then
            print_pass "$label (HTTP $HTTP_STATUS)"
            return
        fi
    done

    fail "$label: se esperaba HTTP $*, pero se recibió HTTP $HTTP_STATUS"
}

expect_error_code() {
    local expected_code="$1"
    local actual_code
    actual_code="$(jq -r '.code // empty' "$RESPONSE_BODY")"

    [[ "$actual_code" == "$expected_code" ]] ||
        fail "Se esperaba code=$expected_code, pero se recibió code=${actual_code:-vacío}"
}

expect_jq() {
    local label="$1"
    local filter="$2"

    jq -e "$filter" "$RESPONSE_BODY" >/dev/null || fail "$label"
    print_pass "$label"
}

session_access_token() {
    jq -r '.accessToken' "$1"
}

session_refresh_token() {
    jq -r '.refreshToken' "$1"
}

login_platform() {
    local payload
    payload="$(jq -n \
        --arg identifier "$PLATFORM_IDENTIFIER" \
        --arg password "$PLATFORM_PASSWORD" \
        '{identifier: $identifier, password: $password}')"

    api_request POST '/auth/platform-login' '' '' "$payload"
    expect_status 'Login de plataforma' 200
    expect_jq 'La cuenta autenticada es SUPER_ADMIN' '.user.role == "SUPER_ADMIN" and .user.choirId == null'
    cp "$RESPONSE_BODY" "$PLATFORM_SESSION"
}

create_choir() {
    local name="$1"
    local code="$2"
    local output_file="$3"
    local payload
    payload="$(jq -n \
        --arg name "$name" \
        --arg code "$code" \
        --arg description "Fixture automático de fase 17: $RUN_ID" \
        '{name: $name, code: $code, description: $description, isActive: true}')"

    api_request POST '/choirs' "$(session_access_token "$PLATFORM_SESSION")" '' "$payload"
    expect_status "Crear $name" 201
    cp "$RESPONSE_BODY" "$output_file"
}

create_user() {
    local choir_id="$1"
    local name="$2"
    local username="$3"
    local email="$4"
    local role="$5"
    local password="$6"
    local output_file="$7"
    local payload
    payload="$(jq -n \
        --arg name "$name" \
        --arg username "$username" \
        --arg email "$email" \
        --arg role "$role" \
        --arg temporaryPassword "$password" \
        '{
            name: $name,
            username: $username,
            email: $email,
            role: $role,
            temporaryPassword: $temporaryPassword
        }')"

    api_request POST '/users' "$(session_access_token "$PLATFORM_SESSION")" "$choir_id" "$payload"
    expect_status "Crear usuario $username" 201
    cp "$RESPONSE_BODY" "$output_file"
}

login_and_change_password() {
    local choir_code="$1"
    local identifier="$2"
    local temporary_password="$3"
    local final_password="$4"
    local output_file="$5"
    local login_payload
    local change_payload
    local initial_access

    login_payload="$(jq -n \
        --arg choirCode "$choir_code" \
        --arg identifier "$identifier" \
        --arg password "$temporary_password" \
        '{choirCode: $choirCode, identifier: $identifier, password: $password}')"

    api_request POST '/auth/login' '' '' "$login_payload"
    expect_status "Login tenant $identifier en $choir_code" 200
    jq -e '.requiresPasswordChange == true' "$RESPONSE_BODY" >/dev/null ||
        fail "El usuario nuevo $identifier no exigió cambio de contraseña"
    initial_access="$(jq -r '.accessToken' "$RESPONSE_BODY")"

    change_payload="$(jq -n \
        --arg currentPassword "$temporary_password" \
        --arg newPassword "$final_password" \
        '{currentPassword: $currentPassword, newPassword: $newPassword}')"

    api_request POST '/auth/change-password' "$initial_access" '' "$change_payload"
    expect_status "Cambio obligatorio de contraseña para $identifier" 200
    jq -e '.requiresPasswordChange == false' "$RESPONSE_BODY" >/dev/null ||
        fail "El cambio de contraseña no liberó la sesión de $identifier"
    cp "$RESPONSE_BODY" "$output_file"
}

login_existing_user() {
    local choir_code="$1"
    local identifier="$2"
    local password="$3"
    local output_file="$4"
    local payload
    payload="$(jq -n \
        --arg choirCode "$choir_code" \
        --arg identifier "$identifier" \
        --arg password "$password" \
        '{choirCode: $choirCode, identifier: $identifier, password: $password}')"

    api_request POST '/auth/login' '' '' "$payload"
    expect_status "Nuevo login de $identifier en $choir_code" 200
    cp "$RESPONSE_BODY" "$output_file"
}

cleanup_fixtures() {
    local platform_access

    if [[ "$KEEP_FIXTURES" == 'true' ]]; then
        mkdir -p scripts/qa/.local
        cp "$STATE_FILE" scripts/qa/.local/phase-17-state.json 2>/dev/null || true
        print_info 'QA_KEEP_FIXTURES=true: los coros QA permanecen activos.'
        print_info 'El estado local quedó en scripts/qa/.local/phase-17-state.json.'
        return
    fi

    if [[ ! -s "$PLATFORM_SESSION" ]]; then
        return
    fi

    platform_access="$(session_access_token "$PLATFORM_SESSION")"

    if [[ -n "$CHOIR_A_ID" ]]; then
        api_request DELETE "/choirs/$CHOIR_A_ID" "$platform_access" '' '' || true
    fi

    if [[ -n "$CHOIR_B_ID" ]]; then
        api_request DELETE "/choirs/$CHOIR_B_ID" "$platform_access" '' '' || true
    fi
}

finish() {
    local exit_code=$?

    cleanup_fixtures || true
    rm -rf "$WORK_DIR"

    if [[ $exit_code -ne 0 ]]; then
        exit "$exit_code"
    fi
}

trap finish EXIT

require_command curl
require_command jq
require_command node
require_value QA_PLATFORM_IDENTIFIER "$PLATFORM_IDENTIFIER"
require_value QA_PLATFORM_PASSWORD "$PLATFORM_PASSWORD"

[[ "$CONFIRMATION" == "$EXPECTED_CONFIRMATION" ]] ||
    fail "Define QA_CONFIRMATION=$EXPECTED_CONFIRMATION para confirmar la creación de fixtures QA."

if ! is_local_origin && [[ "$ALLOW_REMOTE" != 'true' ]]; then
    fail 'La suite rechaza URLs remotas por defecto. Usa staging y define QA_ALLOW_REMOTE=true.'
fi

print_header 'Fase 17 · Suite multi-coro con curl + jq'
print_info "API: $API_BASE_URL"
print_info "Run ID: $RUN_ID"

api_request GET '/auth/me' '' '' ''
expect_status 'El API responde y protege /auth/me' 401

login_platform
PLATFORM_ACCESS="$(session_access_token "$PLATFORM_SESSION")"

api_request GET '/users' "$PLATFORM_ACCESS" '' ''
expect_status 'SUPER_ADMIN no puede operar tenant sin coro objetivo' 400
expect_error_code 'TARGET_CHOIR_REQUIRED'
print_pass 'El API exige x-target-choir-id a SUPER_ADMIN'

CHOIR_A_FILE="$WORK_DIR/choir-a.json"
CHOIR_B_FILE="$WORK_DIR/choir-b.json"
create_choir 'QA Choir A' "$CHOIR_A_CODE" "$CHOIR_A_FILE"
create_choir 'QA Choir B' "$CHOIR_B_CODE" "$CHOIR_B_FILE"
CHOIR_A_ID="$(jq -r '.id // ._id' "$CHOIR_A_FILE")"
CHOIR_B_ID="$(jq -r '.id // ._id' "$CHOIR_B_FILE")"

[[ -n "$CHOIR_A_ID" && "$CHOIR_A_ID" != 'null' ]] || fail 'No se pudo leer el ID del Coro A'
[[ -n "$CHOIR_B_ID" && "$CHOIR_B_ID" != 'null' ]] || fail 'No se pudo leer el ID del Coro B'

TEMP_PASSWORD="QaTemp#2026${RUN_KEY}!"
FINAL_PASSWORD="QaReady#2026${RUN_KEY}!"
SHARED_USERNAME="shared-${RUN_KEY}"
SHARED_EMAIL="shared-${RUN_KEY}@qa.example"

ADMIN_A_USER="$WORK_DIR/admin-a-user.json"
ADMIN_B_USER="$WORK_DIR/admin-b-user.json"
EDITOR_A_USER="$WORK_DIR/editor-a-user.json"
VIEWER_A_USER="$WORK_DIR/viewer-a-user.json"
VIEWER_B_USER="$WORK_DIR/viewer-b-user.json"
MUTABLE_A_USER="$WORK_DIR/mutable-a-user.json"
DELETE_A_USER="$WORK_DIR/delete-a-user.json"

create_user "$CHOIR_A_ID" 'QA Admin A' "$SHARED_USERNAME" "$SHARED_EMAIL" 'ADMIN' "$TEMP_PASSWORD" "$ADMIN_A_USER"
create_user "$CHOIR_B_ID" 'QA Admin B' "$SHARED_USERNAME" "$SHARED_EMAIL" 'ADMIN' "$TEMP_PASSWORD" "$ADMIN_B_USER"
print_pass 'Email y username iguales son válidos en coros diferentes'

create_user "$CHOIR_A_ID" 'QA Editor A' "editor-${RUN_KEY}" "editor-${RUN_KEY}@qa.example" 'EDITOR' "$TEMP_PASSWORD" "$EDITOR_A_USER"
create_user "$CHOIR_A_ID" 'QA Viewer A' "viewer-a-${RUN_KEY}" "viewer-a-${RUN_KEY}@qa.example" 'VIEWER' "$TEMP_PASSWORD" "$VIEWER_A_USER"
create_user "$CHOIR_B_ID" 'QA Viewer B' "viewer-b-${RUN_KEY}" "viewer-b-${RUN_KEY}@qa.example" 'VIEWER' "$TEMP_PASSWORD" "$VIEWER_B_USER"
create_user "$CHOIR_A_ID" 'QA Mutable A' "mutable-${RUN_KEY}" "mutable-${RUN_KEY}@qa.example" 'VIEWER' "$TEMP_PASSWORD" "$MUTABLE_A_USER"
create_user "$CHOIR_A_ID" 'QA Delete A' "delete-${RUN_KEY}" "delete-${RUN_KEY}@qa.example" 'VIEWER' "$TEMP_PASSWORD" "$DELETE_A_USER"

ADMIN_A_SESSION="$WORK_DIR/admin-a-session.json"
ADMIN_B_SESSION="$WORK_DIR/admin-b-session.json"
EDITOR_A_SESSION="$WORK_DIR/editor-a-session.json"
VIEWER_A_SESSION="$WORK_DIR/viewer-a-session.json"
VIEWER_B_SESSION="$WORK_DIR/viewer-b-session.json"
MUTABLE_A_SESSION="$WORK_DIR/mutable-a-session.json"
DELETE_A_SESSION="$WORK_DIR/delete-a-session.json"

login_and_change_password "$CHOIR_A_CODE" "$SHARED_USERNAME" "$TEMP_PASSWORD" "$FINAL_PASSWORD" "$ADMIN_A_SESSION"
login_and_change_password "$CHOIR_B_CODE" "$SHARED_USERNAME" "$TEMP_PASSWORD" "$FINAL_PASSWORD" "$ADMIN_B_SESSION"
login_and_change_password "$CHOIR_A_CODE" "editor-${RUN_KEY}" "$TEMP_PASSWORD" "$FINAL_PASSWORD" "$EDITOR_A_SESSION"
login_and_change_password "$CHOIR_A_CODE" "viewer-a-${RUN_KEY}" "$TEMP_PASSWORD" "$FINAL_PASSWORD" "$VIEWER_A_SESSION"
login_and_change_password "$CHOIR_B_CODE" "viewer-b-${RUN_KEY}" "$TEMP_PASSWORD" "$FINAL_PASSWORD" "$VIEWER_B_SESSION"
login_and_change_password "$CHOIR_A_CODE" "mutable-${RUN_KEY}" "$TEMP_PASSWORD" "$FINAL_PASSWORD" "$MUTABLE_A_SESSION"
login_and_change_password "$CHOIR_A_CODE" "delete-${RUN_KEY}" "$TEMP_PASSWORD" "$FINAL_PASSWORD" "$DELETE_A_SESSION"

ADMIN_A_ACCESS="$(session_access_token "$ADMIN_A_SESSION")"
ADMIN_B_ACCESS="$(session_access_token "$ADMIN_B_SESSION")"
EDITOR_A_ACCESS="$(session_access_token "$EDITOR_A_SESSION")"
VIEWER_A_ACCESS="$(session_access_token "$VIEWER_A_SESSION")"
VIEWER_B_ACCESS="$(session_access_token "$VIEWER_B_SESSION")"
MUTABLE_A_ACCESS="$(session_access_token "$MUTABLE_A_SESSION")"
DELETE_A_ACCESS="$(session_access_token "$DELETE_A_SESSION")"
MUTABLE_A_ID="$(jq -r '.user.id' "$MUTABLE_A_USER")"
DELETE_A_ID="$(jq -r '.user.id' "$DELETE_A_USER")"
ADMIN_A_ID="$(jq -r '.user.id' "$ADMIN_A_USER")"
ADMIN_B_ID="$(jq -r '.user.id' "$ADMIN_B_USER")"
VIEWER_B_ID="$(jq -r '.user.id' "$VIEWER_B_USER")"

api_request GET '/users?limit=100' "$PLATFORM_ACCESS" "$CHOIR_A_ID" ''
expect_status 'SUPER_ADMIN puede listar usuarios con target explícito' 200
jq -e --arg id "$ADMIN_B_ID" '[.users[].id] | index($id) == null' "$RESPONSE_BODY" >/dev/null ||
    fail 'La lista del Coro A incluyó un usuario del Coro B'
print_pass 'La lista target A no contiene usuarios del Coro B'

api_request GET '/users' "$ADMIN_A_ACCESS" "$CHOIR_B_ID" ''
expect_status 'ADMIN no puede seleccionar otro coro por header' 403
expect_error_code 'CROSS_CHOIR_ACCESS_DENIED'
print_pass 'El header tenant falsificado fue rechazado'

MISMATCH_PAYLOAD="$(jq -n \
    --arg choirId "$CHOIR_B_ID" \
    --arg name 'Cross Choir Attempt' \
    --arg username "cross-${RUN_KEY}" \
    --arg email "cross-${RUN_KEY}@qa.example" \
    --arg temporaryPassword "$TEMP_PASSWORD" \
    '{
        choirId: $choirId,
        name: $name,
        username: $username,
        email: $email,
        role: "VIEWER",
        temporaryPassword: $temporaryPassword
    }')"
api_request POST '/users' "$ADMIN_A_ACCESS" '' "$MISMATCH_PAYLOAD"
expect_status 'ADMIN no puede inyectar choirId en el body' 403
expect_error_code 'TENANT_SELECTOR_MISMATCH'
print_pass 'El selector tenant del body fue rechazado'

api_request GET "/users/$ADMIN_B_ID" "$ADMIN_A_ACCESS" '' ''
expect_status 'ADMIN A no puede leer un usuario de B' 404
expect_error_code 'USER_NOT_FOUND'
print_pass 'El ID válido de otro coro se oculta como no encontrado'

api_request GET '/users' "$EDITOR_A_ACCESS" '' ''
expect_status 'EDITOR no puede administrar usuarios' 403

VIEWER_ANNOUNCEMENT="$(jq -n \
    --arg title "Viewer forbidden $RUN_ID" \
    --arg content 'No debe guardarse' \
    '{title: $title, content: $content, isPublic: false}')"
api_request POST '/announcements' "$VIEWER_A_ACCESS" '' "$VIEWER_ANNOUNCEMENT"
expect_status 'VIEWER no puede crear anuncios' 403

ANNOUNCEMENT_A_PAYLOAD="$(jq -n \
    --arg title "QA Announcement A $RUN_ID" \
    --arg content 'Contenido público del Coro A' \
    '{title: $title, content: $content, isPublic: true}')"
api_request POST '/announcements' "$EDITOR_A_ACCESS" '' "$ANNOUNCEMENT_A_PAYLOAD"
expect_status 'EDITOR puede crear contenido en su coro' 201
ANNOUNCEMENT_A_ID="$(jq -r '.id // ._id' "$RESPONSE_BODY")"

ANNOUNCEMENT_B_PAYLOAD="$(jq -n \
    --arg title "QA Announcement B $RUN_ID" \
    --arg content 'Contenido público del Coro B' \
    '{title: $title, content: $content, isPublic: true}')"
api_request POST '/announcements' "$ADMIN_B_ACCESS" '' "$ANNOUNCEMENT_B_PAYLOAD"
expect_status 'ADMIN B puede crear contenido en su coro' 201
ANNOUNCEMENT_B_ID="$(jq -r '.id // ._id' "$RESPONSE_BODY")"

api_request GET "/announcements/$ANNOUNCEMENT_A_ID" "$ADMIN_B_ACCESS" '' ''
expect_status 'Usuario B no puede leer anuncio A por ID' 404
expect_error_code 'ANNOUNCEMENT_NOT_FOUND'

api_request GET "/public/$CHOIR_A_CODE/announcements" '' '' ''
expect_status 'Endpoint público del Coro A' 200
jq -e --arg a "$ANNOUNCEMENT_A_ID" --arg b "$ANNOUNCEMENT_B_ID" \
    '([.[]._id | tostring] | index($a) != null) and ([.[]._id | tostring] | index($b) == null)' \
    "$RESPONSE_BODY" >/dev/null || fail 'El endpoint público A mezcló contenido del Coro B'
print_pass 'El endpoint público A está aislado'

api_request GET "/public/$CHOIR_B_CODE/announcements" '' '' ''
expect_status 'Endpoint público del Coro B' 200
jq -e --arg a "$ANNOUNCEMENT_A_ID" --arg b "$ANNOUNCEMENT_B_ID" \
    '([.[]._id | tostring] | index($b) != null) and ([.[]._id | tostring] | index($a) == null)' \
    "$RESPONSE_BODY" >/dev/null || fail 'El endpoint público B mezcló contenido del Coro A'
print_pass 'El endpoint público B está aislado'

api_request GET '/announcements' "$ADMIN_A_ACCESS" '' ''
expect_status 'Primera lectura cacheable de anuncios' 200
ETAG="$(awk 'BEGIN { IGNORECASE=1 } /^ETag:/ { sub(/\r$/, "", $2); print $2; exit }' "$RESPONSE_HEADERS")"
[[ -n "$ETAG" ]] || fail 'El API no devolvió ETag para anuncios'
api_request GET '/announcements' "$ADMIN_A_ACCESS" '' '' "$ETAG"
expect_status 'If-None-Match devuelve 304' 304

CHAT_A_PAYLOAD="$(jq -n \
    --arg content "QA chat A $RUN_ID" \
    '{content: $content, type: "TEXT"}')"
api_request POST '/chat' "$ADMIN_A_ACCESS" '' "$CHAT_A_PAYLOAD"
expect_status 'Crear mensaje de chat en A' 201
CHAT_A_ID="$(jq -r '.message.id // .message._id' "$RESPONSE_BODY")"

CROSS_REPLY_PAYLOAD="$(jq -n \
    --arg content "Cross reply $RUN_ID" \
    --arg replyTo "$CHAT_A_ID" \
    '{content: $content, type: "TEXT", replyTo: $replyTo}')"
api_request POST '/chat' "$ADMIN_B_ACCESS" '' "$CROSS_REPLY_PAYLOAD"
expect_status 'Reply de B a mensaje A es rechazado' 404
expect_error_code 'TENANT_RELATION_NOT_FOUND'

REACTION_PAYLOAD='{"emoji":"👍"}'
api_request PATCH "/chat/$CHAT_A_ID/reaction" "$ADMIN_B_ACCESS" '' "$REACTION_PAYLOAD"
expect_status 'Reacción de B a mensaje A es rechazada' 404
expect_error_code 'CHAT_MESSAGE_NOT_FOUND'

jq -n \
    --arg apiOrigin "$API_ORIGIN" \
    --arg apiBaseUrl "$API_BASE_URL" \
    --arg choirAId "$CHOIR_A_ID" \
    --arg choirBId "$CHOIR_B_ID" \
    --arg choirACode "$CHOIR_A_CODE" \
    --arg choirBCode "$CHOIR_B_CODE" \
    --arg platformAccessToken "$PLATFORM_ACCESS" \
    --arg adminAAccessToken "$ADMIN_A_ACCESS" \
    --arg viewerAAccessToken "$VIEWER_A_ACCESS" \
    --arg adminBAccessToken "$ADMIN_B_ACCESS" \
    --arg sharedIdentifier "$SHARED_USERNAME" \
    --arg finalPassword "$FINAL_PASSWORD" \
    '{
        apiOrigin: $apiOrigin,
        apiBaseUrl: $apiBaseUrl,
        choirAId: $choirAId,
        choirBId: $choirBId,
        choirACode: $choirACode,
        choirBCode: $choirBCode,
        platformAccessToken: $platformAccessToken,
        adminAAccessToken: $adminAAccessToken,
        viewerAAccessToken: $viewerAAccessToken,
        adminBAccessToken: $adminBAccessToken,
        sharedIdentifier: $sharedIdentifier,
        finalPassword: $finalPassword
    }' > "$STATE_FILE"

print_header 'Fase 17 · Socket.IO'
node scripts/qa/phase-17-socket.mjs "$STATE_FILE"
print_pass 'La suite Socket.IO terminó correctamente'

ROLE_CHANGE_PAYLOAD='{"role":"EDITOR"}'
api_request PUT "/users/$MUTABLE_A_ID" "$PLATFORM_ACCESS" "$CHOIR_A_ID" "$ROLE_CHANGE_PAYLOAD"
expect_status 'SUPER_ADMIN cambia VIEWER a EDITOR' 200
expect_jq 'El cambio de rol revocó sesiones' '.sessionsRevoked == true and .user.role == "EDITOR"'

api_request GET '/auth/me' "$MUTABLE_A_ACCESS" '' ''
expect_status 'Token anterior queda revocado después del cambio de rol' 401
expect_error_code 'SESSION_REVOKED'

MUTABLE_NEW_SESSION="$WORK_DIR/mutable-a-new-session.json"
login_existing_user "$CHOIR_A_CODE" "mutable-${RUN_KEY}" "$FINAL_PASSWORD" "$MUTABLE_NEW_SESSION"
expect_jq 'El nuevo token refleja el rol EDITOR' '.user.role == "EDITOR"'
MUTABLE_NEW_ACCESS="$(session_access_token "$MUTABLE_NEW_SESSION")"

MUTABLE_ANNOUNCEMENT="$(jq -n \
    --arg title "Role changed $RUN_ID" \
    --arg content 'El nuevo EDITOR puede crear contenido' \
    '{title: $title, content: $content, isPublic: false}')"
api_request POST '/announcements' "$MUTABLE_NEW_ACCESS" '' "$MUTABLE_ANNOUNCEMENT"
expect_status 'El nuevo EDITOR puede crear contenido' 201

SUSPEND_PAYLOAD='{"isActive":false}'
api_request PATCH "/users/$VIEWER_B_ID/status" "$PLATFORM_ACCESS" "$CHOIR_B_ID" "$SUSPEND_PAYLOAD"
expect_status 'Suspender usuario del Coro B' 200

api_request GET '/auth/me' "$VIEWER_B_ACCESS" '' ''
expect_status 'Token de usuario suspendido queda revocado' 401
expect_error_code 'SESSION_REVOKED'

SUSPENDED_LOGIN="$(jq -n \
    --arg choirCode "$CHOIR_B_CODE" \
    --arg identifier "viewer-b-${RUN_KEY}" \
    --arg password "$FINAL_PASSWORD" \
    '{choirCode: $choirCode, identifier: $identifier, password: $password}')"
api_request POST '/auth/login' '' '' "$SUSPENDED_LOGIN"
expect_status 'Usuario suspendido no puede iniciar sesión' 403
expect_error_code 'USER_INACTIVE'

api_request PATCH "/users/$ADMIN_A_ID/status" "$PLATFORM_ACCESS" "$CHOIR_A_ID" "$SUSPEND_PAYLOAD"
expect_status 'No se puede suspender al último ADMIN activo' 409
expect_error_code 'LAST_ACTIVE_ADMIN_REQUIRED'

api_request DELETE "/users/$DELETE_A_ID" "$PLATFORM_ACCESS" "$CHOIR_A_ID" ''
expect_status 'Eliminar usuario tenant' 200

api_request GET '/auth/me' "$DELETE_A_ACCESS" '' ''
expect_status 'Token de usuario eliminado deja de funcionar' 401

DELETED_LOGIN="$(jq -n \
    --arg choirCode "$CHOIR_A_CODE" \
    --arg identifier "delete-${RUN_KEY}" \
    --arg password "$FINAL_PASSWORD" \
    '{choirCode: $choirCode, identifier: $identifier, password: $password}')"
api_request POST '/auth/login' '' '' "$DELETED_LOGIN"
expect_status 'Usuario eliminado no puede iniciar sesión' 401
expect_error_code 'INVALID_CREDENTIALS'

api_request DELETE "/choirs/$CHOIR_B_ID" "$PLATFORM_ACCESS" '' ''
expect_status 'Desactivar Coro B' 200

api_request GET '/auth/me' "$ADMIN_B_ACCESS" '' ''
expect_status 'Sesión tenant falla cuando el coro está inactivo' 403
expect_error_code 'CHOIR_INACTIVE'

INACTIVE_CHOIR_LOGIN="$(jq -n \
    --arg choirCode "$CHOIR_B_CODE" \
    --arg identifier "$SHARED_USERNAME" \
    --arg password "$FINAL_PASSWORD" \
    '{choirCode: $choirCode, identifier: $identifier, password: $password}')"
api_request POST '/auth/login' '' '' "$INACTIVE_CHOIR_LOGIN"
expect_status 'Login falla cuando el coro está inactivo' 401
expect_error_code 'INVALID_CREDENTIALS'

api_request PUT "/choirs/$CHOIR_B_ID" "$PLATFORM_ACCESS" '' '{"isActive":true}'
expect_status 'Reactivar Coro B' 200

api_request GET "/logs/platform?limit=100&choirId=$CHOIR_A_ID" "$PLATFORM_ACCESS" '' ''
expect_status 'SUPER_ADMIN consulta auditoría global filtrada' 200
jq -e '[.logs[].operation] | index("user.role_change") != null' "$RESPONSE_BODY" >/dev/null ||
    fail 'La auditoría no registró user.role_change'
print_pass 'La auditoría contiene el cambio de rol'

api_request GET '/logs?limit=100' "$ADMIN_A_ACCESS" '' ''
expect_status 'ADMIN consulta auditoría de su coro' 200
jq -e --arg choir "$CHOIR_A_ID" 'all(.logs[]; .targetChoirId == $choir)' "$RESPONSE_BODY" >/dev/null ||
    fail 'La auditoría tenant devolvió registros de otro coro'
print_pass 'La auditoría tenant está aislada'

api_request GET '/logs' "$VIEWER_A_ACCESS" '' ''
expect_status 'VIEWER no puede consultar auditoría' 403

ADMIN_A_REFRESH="$(session_refresh_token "$ADMIN_A_SESSION")"
LOGOUT_PAYLOAD="$(jq -n --arg refreshToken "$ADMIN_A_REFRESH" '{refreshToken: $refreshToken, deviceId: "phase-17-curl-jq"}')"
api_request POST '/auth/logout' "$ADMIN_A_ACCESS" '' "$LOGOUT_PAYLOAD"
expect_status 'Logout revoca la sesión' 200

REFRESH_PAYLOAD="$(jq -n --arg refreshToken "$ADMIN_A_REFRESH" '{refreshToken: $refreshToken}')"
api_request POST '/auth/refresh' '' '' "$REFRESH_PAYLOAD"
expect_status 'Refresh token no puede reutilizarse después de logout' 401
expect_error_code 'REFRESH_TOKEN_REVOKED'

print_header 'Resultado'
printf '%b%d/%d pruebas aprobadas%b\n' "$BOLD$GREEN" "$PASSED_TESTS" "$TOTAL_TESTS" "$RESET"
print_info 'Los fixtures se desactivarán automáticamente salvo que QA_KEEP_FIXTURES=true.'
