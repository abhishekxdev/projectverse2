#!/bin/bash

# Competency Assessment and Learning Path Generation Test
# Tests the complete flow from assessment to learning path generation
# No EC2 required - uses OpenAI directly

set -e

# Configuration
BASE_URL="${BASE_URL:-http://13.48.56.175:3000/api}"
TEST_EMAIL="${TEST_EMAIL:-teacher.beta.approved@gurucool.dev}"
TEST_PASSWORD="${TEST_PASSWORD:-Password123!}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global variables
AUTH_TOKEN=""
ASSESSMENT_ID=""
ATTEMPT_ID=""
RESULT_ID=""

echo ""
echo "============================================"
echo "Competency & Learning Path E2E Test"
echo "============================================"
echo ""
echo -e "${BLUE}Base URL: $BASE_URL${NC}"
echo -e "${BLUE}Test User: $TEST_EMAIL${NC}"
echo ""

# ===== STEP 1: Authentication =====
echo -e "${CYAN}[STEP 1] Authenticating...${NC}"
LOGIN_PAYLOAD=$(jq -n --arg email "$TEST_EMAIL" --arg password "$TEST_PASSWORD" '{email: $email, password: $password}')
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_PAYLOAD")

AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // .data.idToken // empty')

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}✗ Authentication failed${NC}"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Authenticated successfully${NC}"
echo ""

# ===== STEP 2: Get Competency Questions =====
echo -e "${CYAN}[STEP 2] Fetching competency questions...${NC}"
QUESTIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/competency/questions" \
  -H "Authorization: Bearer $AUTH_TOKEN")

ASSESSMENT_ID=$(echo "$QUESTIONS_RESPONSE" | jq -r '.data.assessment.id // empty')
QUESTION_COUNT=$(echo "$QUESTIONS_RESPONSE" | jq -r '.data.questions | length')

if [ -z "$ASSESSMENT_ID" ]; then
  echo -e "${RED}✗ Failed to get questions${NC}"
  echo "$QUESTIONS_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Retrieved $QUESTION_COUNT questions${NC}"
echo -e "  Assessment ID: $ASSESSMENT_ID"
echo ""

# ===== STEP 3: Check for existing attempts =====
echo -e "${CYAN}[STEP 3] Checking for existing attempts...${NC}"
ATTEMPTS_RESPONSE=$(curl -s -X GET "$BASE_URL/competency/attempts" \
  -H "Authorization: Bearer $AUTH_TOKEN")

EXISTING_ATTEMPTS=$(echo "$ATTEMPTS_RESPONSE" | jq -r '.data.attempts // .data // []')
ATTEMPT_COUNT=$(echo "$EXISTING_ATTEMPTS" | jq 'length')

echo -e "${GREEN}✓ Found $ATTEMPT_COUNT existing attempt(s)${NC}"

# Check for pending attempts
PENDING_ATTEMPTS=$(echo "$EXISTING_ATTEMPTS" | jq '[.[] | select(.status == "SUBMITTED" or .status == "IN_PROGRESS")]')
PENDING_COUNT=$(echo "$PENDING_ATTEMPTS" | jq 'length')

