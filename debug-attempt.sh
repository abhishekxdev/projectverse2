#!/bin/bash

BASE_URL="http://13.48.56.175:3000/api"
TEST_EMAIL="testteacher1767481230@test.com"
TEST_PASSWORD="Test123!Pass"

# Login
AUTH_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" | jq -r '.data.token')

echo "Token: ${AUTH_TOKEN:0:50}..."
echo ""

# Start attempt
echo "Starting attempt..."
curl -s -X POST "$BASE_URL/competency/attempts" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assessmentId":"tcdt-assessment-v1"}' | jq '.'
