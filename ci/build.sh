#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${API_URL_SERVER:-}" ]]; then
    cat > src/environments/environment.ts <<ENV
export const environment = {
  production: true,
  apiUrlServer: '${API_URL_SERVER%/}',
  apiUrlBrowser: '/api',
  cognito: {
    domain: '${COGNITO_DOMAIN:?COGNITO_DOMAIN must be set}',
    clientId: '${COGNITO_CLIENT_ID:?COGNITO_CLIENT_ID must be set}',
  },
};
ENV
elif [[ "${REQUIRE_ENVIRONMENT:-false}" == true ]]; then
    echo "API_URL_SERVER, COGNITO_DOMAIN and COGNITO_CLIENT_ID must be set" >&2
    exit 1
fi

npx ng build --configuration production
