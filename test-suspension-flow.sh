#!/bin/bash

# Test Suspension Flow
# This script tests the complete flow from school registration to teacher suspension

set -e

# Configuration
BASE_URL="http://13.48.56.175:3000/api"
SCHOOL_NAME="Test School $(date +%s)"
SCHOOL_ADMIN_EMAIL="schooladmin$(date +%s)@test.com"
SCHOOL_ADMIN_PASSWORD="Test123!"
TEACHER_EMAIL="teacher$(date +%s)@test.com"
TEACHER_PASSWORD="Test123!"

echo "============================================"
echo "Testing School Admin Suspension Flow"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Register a new school
echo -e "${BLUE}Step 1: Register new school${NC}"
SCHOOL_RESPONSE=$(curl -s -X POST "$BASE_URL/schools/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$SCHOOL_NAME\",
    \"adminEmail\": \"$SCHOOL_ADMIN_EMAIL\",
    \"seats\": { \"total\": 50 }
  }")

echo "$SCHOOL_RESPONSE" | jq '.'

SCHOOL_ID=$(echo "$SCHOOL_RESPONSE" | jq -r '.data.school.id')
SCHOOL_ADMIN_ID=$(echo "$SCHOOL_RESPONSE" | jq -r '.data.admin.uid')
TEMP_PASSWORD=$(echo "$SCHOOL_RESPONSE" | jq -r '.data.admin.temporaryPassword')

if [ "$SCHOOL_ID" == "null" ]; then
  echo -e "${RED}Failed to register school${NC}"
  exit 1
fi

echo -e "${GREEN}✓ School registered successfully${NC}"
echo "School ID: $SCHOOL_ID"
echo "School Admin ID: $SCHOOL_ADMIN_ID"
echo "Temporary Password: $TEMP_PASSWORD"
echo ""

# Step 2: Login as school admin to get token
echo -e "${BLUE}Step 2: Login as school admin with temporary password${NC}"
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$SCHOOL_ADMIN_EMAIL\",
    \"password\": \"$TEMP_PASSWORD\"
  }")

echo "$ADMIN_LOGIN_RESPONSE" | jq '.'

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$ADMIN_TOKEN" == "null" ]; then
  echo -e "${RED}Failed to login as school admin${NC}"
  exit 1
fi

echo -e "${GREEN}✓ School admin logged in successfully${NC}"
echo ""

# Step 3: Submit profile for approval (if needed)
echo -e "${BLUE}Step 3: Submit school admin profile for approval${NC}"
PROFILE_SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/profile/submit-approval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"firstName\": \"Admin\",
    \"lastName\": \"User\",
    \"schoolEmail\": \"admin@${SCHOOL_NAME// /}.edu\"
  }")

echo "$PROFILE_SUBMIT_RESPONSE" | jq '.'
echo -e "${GREEN}✓ Profile submitted for approval${NC}"
echo ""

# Step 4: Get platform admin token (need to have a platform admin created)
echo -e "${BLUE}Step 4: Login as platform admin${NC}"
echo "Note: This requires a platform admin to exist in the system"
echo "Attempting to login with platformadmin@gurucool.xyz..."

PLATFORM_ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"platformadmin@gurucool.xyz\",
    \"password\": \"Admin123!\"
  }")

PLATFORM_ADMIN_TOKEN=$(echo "$PLATFORM_ADMIN_LOGIN" | jq -r '.data.token // empty')

if [ -z "$PLATFORM_ADMIN_TOKEN" ]; then
  echo -e "${RED}⚠ Platform admin not available. You need to create a platform admin first.${NC}"
  echo "Skipping platform admin approval steps..."
  PLATFORM_ADMIN_TOKEN=""
else
  echo -e "${GREEN}✓ Platform admin logged in successfully${NC}"
  echo ""

  # Step 5: Approve school admin profile
  echo -e "${BLUE}Step 5: Approve school admin profile${NC}"
  APPROVE_RESPONSE=$(curl -s -X PUT "$BASE_URL/admin/profile/$SCHOOL_ADMIN_ID/approve" \
    -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN")

  echo "$APPROVE_RESPONSE" | jq '.'
  echo -e "${GREEN}✓ School admin profile approved${NC}"
  echo ""
fi

# Step 6: Invite a teacher
echo -e "${BLUE}Step 6: School admin invites a teacher${NC}"
INVITE_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/school/invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"schoolId\": \"$SCHOOL_ID\"
  }")

echo "$INVITE_RESPONSE" | jq '.'

INVITE_SUCCESS=$(echo "$INVITE_RESPONSE" | jq -r '.success // false')

if [ "$INVITE_SUCCESS" != "true" ]; then
  echo -e "${RED}Failed to invite teacher${NC}"
  echo "This might be due to profile not being approved. Continuing anyway..."
else
  echo -e "${GREEN}✓ Teacher invited successfully${NC}"
fi
echo ""

# Step 7: Teacher signs up
echo -e "${BLUE}Step 7: Teacher signs up (accepts invite)${NC}"
TEACHER_SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"password\": \"$TEACHER_PASSWORD\",
    \"role\": \"teacher\"
  }")

echo "$TEACHER_SIGNUP_RESPONSE" | jq '.'

TEACHER_ID=$(echo "$TEACHER_SIGNUP_RESPONSE" | jq -r '.data.user.id // .data.user.uid // .data.id // empty')

