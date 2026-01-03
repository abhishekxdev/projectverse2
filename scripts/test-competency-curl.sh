#!/bin/bash

# Quick cURL test for Competency Assessment with Video Upload
# Usage: ./test-competency-curl.sh

set -e

# Configuration (can be overridden with environment variables)
BASE_URL="${BASE_URL:-http://localhost:3000/api}"
EMAIL="${TEST_EMAIL:-teacher@test.com}"
PASSWORD="${TEST_PASSWORD:-password123}"
VIDEO_FILE="test-data/videos/sample-response.mp4"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Competency Assessment cURL Test${NC}\n"

# Step 1: Login
echo -e "${YELLOW}[1/6]${NC} Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"idToken":"[^"]*' | sed 's/"idToken":"//')
USER_ID=$(echo $LOGIN_RESPONSE | grep -o '"uid":"[^"]*' | sed 's/"uid":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✓${NC} Authenticated (User ID: ${USER_ID:0:10}...)"

# Step 2: Get Questions
echo -e "\n${YELLOW}[2/6]${NC} Fetching questions..."
QUESTIONS=$(curl -s -X GET "$BASE_URL/competency/questions" \
  -H "Authorization: Bearer $TOKEN")

QUESTION_COUNT=$(echo $QUESTIONS | jq '.data | length')
echo -e "${GREEN}✓${NC} Retrieved $QUESTION_COUNT questions"

# Step 3: Start Attempt
echo -e "\n${YELLOW}[3/6]${NC} Starting attempt..."
START_RESPONSE=$(curl -s -X POST "$BASE_URL/competency/attempts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

ATTEMPT_ID=$(echo $START_RESPONSE | jq -r '.data.attemptId')

if [ -z "$ATTEMPT_ID" ] || [ "$ATTEMPT_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to start attempt${NC}"
  echo $START_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✓${NC} Attempt started (ID: $ATTEMPT_ID)"

# Step 4: Generate Presigned URL for Video
if [ -f "$VIDEO_FILE" ]; then
  echo -e "\n${YELLOW}[4/6]${NC} Generating presigned URL for video..."
  PRESIGNED_RESPONSE=$(curl -s -X POST "$BASE_URL/upload/presigned-url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"fileType\": \"assessment-video\",
      \"fileName\": \"response.mp4\",
      \"contentType\": \"video/mp4\",
      \"metadata\": {
        \"attemptId\": \"$ATTEMPT_ID\",
        \"questionId\": \"q1\"
      }
    }")

  UPLOAD_URL=$(echo $PRESIGNED_RESPONSE | jq -r '.data.uploadUrl')
  S3_KEY=$(echo $PRESIGNED_RESPONSE | jq -r '.data.key')

  if [ -z "$UPLOAD_URL" ] || [ "$UPLOAD_URL" = "null" ]; then
    echo -e "${RED}❌ Failed to generate presigned URL${NC}"
    echo $PRESIGNED_RESPONSE | jq '.'
    exit 1
  fi

  echo -e "${GREEN}✓${NC} Presigned URL generated"
  echo -e "   S3 Key: $S3_KEY"

  # Step 5: Upload Video to S3
  echo -e "\n${YELLOW}[5/6]${NC} Uploading video to S3..."
  UPLOAD_RESULT=$(curl -s -X PUT "$UPLOAD_URL" \
    -H "Content-Type: video/mp4" \
    --data-binary "@$VIDEO_FILE" \
    -w "%{http_code}")

  if [[ "$UPLOAD_RESULT" == "200" ]]; then
    echo -e "${GREEN}✓${NC} Video uploaded successfully"
  else
    echo -e "${RED}❌ Upload failed (HTTP $UPLOAD_RESULT)${NC}"
  fi
else
  echo -e "\n${YELLOW}[4/6]${NC} Video upload ${YELLOW}SKIPPED${NC} (no file found)"
  echo -e "   Run: pnpm create:test-media"
fi

# Step 6: Submit Attempt
echo -e "\n${YELLOW}[6/6]${NC} Submitting assessment..."
SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/competency/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"attemptId\": \"$ATTEMPT_ID\",
    \"answers\": [
      {\"questionId\": \"q1\", \"answer\": \"Sample answer 1\"},
      {\"questionId\": \"q2\", \"answer\": \"Sample answer 2\"}
    ]
  }")

SUBMIT_STATUS=$(echo $SUBMIT_RESPONSE | jq -r '.data.status')

if [ -z "$SUBMIT_STATUS" ] || [ "$SUBMIT_STATUS" = "null" ]; then
  echo -e "${RED}❌ Submission failed${NC}"
  echo $SUBMIT_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✓${NC} Assessment submitted (Status: $SUBMIT_STATUS)"

# Summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\nAttempt ID: ${BLUE}$ATTEMPT_ID${NC}"
echo -e "Status: ${BLUE}$SUBMIT_STATUS${NC}"

# Optional: Get results
echo -e "\n${YELLOW}Fetching results...${NC}"
RESULTS=$(curl -s -X GET "$BASE_URL/competency/result" \
  -H "Authorization: Bearer $TOKEN")

echo $RESULTS | jq '.'
