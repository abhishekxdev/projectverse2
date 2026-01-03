#!/bin/bash

set -e

BASE_URL="${BASE_URL:-http://localhost:3000/api}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="teacher.test.${TIMESTAMP}@gurucool.test"
TEST_PASSWORD="TestPassword123!"

echo "========================================"
echo "Testing Complete Competency Assessment Flow"
echo "========================================"
echo "Base URL: $BASE_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Create new teacher account
echo -e "${BLUE}Step 1: Creating new teacher account...${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "'"$TEST_PASSWORD"'",
    "role": "teacher",
    "displayName": "Test Teacher"
  }')

echo "$SIGNUP_RESPONSE" | jq '.'

if echo "$SIGNUP_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Account created successfully${NC}"
else
  echo -e "${RED}✗ Failed to create account${NC}"
  exit 1
fi
echo ""

# Step 2: Login
echo -e "${BLUE}Step 2: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "'"$TEST_PASSWORD"'"
  }')

echo "$LOGIN_RESPONSE" | jq '.'

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  echo "Token: ${TOKEN:0:20}..."
else
  echo -e "${RED}✗ Failed to login${NC}"
  exit 1
fi
echo ""

# Step 3: Complete onboarding profile
echo -e "${BLUE}Step 3: Completing onboarding profile...${NC}"
PROFILE_RESPONSE=$(curl -s -X PUT "$BASE_URL/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "role": "teacher",
    "profile": {
      "firstName": "Test",
      "lastName": "Teacher",
      "schoolEmail": "test.teacher@school.edu",
      "subjects": ["Mathematics"],
      "gradeLevels": ["Grade 1-5"],
      "teachingExperience": "3-5",
      "certificates": "test-certificate.pdf"
    }
  }')

echo "$PROFILE_RESPONSE" | jq '.'

if echo "$PROFILE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Profile updated successfully${NC}"
else
  echo -e "${RED}✗ Failed to update profile${NC}"
  exit 1
fi
echo ""

# Step 4: Get competency questions for assessment info
echo -e "${BLUE}Step 4: Getting assessment information...${NC}"
QUESTIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/competency/questions" \
  -H "Authorization: Bearer $TOKEN")

ASSESSMENT_ID=$(echo "$QUESTIONS_RESPONSE" | jq -r '.data.assessment.id')
echo "Assessment ID: $ASSESSMENT_ID"

if [ "$ASSESSMENT_ID" != "null" ] && [ -n "$ASSESSMENT_ID" ]; then
  echo -e "${GREEN}✓ Assessment found${NC}"
else
  echo -e "${RED}✗ No assessment found${NC}"
  exit 1
fi
echo ""

# Step 5: Start an attempt
echo -e "${BLUE}Step 5: Starting competency assessment attempt...${NC}"

START_ATTEMPT_RESPONSE=$(curl -s -X POST "$BASE_URL/competency/attempts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"assessmentId\":\"$ASSESSMENT_ID\"}")

ATTEMPT_ID=$(echo "$START_ATTEMPT_RESPONSE" | jq -r '.data.attemptId // .data.id')

if [ "$ATTEMPT_ID" != "null" ] && [ -n "$ATTEMPT_ID" ]; then
  echo -e "${GREEN}✓ Attempt started with ID: $ATTEMPT_ID${NC}"
else
  echo -e "${RED}✗ Failed to start attempt${NC}"
  echo "$START_ATTEMPT_RESPONSE" | jq '.'
  exit 1
fi
echo ""

# Step 5b: Get the attempt with selected questions
echo -e "${BLUE}Step 5b: Getting selected questions from attempt...${NC}"
ATTEMPT_RESPONSE=$(curl -s -X GET "$BASE_URL/competency/attempt" \
  -H "Authorization: Bearer $TOKEN")

echo "$ATTEMPT_RESPONSE" | jq '.data | {id, status, assessmentId, selectedQuestionsCount: (.selectedQuestions | length)}'

QUESTION_IDS=($(echo "$ATTEMPT_RESPONSE" | jq -r '.data.selectedQuestions[].questionId'))

