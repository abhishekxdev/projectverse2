#!/bin/bash
TS=$(date +%s)
EMAIL="teacher${TS}@test.dev"
PASS="Simple123"
curl -s -X POST "http://13.48.56.175:3000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"role\":\"teacher\",\"displayName\":\"Test Teacher\"}" | jq '. | {success, email: .data.user.email}'
echo ""
echo "Email: $EMAIL"
echo "Pass: $PASS"
echo ""
echo "export TEST_EMAIL='$EMAIL'"
echo "export TEST_PASSWORD='$PASS'"
