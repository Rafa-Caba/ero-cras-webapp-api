#!/usr/bin/env bash
# scripts/qa/platform-profile-context.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${SCRIPT_DIR}/.local/platform-profile-context.env"

if [[ -f "${LOCAL_ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${LOCAL_ENV_FILE}"
fi

API_BASE_URL="${API_BASE_URL:-http://localhost:10000/api}"
PLATFORM_IDENTIFIER="${PLATFORM_IDENTIFIER:-}"
PLATFORM_PASSWORD="${PLATFORM_PASSWORD:-}"
PREFERRED_CHOIR_ID="${PREFERRED_CHOIR_ID:-}"
ALLOW_REMOTE_QA="${ALLOW_REMOTE_QA:-false}"

require_command() {
    local command_name="$1"

    if ! command -v "${command_name}" >/dev/null 2>&1; then
        printf 'Falta el comando requerido: %s\n' "${command_name}" >&2
        exit 1
    fi
}

require_value() {
    local value="$1"
    local variable_name="$2"

    if [[ -z "${value}" ]]; then
        printf 'Configura %s en %s\n' "${variable_name}" "${LOCAL_ENV_FILE}" >&2
        exit 1
    fi
}

print_step() {
    printf '\n\033[1;35m%s\033[0m\n' "$1"
}

require_command curl
require_command jq
require_value "${PLATFORM_IDENTIFIER}" PLATFORM_IDENTIFIER
require_value "${PLATFORM_PASSWORD}" PLATFORM_PASSWORD

if [[ "${ALLOW_REMOTE_QA}" != "true" ]] && \
   [[ ! "${API_BASE_URL}" =~ ^http://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?(/|$) ]]; then
    printf 'La prueba rechaza APIs remotas por seguridad. Usa localhost o configura ALLOW_REMOTE_QA=true conscientemente.\n' >&2
    exit 1
fi

print_step '1. Inicio de sesión de plataforma'
LOGIN_RESPONSE="$(curl --fail-with-body --silent --show-error \
    --request POST "${API_BASE_URL}/auth/platform-login" \
    --header 'Content-Type: application/json' \
    --data "$(jq -n \
        --arg identifier "${PLATFORM_IDENTIFIER}" \
        --arg password "${PLATFORM_PASSWORD}" \
        '{identifier: $identifier, password: $password}')")"
ACCESS_TOKEN="$(jq -er '.accessToken' <<<"${LOGIN_RESPONSE}")"
jq '{user: .user, choir: .choir, requiresPasswordChange: .requiresPasswordChange}' <<<"${LOGIN_RESPONSE}"

AUTH_HEADER="Authorization: Bearer ${ACCESS_TOKEN}"

print_step '2. Lectura del perfil actual'
PROFILE_BEFORE="$(curl --fail-with-body --silent --show-error \
    "${API_BASE_URL}/users/me" \
    --header "${AUTH_HEADER}")"
ORIGINAL_PREFERRED_CHOIR_ID="$(jq -r '.user.preferredChoirId // ""' <<<"${PROFILE_BEFORE}")"
jq '.user | {id, username, role, choirId, preferredChoirId}' <<<"${PROFILE_BEFORE}"

print_step '3. Selección de un coro activo para la prueba'
CHOIRS_RESPONSE="$(curl --fail-with-body --silent --show-error \
    "${API_BASE_URL}/choirs?page=1" \
    --header "${AUTH_HEADER}")"

if [[ -z "${PREFERRED_CHOIR_ID}" ]]; then
    PREFERRED_CHOIR_ID="$(jq -er '.choirs[] | select(.isActive == true) | .id' <<<"${CHOIRS_RESPONSE}" | head -n 1)"
fi

SELECTED_CHOIR="$(jq -e \
    --arg choirId "${PREFERRED_CHOIR_ID}" \
    '.choirs[] | select(.id == $choirId and .isActive == true)' \
    <<<"${CHOIRS_RESPONSE}")"
jq '{id, name, code, isActive}' <<<"${SELECTED_CHOIR}"

restore_preference() {
    local restore_value='null'

    if [[ -n "${ORIGINAL_PREFERRED_CHOIR_ID}" ]]; then
        restore_value="$(jq -n --arg choirId "${ORIGINAL_PREFERRED_CHOIR_ID}" '$choirId')"
    fi

    curl --silent --show-error \
        --request PUT "${API_BASE_URL}/users/me" \
        --header "${AUTH_HEADER}" \
        --header 'Content-Type: application/json' \
        --data "{\"preferredChoirId\":${restore_value}}" \
        >/dev/null || true
}

trap restore_preference EXIT

print_step '4. Vinculación del coro predeterminado'
UPDATED_PROFILE="$(curl --fail-with-body --silent --show-error \
    --request PUT "${API_BASE_URL}/users/me" \
    --header "${AUTH_HEADER}" \
    --header 'Content-Type: application/json' \
    --data "$(jq -n --arg choirId "${PREFERRED_CHOIR_ID}" '{preferredChoirId: $choirId}')")"
jq '.user | {role, choirId, preferredChoirId}' <<<"${UPDATED_PROFILE}"

jq -e \
    --arg choirId "${PREFERRED_CHOIR_ID}" \
    '.user.role == "SUPER_ADMIN" and .user.choirId == null and .user.preferredChoirId == $choirId' \
    <<<"${UPDATED_PROFILE}" \
    >/dev/null

print_step '5. Operación tenant con coro objetivo explícito'
TENANT_USERS_RESPONSE="$(curl --fail-with-body --silent --show-error \
    "${API_BASE_URL}/users?page=1&limit=1" \
    --header "${AUTH_HEADER}" \
    --header "x-target-choir-id: ${PREFERRED_CHOIR_ID}")"
jq '{currentPage, totalPages, totalUsers, returnedUsers: (.users | length)}' <<<"${TENANT_USERS_RESPONSE}"

print_step '6. Desvinculación reversible'
UNLINKED_PROFILE="$(curl --fail-with-body --silent --show-error \
    --request PUT "${API_BASE_URL}/users/me" \
    --header "${AUTH_HEADER}" \
    --header 'Content-Type: application/json' \
    --data '{"preferredChoirId":null}')"
jq '.user | {role, choirId, preferredChoirId}' <<<"${UNLINKED_PROFILE}"

jq -e '.user.role == "SUPER_ADMIN" and .user.choirId == null and .user.preferredChoirId == null' \
    <<<"${UNLINKED_PROFILE}" \
    >/dev/null

trap - EXIT
restore_preference

print_step 'Prueba completada correctamente'
printf 'La cuenta permaneció global (choirId=null), el coro predeterminado fue reversible y el contexto tenant exigió x-target-choir-id.\n'
