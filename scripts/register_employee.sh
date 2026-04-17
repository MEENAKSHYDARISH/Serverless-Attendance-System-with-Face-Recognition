#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 6 ]]; then
  echo "Usage: $0 <api-url> <id-token> <employee-id> <email> <password> <s3-key>"
  exit 1
fi

API_URL="$1"
ID_TOKEN="$2"
EMPLOYEE_ID="$3"
EMAIL="$4"
PASSWORD="$5"
S3_KEY="$6"

curl -X POST "${API_URL}/admin/register-employee" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"employee_id\":\"${EMPLOYEE_ID}\",\"name\":\"${EMPLOYEE_ID}\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"department\":\"General\",\"shift_start_local\":\"09:00:00\",\"s3_key\":\"${S3_KEY}\"}"