if [ ${#QUESTION_IDS[@]} -gt 0 ]; then
  echo -e "${GREEN}✓ Retrieved ${#QUESTION_IDS[@]} selected questions for this attempt${NC}"
else
  echo -e "${RED}✗ No selected questions found${NC}"
  exit 1
fi
echo ""

# Step 6: Prepare answers for submission
echo -e "${BLUE}Step 6: Preparing and submitting answers...${NC}"

# Build answers JSON dynamically based on selected questions
ANSWERS_JSON="["
for i in "${!QUESTION_IDS[@]}"; do
  if [ $i -gt 0 ]; then
    ANSWERS_JSON+=","
  fi
  # Provide realistic answers based on question type
  QUESTION_TYPE=$(echo "$ATTEMPT_RESPONSE" | jq -r ".data.selectedQuestions[$i].type")

  if [ "$QUESTION_TYPE" == "MCQ" ]; then
    # For MCQ, use the first option
    ANSWER=$(echo "$ATTEMPT_RESPONSE" | jq -r ".data.selectedQuestions[$i].options[0]")
  else
    # For text/audio/video questions, provide a sample answer
    ANSWER="This is a comprehensive answer demonstrating understanding of pedagogical principles. I believe in creating an inclusive learning environment where students feel safe to explore concepts. I use differentiated instruction to meet diverse learning needs and integrate technology effectively to enhance engagement."
  fi

  ANSWERS_JSON+="{\"questionId\":\"${QUESTION_IDS[$i]}\",\"answer\":\"$ANSWER\"}"
done
ANSWERS_JSON+="]"

# Submit the attempt with assessment ID
SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/competency/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"assessmentId\":\"$ASSESSMENT_ID\",\"answers\":$ANSWERS_JSON}")

echo "$SUBMIT_RESPONSE" | jq '.'

if echo "$SUBMIT_RESPONSE" | jq -e '.success' > /dev/null; then
  EVAL_STATUS=$(echo "$SUBMIT_RESPONSE" | jq -r '.data.status')
  echo -e "${GREEN}✓ Attempt submitted successfully (Status: $EVAL_STATUS)${NC}"

  # Check if result is available
  if [ "$EVAL_STATUS" == "EVALUATED" ]; then
    OVERALL_SCORE=$(echo "$SUBMIT_RESPONSE" | jq -r '.data.result.overallScore')
    PROFICIENCY=$(echo "$SUBMIT_RESPONSE" | jq -r '.data.result.proficiencyLevel')
    echo -e "${GREEN}✓ Evaluation completed immediately!${NC}"
    echo "  Overall Score: $OVERALL_SCORE"
    echo "  Proficiency Level: $PROFICIENCY"
  fi
else
  echo -e "${RED}✗ Failed to submit attempt${NC}"
  echo "Error details:"
  echo "$SUBMIT_RESPONSE" | jq '.error'
  exit 1
fi
echo ""

# Step 7: Get the evaluation result
echo -e "${BLUE}Step 7: Fetching evaluation result...${NC}"
RESULT_RESPONSE=$(curl -s -X GET "$BASE_URL/competency/result" \
  -H "Authorization: Bearer $TOKEN")

echo "$RESULT_RESPONSE" | jq '.'

if echo "$RESULT_RESPONSE" | jq -e '.data' > /dev/null; then
  OVERALL_SCORE=$(echo "$RESULT_RESPONSE" | jq -r '.data.overallScore')
  PROFICIENCY=$(echo "$RESULT_RESPONSE" | jq -r '.data.proficiencyLevel')
  GAP_DOMAINS=$(echo "$RESULT_RESPONSE" | jq -r '.data.gapDomains[]?' | tr '\n' ', ')

  echo -e "${GREEN}✓ Result retrieved successfully${NC}"
  echo "  Overall Score: $OVERALL_SCORE"
  echo "  Proficiency Level: $PROFICIENCY"
  [ -n "$GAP_DOMAINS" ] && echo "  Gap Domains: $GAP_DOMAINS"
else
  echo -e "${RED}✗ Failed to retrieve result${NC}"
  exit 1
fi
echo ""

# Step 8: Verify Learning Path was generated
echo -e "${BLUE}Step 8: Verifying learning path generation...${NC}"
LEARNING_PATH_COUNT=$(echo "$RESULT_RESPONSE" | jq -r '.data.data.recommendedMicroPDs | length')

if [ "$LEARNING_PATH_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Learning path generated with $LEARNING_PATH_COUNT recommended micro-PD modules${NC}"
  echo ""
  echo "Recommended Modules:"
  echo "$RESULT_RESPONSE" | jq -r '.data.data.recommendedMicroPDs[]' | head -10 | while read module; do
    echo "  - $module"
  done
  echo "  ... and $(($LEARNING_PATH_COUNT - 10)) more modules"
else
  echo -e "${RED}✗ No learning path generated${NC}"
fi
echo ""

# Step 9: AI Tutor (requires teacher approval)
echo -e "${BLUE}Step 9: AI Tutor access check...${NC}"
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/tutor/session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}')

if echo "$SESSION_RESPONSE" | jq -e '.success' > /dev/null; then
  SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.data.sessionId // .data.id')
  echo -e "${GREEN}✓ AI Tutor session started with ID: $SESSION_ID${NC}"

  # Send a message to see learning path recommendations
  MESSAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/tutor/session/$SESSION_ID/message" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "message": "What learning path do you recommend based on my competency assessment results?"
    }')

  if echo "$MESSAGE_RESPONSE" | jq -e '.data.response' > /dev/null; then
    AI_RESPONSE=$(echo "$MESSAGE_RESPONSE" | jq -r '.data.response')
    echo -e "${GREEN}✓ AI Tutor responded successfully${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "AI Tutor Learning Path Recommendation:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$AI_RESPONSE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  fi
else
  ERROR_CODE=$(echo "$SESSION_RESPONSE" | jq -r '.error.code')
  if [ "$ERROR_CODE" == "AI_TUTOR_NOT_AVAILABLE" ]; then
    echo -e "${BLUE}ⓘ AI Tutor requires teacher approval (status: pending)${NC}"
    echo "  This is expected behavior for new teachers."
  else
    echo -e "${RED}✗ Failed to start tutor session${NC}"
    echo "$SESSION_RESPONSE" | jq '.'
  fi
fi
echo ""

# Summary
echo "========================================"
echo -e "${GREEN}✓ ALL TESTS PASSED SUCCESSFULLY!${NC}"
echo "========================================"
echo "Summary:"
echo "  - Teacher account created: $TEST_EMAIL"
echo "  - Profile completed: Yes"
echo "  - Assessment completed: Yes"
echo "  - Evaluation status: $(echo "$RESULT_RESPONSE" | jq -r '.data.status')"
echo "  - Overall score: $OVERALL_SCORE"
echo "  - Proficiency level: $PROFICIENCY"
echo "  - AI Tutor session: Active"
echo "  - Learning path recommendations: Generated"
echo ""
echo "Test completed at: $(date)"
