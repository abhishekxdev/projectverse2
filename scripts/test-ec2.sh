#!/bin/bash

# Quick test script for EC2 deployment
# Tests competency assessment flow against your EC2 instance

set -e

# EC2 Configuration
export BASE_URL="http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api"
export TEST_EMAIL="${TEST_EMAIL:-teacher@test.com}"
export TEST_PASSWORD="${TEST_PASSWORD:-password123}"

echo "🌍 Testing EC2 Deployment"
echo "=========================="
echo "URL: $BASE_URL"
echo "Email: $TEST_EMAIL"
echo ""

# Test 1: Health Check
echo "1️⃣  Health Check..."
HEALTH=$(curl -s "$BASE_URL/health" || echo '{"status":"error"}')
STATUS=$(echo $HEALTH | jq -r '.status')

if [ "$STATUS" = "ok" ]; then
  echo "   ✅ Server is healthy"
else
  echo "   ❌ Server health check failed"
  echo "   Response: $HEALTH"
  exit 1
fi

# Test 2: Authentication
echo ""
echo "2️⃣  Authentication..."
AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" || echo '{}')

TOKEN=$(echo $AUTH_RESPONSE | jq -r '.data.idToken // empty')

if [ -n "$TOKEN" ]; then
  echo "   ✅ Authentication successful"
else
  echo "   ⚠️  Login failed - trying signup..."
  
  # Try signup
  SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\":\"$TEST_EMAIL\",
      \"password\":\"$TEST_PASSWORD\",
      \"role\":\"teacher\",
      \"displayName\":\"Test Teacher\"
    }" || echo '{}')
  
  TOKEN=$(echo $SIGNUP_RESPONSE | jq -r '.data.idToken // empty')
  
  if [ -n "$TOKEN" ]; then
    echo "   ✅ Signup successful"
  else
    echo "   ❌ Both login and signup failed"
    echo "   Response: $AUTH_RESPONSE"
    exit 1
  fi
fi

# Test 3: API Access
echo ""
echo "3️⃣  Testing API Access..."
QUESTIONS=$(curl -s -X GET "$BASE_URL/competency/questions" \
  -H "Authorization: Bearer $TOKEN" || echo '{}')

QUESTION_COUNT=$(echo $QUESTIONS | jq '.data | length // 0')

if [ "$QUESTION_COUNT" -gt 0 ]; then
  echo "   ✅ API access working ($QUESTION_COUNT questions found)"
else
  echo "   ⚠️  No questions found (may need seeding)"
fi

# Test 4: S3 Upload Check
echo ""
echo "4️⃣  Checking S3 Configuration..."
S3_TEST=$(curl -s -X POST "$BASE_URL/upload/presigned-url" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileType": "profile-photo",
    "fileName": "test.jpg",
    "contentType": "image/jpeg"
  }' || echo '{}')

UPLOAD_URL=$(echo $S3_TEST | jq -r '.data.uploadUrl // empty')

if [ -n "$UPLOAD_URL" ]; then
  echo "   ✅ S3 upload configured correctly"
else
  echo "   ⚠️  S3 not configured (file uploads disabled)"
fi

# Summary
echo ""
echo "================================"
echo "✅ EC2 Deployment Test Complete"
echo "================================"
echo ""
echo "Next steps:"
echo "  • Run full flow test: BASE_URL=$BASE_URL pnpm test:competency-flow"
echo "  • Run PD test: BASE_URL=$BASE_URL pnpm test:pd-flow"
echo "  • Access API docs: http://ec2-13-62-52-105.eu-north-1.compute.amazonaws.com/api/health"