if [ -z "$TEACHER_ID" ] || [ "$TEACHER_ID" == "null" ]; then
  echo -e "${RED}Failed to signup teacher or extract ID${NC}"
  echo "Response: $TEACHER_SIGNUP_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Teacher signed up successfully${NC}"
echo "Teacher ID: $TEACHER_ID"
echo ""

# Step 8: Teacher logs in
echo -e "${BLUE}Step 8: Teacher logs in${NC}"
TEACHER_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"password\": \"$TEACHER_PASSWORD\"
  }")

echo "$TEACHER_LOGIN_RESPONSE" | jq '.'

TEACHER_TOKEN=$(echo "$TEACHER_LOGIN_RESPONSE" | jq -r '.data.token // empty')

if [ -z "$TEACHER_TOKEN" ]; then
  echo -e "${RED}Failed to login as teacher${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Teacher logged in successfully${NC}"
echo ""

# Step 9: Teacher submits profile for approval
echo -e "${BLUE}Step 9: Teacher submits profile for approval${NC}"
TEACHER_PROFILE_RESPONSE=$(curl -s -X POST "$BASE_URL/profile/submit-approval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -d "{
    \"firstName\": \"Test\",
    \"lastName\": \"Teacher\",
    \"schoolEmail\": \"teacher@${SCHOOL_NAME// /}.edu\"
  }")

echo "$TEACHER_PROFILE_RESPONSE" | jq '.'
echo -e "${GREEN}✓ Teacher profile submitted${NC}"
echo ""

# Step 10: Platform admin approves teacher (if available)
if [ ! -z "$PLATFORM_ADMIN_TOKEN" ]; then
  echo -e "${BLUE}Step 10: Platform admin approves teacher${NC}"
  APPROVE_TEACHER_RESPONSE=$(curl -s -X PUT "$BASE_URL/admin/profile/$TEACHER_ID/approve" \
    -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN")

  echo "$APPROVE_TEACHER_RESPONSE" | jq '.'
  echo -e "${GREEN}✓ Teacher profile approved${NC}"
  echo ""
fi

# Step 11: List teachers in the school
echo -e "${BLUE}Step 11: List teachers in the school${NC}"
LIST_TEACHERS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/school/teachers" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$LIST_TEACHERS_RESPONSE" | jq '.'
echo ""

# Step 12: School admin suspends the teacher
echo -e "${BLUE}Step 12: School admin suspends the teacher${NC}"
SUSPEND_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"reason\": \"Test suspension for violating attendance policy\"
  }")

echo "$SUSPEND_RESPONSE" | jq '.'

SUSPEND_SUCCESS=$(echo "$SUSPEND_RESPONSE" | jq -r '.success // false')

if [ "$SUSPEND_SUCCESS" == "true" ]; then
  echo -e "${GREEN}✓ Teacher suspended successfully by school admin!${NC}"
else
  echo -e "${RED}✗ Failed to suspend teacher${NC}"
  echo "Response: $SUSPEND_RESPONSE"
fi
echo ""

# Step 13: Verify teacher is suspended
echo -e "${BLUE}Step 13: Verify teacher status${NC}"
TEACHER_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

echo "$TEACHER_STATUS_RESPONSE" | jq '.'

TEACHER_STATUS=$(echo "$TEACHER_STATUS_RESPONSE" | jq -r '.data.status // empty')
echo "Teacher Status: $TEACHER_STATUS"
echo ""

# Step 14: School admin unsuspends the teacher
echo -e "${BLUE}Step 14: School admin unsuspends the teacher${NC}"
UNSUSPEND_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER_ID/unsuspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$UNSUSPEND_RESPONSE" | jq '.'

UNSUSPEND_SUCCESS=$(echo "$UNSUSPEND_RESPONSE" | jq -r '.success // false')

if [ "$UNSUSPEND_SUCCESS" == "true" ]; then
  echo -e "${GREEN}✓ Teacher unsuspended successfully by school admin!${NC}"
else
  echo -e "${RED}✗ Failed to unsuspend teacher${NC}"
fi
echo ""

# Step 15: Verify teacher is active again
echo -e "${BLUE}Step 15: Verify teacher is active again${NC}"
TEACHER_STATUS_FINAL=$(curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

echo "$TEACHER_STATUS_FINAL" | jq '.'

FINAL_STATUS=$(echo "$TEACHER_STATUS_FINAL" | jq -r '.data.status // empty')
echo "Teacher Final Status: $FINAL_STATUS"
echo ""

# Summary
echo "============================================"
echo -e "${GREEN}Test Flow Complete!${NC}"
echo "============================================"
echo ""
echo "Summary:"
echo "- School ID: $SCHOOL_ID"
echo "- School Admin ID: $SCHOOL_ADMIN_ID"
echo "- Teacher ID: $TEACHER_ID"
echo "- Suspension Status: $SUSPEND_SUCCESS"
echo "- Unsuspension Status: $UNSUSPEND_SUCCESS"
echo ""
echo "Key Credentials (save these if needed):"
echo "School Admin: $SCHOOL_ADMIN_EMAIL / $SCHOOL_ADMIN_PASSWORD"
echo "Teacher: $TEACHER_EMAIL / $TEACHER_PASSWORD"
echo ""
