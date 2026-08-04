#!/usr/bin/env bash
# scripts/qa/phase-18-api-preflight.sh

set -Eeuo pipefail

API_ORIGIN="${TESTFLIGHT_API_ORIGIN:-}"
CHOIR_CODE="${TESTFLIGHT_CHOIR_CODE:-}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/choirs-testflight-api.XXXXXX")"
BODY_FILE="$WORK_DIR/body.json"

cleanup() {
    rm -rf "$WORK_DIR"
}

trap cleanup EXIT

command -v curl >/dev/null 2>&1 || { echo 'Falta curl.' >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo 'Falta jq.' >&2; exit 1; }

[[ -n "$API_ORIGIN" ]] || { echo 'Define TESTFLIGHT_API_ORIGIN.' >&2; exit 1; }
API_ORIGIN="${API_ORIGIN%/}"

[[ "$API_ORIGIN" == https://* ]] || { echo 'TestFlight requiere una URL HTTPS del API.' >&2; exit 1; }
[[ "$API_ORIGIN" != *localhost* && "$API_ORIGIN" != *127.0.0.1* ]] || {
    echo 'TestFlight no puede usar localhost.' >&2
    exit 1
}

STATUS="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' "$API_ORIGIN/api/auth/me")"
[[ "$STATUS" == '401' ]] || {
    echo "El API respondió HTTP $STATUS en /api/auth/me." >&2
    jq . "$BODY_FILE" 2>/dev/null || cat "$BODY_FILE" >&2
    exit 1
}

jq -e '.code == "ACCESS_TOKEN_REQUIRED"' "$BODY_FILE" >/dev/null || {
    echo 'La respuesta protegida no tiene el contrato esperado.' >&2
    jq . "$BODY_FILE"
    exit 1
}

echo '✓ API HTTPS accesible y autenticación fail-closed confirmada.'

if [[ -n "$CHOIR_CODE" ]]; then
    STATUS="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' "$API_ORIGIN/api/public/$CHOIR_CODE/settings")"
    [[ "$STATUS" == '200' ]] || {
        echo "El endpoint público del coro respondió HTTP $STATUS." >&2
        jq . "$BODY_FILE" 2>/dev/null || cat "$BODY_FILE" >&2
        exit 1
    }

    jq -e --arg code "$CHOIR_CODE" '.choir.code == $code' "$BODY_FILE" >/dev/null || {
        echo 'El endpoint público devolvió otro choirCode.' >&2
        jq . "$BODY_FILE"
        exit 1
    }

    echo '✓ Contexto público del coro validado.'
fi
