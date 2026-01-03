#!/bin/bash

BASE_URL="${BASE_URL:-http://13.48.56.175:3000/api}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="testteacher${TIMESTAMP}@test.com"
TEST_PASSWORD="Test123!Pass"

echo "Creating test teacher account..."
echo "Email: $TEST_EMAIL"

RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"role\": \"teacher\",
    \"displayName\": \"Test Teacher\"
  }")

echo "$RESPONSE" | jq '.'

SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
  echo ""
  echo "✅ Teacher created successfully!"
  echo ""
  echo "Run the competency test with:"
  echo "TEST_EMAIL='$TEST_EMAIL' TEST_PASSWORD='$TEST_PASSWORD' bash test-competency-learning-flow.sh"
  echo ""
  echo "Or export these for future use:"
  echo "export TEST_EMAIL='$TEST_EMAIL'"
  echo "export TEST_PASSWORD='$TEST_PASSWORD'"
else
  echo ""
  echo "❌ Failed to create teacher"
  exit 1
fi
