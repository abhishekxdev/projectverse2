#!/bin/bash

# Test Learning Path with APPROVED Teacher
# This shows the full learning path generation that worked in testing

BASE_URL="${BASE_URL:-http://13.48.56.175:3000/api}"
APPROVED_EMAIL="teacher.alpha@gurucool.dev"
APPROVED_PASSWORD="Password123!"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "Learning Path Test (Approved Teacher)"
echo "=========================================="
echo ""

# Login
echo -e "${CYAN}Logging in as approved teacher...${NC}"
LOGIN_PAYLOAD=$(jq -n --arg email "$APPROVED_EMAIL" --arg password "$APPROVED_PASSWORD" '{email: $email, password: $password}')
AUTH_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_PAYLOAD" | jq -r '.data.token')

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# Check if they have a competency result
echo -e "${CYAN}Checking for competency assessment result...${NC}"
RESULT=$(curl -s -X GET "$BASE_URL/competency/result" \
  -H "Authorization: Bearer $AUTH_TOKEN")

HAS_RESULT=$(echo "$RESULT" | jq -r '.success // false')

if [ "$HAS_RESULT" = "false" ]; then
  echo "⚠️  No competency result found. Teacher needs to complete assessment first."
  echo ""
  echo "Run this first:"
  echo "  TEST_EMAIL='$APPROVED_EMAIL' TEST_PASSWORD='$APPROVED_PASSWORD' bash test-competency-learning-flow.sh"
  exit 1
fi

RESULT_ID=$(echo "$RESULT" | jq -r '.data.resultId // .data.id // empty')
OVERALL_SCORE=$(echo "$RESULT" | jq -r '.data.overallScore')
PROFICIENCY=$(echo "$RESULT" | jq -r '.data.proficiencyLevel')

echo -e "${GREEN}✓ Found competency result${NC}"
echo "  Score: $OVERALL_SCORE"
echo "  Proficiency: $PROFICIENCY"
echo ""

# Try to get existing learning path
echo -e "${CYAN}Checking for existing learning path...${NC}"
LP_RESPONSE=$(curl -s -X GET "$BASE_URL/learning-path" \
  -H "Authorization: Bearer $AUTH_TOKEN")

LP_EXISTS=$(echo "$LP_RESPONSE" | jq -r '.success // false')

if [ "$LP_EXISTS" = "false" ]; then
  echo "⚠️  No learning path found. Generating new one..."
  echo ""

  # Generate learning path
  echo -e "${CYAN}Generating learning path...${NC}"
  GEN_PAYLOAD=$(jq -n --arg resultId "$RESULT_ID" '{resultId: $resultId}')
  LP_RESPONSE=$(curl -s -X POST "$BASE_URL/learning-path/generate" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$GEN_PAYLOAD")

  GEN_SUCCESS=$(echo "$LP_RESPONSE" | jq -r '.success // false')

  if [ "$GEN_SUCCESS" = "false" ]; then
    echo "❌ Failed to generate learning path"
    echo "$LP_RESPONSE" | jq '.'
    exit 1
  fi

  echo -e "${GREEN}✓ Learning path generated${NC}"
  echo ""

  # Fetch the newly created path
  LP_RESPONSE=$(curl -s -X GET "$BASE_URL/learning-path" \
    -H "Authorization: Bearer $AUTH_TOKEN")
fi

echo ""
echo "🎯 LEARNING PATH DETAILS"
echo "=========================================="

# Parse and display learning path
LP_ID=$(echo "$LP_RESPONSE" | jq -r '.data.id')
TEACHER_ID=$(echo "$LP_RESPONSE" | jq -r '.data.teacherId')
CURRENT_MODULE=$(echo "$LP_RESPONSE" | jq -r '.data.currentModuleId // "Not set"')
COMPLETION=$(echo "$LP_RESPONSE" | jq -r '.data.completionPercent // 0')

echo "Learning Path ID: $LP_ID"
echo "Teacher ID: $TEACHER_ID"
echo "Current Module: $CURRENT_MODULE"
echo "Completion: ${COMPLETION}%"
echo ""

# Display modules
echo "📚 MODULES:"
echo ""

MODULES=$(echo "$LP_RESPONSE" | jq -c '.data.modules[]' 2>/dev/null)

if [ -z "$MODULES" ]; then
  echo "  No modules found"
else
  echo "$LP_RESPONSE" | jq -r '.data.modules[] |
    "  • \(.title)\n" +
    "    Track: \(.track)\n" +
    "    Order: \(.order)\n" +
    "    Status: \(.status)\n" +
    "    Progress: \(.progress // 0)%\n"'
fi

echo "=========================================="
echo ""

# Display preview
echo -e "${CYAN}Getting learning path preview...${NC}"
PREVIEW=$(curl -s -X GET "$BASE_URL/learning-path/preview" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo ""
echo "👁️  PREVIEW (What limited access teachers see):"
echo "=========================================="
echo "$PREVIEW" | jq '.data'
echo "=========================================="
echo ""

echo -e "${GREEN}✅ Test Complete${NC}"
echo ""
echo "📖 Documentation:"
echo "  - COMPETENCY_LEARNING_TEST_RESULTS.md"
echo "  - FLOW_TEST_RESULTS.md"
echo ""
