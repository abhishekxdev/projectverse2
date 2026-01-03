#!/bin/bash

BASE_URL="${BASE_URL:-http://13.48.56.175:3000/api}"

# Create account and get token
TIMESTAMP=$(date +%s)
SIGNUP_RESP=$(curl -s "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test${TIMESTAMP}@test.com\",\"password\":\"Test123!\",\"role\":\"teacher\",\"displayName\":\"Test Teacher\"}")

TOKEN=$(echo "$SIGNUP_RESP" | jq -r '.data.token')

# Complete profile
curl -s "$BASE_URL/auth/profile" \
  -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"teacher","profile":{"firstName":"Test","lastName":"Teacher","schoolEmail":"test@school.edu","subjects":["Mathematics"],"gradeLevels":["Grade 1-5"],"teachingExperience":"3-5","certificates":"cert.pdf"}}' > /dev/null

# Get assessment ID
ASSESSMENT_ID=$(curl -s "$BASE_URL/competency/questions" -H "Authorization: Bearer $TOKEN" | jq -r '.data.assessment.id')

# Start attempt
curl -s "$BASE_URL/competency/attempts" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"assessmentId\":\"$ASSESSMENT_ID\"}" > /dev/null

# Get selected questions
ATTEMPT=$(curl -s "$BASE_URL/competency/attempt" -H "Authorization: Bearer $TOKEN")
QUESTION_IDS=($(echo "$ATTEMPT" | jq -r '.data.selectedQuestions[].questionId'))

# Build answers
ANSWERS="["
for i in "${!QUESTION_IDS[@]}"; do
  [ $i -gt 0 ] && ANSWERS+=","
  ANSWERS+="{\"questionId\":\"${QUESTION_IDS[$i]}\",\"answer\":\"test answer\"}"
done
ANSWERS+="]"

# Submit
curl -s "$BASE_URL/competency/submit" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"assessmentId\":\"$ASSESSMENT_ID\",\"answers\":$ANSWERS}" > /dev/null

# Wait for evaluation
sleep 2

# Get result with recommendedTracks
echo "=== Checking for recommendedTracks field ==="
RESULT=$(curl -s "$BASE_URL/competency/result" -H "Authorization: Bearer $TOKEN")

echo "$RESULT" | jq '.data.data | {
  hasRecommendedTracks: (has("recommendedTracks")),
  recommendedTracksCount: (if .recommendedTracks then (.recommendedTracks | length) else 0 end),
  recommendedTracks: .recommendedTracks,
  microPDsCount: (.recommendedMicroPDs | length)
}'
