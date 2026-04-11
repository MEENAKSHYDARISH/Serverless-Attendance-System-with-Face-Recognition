#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <api-url> <id-token> <employee-id> <s3-key>"
  exit 1
fi

API_URL="$1"
ID_TOKEN="$2"
EMPLOYEE_ID="$3"
S3_KEY="$4"

curl -X POST "${API_URL}/admin/register-employee" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"employee_id\":\"${EMPLOYEE_ID}\",\"name\":\"${EMPLOYEE_ID}\",\"department\":\"General\",\"shift_start_local\":\"09:00:00\",\"s3_key\":\"${S3_KEY}\"}"