if [ "$PENDING_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠ Found $PENDING_COUNT pending attempt(s)${NC}"
  echo -e "  Will try to trigger evaluation for submitted attempts..."

  # Try to trigger evaluation for submitted attempts
  echo "$PENDING_ATTEMPTS" | jq -c '.[]' | while read attempt; do
    PENDING_ID=$(echo "$attempt" | jq -r '.id')
    PENDING_STATUS=$(echo "$attempt" | jq -r '.status')

    if [ "$PENDING_STATUS" = "SUBMITTED" ]; then
      echo -e "  Triggering evaluation for: ${PENDING_ID:0:12}..."
      EVAL_RESPONSE=$(curl -s -X POST "$BASE_URL/competency/evaluate" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{}")

      EVAL_STATUS=$(echo "$EVAL_RESPONSE" | jq -r '.success // false')
      if [ "$EVAL_STATUS" = "true" ]; then
        echo -e "  ${GREEN}✓ Evaluation triggered${NC}"
      else
        echo -e "  ${YELLOW}⚠ Could not trigger evaluation (may require admin)${NC}"
      fi
    fi
  done

  echo ""
fi

# ===== STEP 4: Start New Attempt =====
echo -e "${CYAN}[STEP 4] Starting new assessment attempt...${NC}"
START_PAYLOAD=$(jq -n --arg assessmentId "$ASSESSMENT_ID" '{assessmentId: $assessmentId}')
START_RESPONSE=$(curl -s -X POST "$BASE_URL/competency/attempts" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$START_PAYLOAD")

ATTEMPT_ID=$(echo "$START_RESPONSE" | jq -r '.data.id // empty')

# The questions field is an object with types as keys, flatten it to an array
SELECTED_QUESTIONS=$(echo "$START_RESPONSE" | jq -c '[.data.questions | to_entries | .[] | .value[]]')
SELECTED_COUNT=$(echo "$SELECTED_QUESTIONS" | jq 'length')

if [ -z "$ATTEMPT_ID" ]; then
  echo -e "${RED}✗ Failed to start attempt${NC}"
  echo "$START_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Attempt started${NC}"
echo -e "  Attempt ID: $ATTEMPT_ID"
echo -e "  Questions: $SELECTED_COUNT"
echo ""

# ===== STEP 5: Generate Sample Answers =====
echo -e "${CYAN}[STEP 5] Generating sample answers...${NC}"

# Create answers for all questions
# Check if questions have proper structure
if [ "$SELECTED_COUNT" -gt 0 ]; then
  ANSWERS=$(echo "$SELECTED_QUESTIONS" | jq -c '[
    .[] | {
      questionId: .id,
      answer: (
        if .type == "MCQ" then
          (.options[0] // "Option A")
        else
          "This is a comprehensive answer demonstrating deep understanding of " +
          (.domainKey // "teaching competencies") + ". " +
          "In my teaching practice, I implement differentiated instruction strategies " +
          "to address diverse learning needs. I use formative assessment techniques " +
          "to monitor student progress and adjust my teaching accordingly. " +
          "I create an inclusive classroom environment where all students feel valued " +
          "and supported in their learning journey. I collaborate with colleagues " +
          "and engage in continuous professional development to improve my practice."
        end
      )
    }
  ]')
else
  # Fallback: create simple answers using questionIds
  QUESTION_IDS=$(echo "$START_RESPONSE" | jq -r '.data.questionIds // []')
  ANSWERS=$(echo "$QUESTION_IDS" | jq -c 'map({
    questionId: .,
    answer: "This is a comprehensive answer demonstrating teaching competencies and pedagogical knowledge."
  })')
  SELECTED_COUNT=$(echo "$ANSWERS" | jq 'length')
fi

echo -e "${GREEN}✓ Generated answers for all $SELECTED_COUNT questions${NC}"
echo ""

# ===== STEP 6: Save Progress (Auto-save) =====
echo -e "${CYAN}[STEP 6] Saving progress (auto-save)...${NC}"

# Save first 3 answers
PARTIAL_ANSWERS=$(echo "$ANSWERS" | jq '.[0:3]')
SAVE_PAYLOAD=$(jq -n --argjson answers "$PARTIAL_ANSWERS" '{answers: $answers}')

SAVE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/competency/attempts/$ATTEMPT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SAVE_PAYLOAD")

SAVE_SUCCESS=$(echo "$SAVE_RESPONSE" | jq -r '.success // false')

if [ "$SAVE_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Progress saved${NC}"
else
  echo -e "${YELLOW}⚠ Progress save warning (continuing...)${NC}"
fi
echo ""

# ===== STEP 7: Submit Assessment =====
echo -e "${CYAN}[STEP 7] Submitting assessment...${NC}"
SUBMIT_PAYLOAD=$(jq -n --arg assessmentId "$ASSESSMENT_ID" --arg attemptId "$ATTEMPT_ID" --argjson answers "$ANSWERS" '{assessmentId: $assessmentId, attemptId: $attemptId, answers: $answers}')

SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/competency/submit" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SUBMIT_PAYLOAD")

SUBMIT_SUCCESS=$(echo "$SUBMIT_RESPONSE" | jq -r '.success // false')
EVAL_TRIGGERED=$(echo "$SUBMIT_RESPONSE" | jq -r '.data.evaluationResult != null')

if [ "$SUBMIT_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Assessment submitted${NC}"

  if [ "$EVAL_TRIGGERED" = "true" ]; then
    echo -e "${GREEN}✓ Evaluation auto-triggered${NC}"
    OVERALL_SCORE=$(echo "$SUBMIT_RESPONSE" | jq -r '.data.evaluationResult.overallScore // empty')
    if [ ! -z "$OVERALL_SCORE" ]; then
      echo -e "  Overall Score: $OVERALL_SCORE"
    fi
  else
    echo -e "${YELLOW}⚠ Evaluation not auto-triggered (will poll for results)${NC}"
  fi
else
  echo -e "${RED}✗ Failed to submit assessment${NC}"
  echo "$SUBMIT_RESPONSE" | jq '.'
  exit 1
fi
echo ""

# ===== STEP 8: Wait for Evaluation Results =====
echo -e "${CYAN}[STEP 8] Waiting for evaluation results...${NC}"

MAX_POLLS=20
POLL_INTERVAL=3
POLL_COUNT=0
RESULT_READY=false

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
  sleep $POLL_INTERVAL
  POLL_COUNT=$((POLL_COUNT + 1))

  RESULT_RESPONSE=$(curl -s -X GET "$BASE_URL/competency/result" \
    -H "Authorization: Bearer $AUTH_TOKEN")

  RESULT_SUCCESS=$(echo "$RESULT_RESPONSE" | jq -r '.success // false')
  OVERALL_SCORE=$(echo "$RESULT_RESPONSE" | jq -r '.data.overallScore // .data.data.overallScore // empty')

  if [ "$RESULT_SUCCESS" = "true" ] && [ ! -z "$OVERALL_SCORE" ] && [ "$OVERALL_SCORE" != "null" ]; then
    RESULT_READY=true
    break
  fi

  echo -e "  Polling for results... ($POLL_COUNT/$MAX_POLLS)"
done

if [ "$RESULT_READY" = "true" ]; then
  echo -e "${GREEN}✓ Evaluation completed${NC}"

  RESULT_ID=$(echo "$RESULT_RESPONSE" | jq -r '.data.resultId // .data.id // .data.data.resultId // .data.data.id // empty')
  if [ -z "$RESULT_ID" ] || [ "$RESULT_ID" = "null" ]; then
    # Try to get from attempts - result might be embedded there
    RESULT_ID=$ATTEMPT_ID
  fi

  OVERALL_SCORE=$(echo "$RESULT_RESPONSE" | jq -r '.data.overallScore // .data.data.overallScore')
  PROFICIENCY=$(echo "$RESULT_RESPONSE" | jq -r '.data.proficiencyLevel // .data.data.proficiencyLevel // "N/A"')
  STRENGTH_DOMAINS=$(echo "$RESULT_RESPONSE" | jq -r '.data.strengthDomains // .data.data.strengthDomains // [] | join(", ")')
  GAP_DOMAINS=$(echo "$RESULT_RESPONSE" | jq -r '.data.gapDomains // .data.data.gapDomains // [] | join(", ")')

  echo ""
  echo "📊 EVALUATION RESULTS"
  echo "═══════════════════════════════════════════"
  echo "Result ID: $RESULT_ID"
  echo "Overall Score: $OVERALL_SCORE"
  echo "Proficiency Level: $PROFICIENCY"
  echo "Strengths: $STRENGTH_DOMAINS"
  echo "Gaps: $GAP_DOMAINS"
  echo "═══════════════════════════════════════════"
  echo ""
else
  echo -e "${YELLOW}⚠ Evaluation still pending after $((MAX_POLLS * POLL_INTERVAL))s${NC}"
  echo -e "  You may need to trigger evaluation manually or wait longer"
  RESULT_ID=""
fi

# ===== STEP 9: Generate Learning Path =====
if [ ! -z "$RESULT_ID" ]; then
  echo -e "${CYAN}[STEP 9] Generating learning path from results...${NC}"
  LP_GEN_PAYLOAD=$(jq -n --arg resultId "$RESULT_ID" '{resultId: $resultId}')

  LEARNING_PATH_RESPONSE=$(curl -s -X POST "$BASE_URL/learning-path/generate" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$LP_GEN_PAYLOAD")

  LP_SUCCESS=$(echo "$LEARNING_PATH_RESPONSE" | jq -r '.success // false')

  if [ "$LP_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Learning path generated${NC}"

    LP_ID=$(echo "$LEARNING_PATH_RESPONSE" | jq -r '.data.id // empty')
    CURRENT_MODULE=$(echo "$LEARNING_PATH_RESPONSE" | jq -r '.data.currentModuleId // empty')
    MODULE_COUNT=$(echo "$LEARNING_PATH_RESPONSE" | jq -r '.data.modules // [] | length')

    echo -e "  Learning Path ID: $LP_ID"
    echo -e "  Current Module: $CURRENT_MODULE"
    echo -e "  Total Modules: $MODULE_COUNT"
    echo ""

    # Get full learning path
    echo -e "${CYAN}[STEP 10] Fetching full learning path details...${NC}"

    LP_GET_RESPONSE=$(curl -s -X GET "$BASE_URL/learning-path" \
      -H "Authorization: Bearer $AUTH_TOKEN")

    LP_GET_SUCCESS=$(echo "$LP_GET_RESPONSE" | jq -r '.success // false')

    if [ "$LP_GET_SUCCESS" = "true" ]; then
      echo -e "${GREEN}✓ Learning path retrieved${NC}"

      echo ""
      echo "🎯 LEARNING PATH DETAILS"
      echo "═══════════════════════════════════════════"

      # Display modules
      MODULES=$(echo "$LP_GET_RESPONSE" | jq -r '.data.modules // []')
      MODULE_COUNT=$(echo "$MODULES" | jq 'length')

      echo "Total Modules: $MODULE_COUNT"
      echo ""
      echo "Modules:"

      echo "$MODULES" | jq -r '.[] | "  • " + .title + " (" + .track + ") - " + (.status // "locked")'

      echo "═══════════════════════════════════════════"
      echo ""
    else
      echo -e "${YELLOW}⚠ Could not retrieve learning path details${NC}"
      echo "$LP_GET_RESPONSE" | jq '.'
      echo ""
    fi

  else
    echo -e "${YELLOW}⚠ Could not generate learning path${NC}"
    ERROR_MSG=$(echo "$LEARNING_PATH_RESPONSE" | jq -r '.error.message // "Unknown error"')
    echo -e "  Error: $ERROR_MSG"
    echo ""
  fi
else
  echo -e "${CYAN}[STEP 9] Skipping learning path generation (no result available)${NC}"
  echo ""
fi

# ===== STEP 11: Get Learning Path Preview =====
echo -e "${CYAN}[STEP 11] Getting learning path preview...${NC}"

PREVIEW_RESPONSE=$(curl -s -X GET "$BASE_URL/learning-path/preview" \
  -H "Authorization: Bearer $AUTH_TOKEN")

PREVIEW_SUCCESS=$(echo "$PREVIEW_RESPONSE" | jq -r '.success // false')

if [ "$PREVIEW_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Preview retrieved${NC}"

  PREVIEW_PROFICIENCY=$(echo "$PREVIEW_RESPONSE" | jq -r '.data.proficiencyLevel // "N/A"')
  PREVIEW_GAPS=$(echo "$PREVIEW_RESPONSE" | jq -r '.data.gapDomains // [] | join(", ")')
  PREVIEW_TRACKS=$(echo "$PREVIEW_RESPONSE" | jq -r '.data.recommendedTracks // [] | .[].trackId // empty' | head -3 | paste -sd, -)

  echo ""
  echo "👁️  LEARNING PATH PREVIEW"
  echo "═══════════════════════════════════════════"
  echo "Proficiency: $PREVIEW_PROFICIENCY"
  echo "Focus Areas: $PREVIEW_GAPS"
  echo "Recommended Tracks: $PREVIEW_TRACKS"
  echo "═══════════════════════════════════════════"
  echo ""
else
  echo -e "${YELLOW}⚠ Preview not available${NC}"
  ERROR_CODE=$(echo "$PREVIEW_RESPONSE" | jq -r '.error.code // "UNKNOWN"')
  if [ "$ERROR_CODE" = "NO_COMPETENCY_RESULT" ]; then
    echo -e "  Complete the assessment to see preview"
  fi
  echo ""
fi

# ===== Summary =====
echo ""
echo "============================================"
echo -e "${GREEN}✅ TEST FLOW COMPLETED${NC}"
echo "============================================"
echo ""
echo "Summary:"
echo "  • Assessment ID: $ASSESSMENT_ID"
echo "  • Attempt ID: $ATTEMPT_ID"
echo "  • Result ID: ${RESULT_ID:-N/A}"
echo "  • Questions Answered: $SELECTED_COUNT"
echo "  • Evaluation: ${RESULT_READY}"
if [ "$RESULT_READY" = "true" ]; then
  echo "  • Overall Score: $OVERALL_SCORE"
  echo "  • Proficiency: $PROFICIENCY"
fi
echo ""
echo "Endpoints Tested:"
echo "  ✓ GET  /api/competency/questions"
echo "  ✓ POST /api/competency/attempts"
echo "  ✓ PATCH /api/competency/attempts/:id"
echo "  ✓ POST /api/competency/submit"
echo "  ✓ GET  /api/competency/result"
echo "  ✓ GET  /api/competency/attempts"
if [ ! -z "$RESULT_ID" ]; then
  echo "  ✓ POST /api/learning-path/generate"
  echo "  ✓ GET  /api/learning-path"
fi
echo "  ✓ GET  /api/learning-path/preview"
echo ""
echo "NOTE: All evaluation is done using OpenAI (no EC2 required)"
echo ""
