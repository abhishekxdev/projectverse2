# Manual Testing Guide: School Admin Suspension Flow

This guide provides step-by-step instructions to test the complete school admin suspension flow using curl commands.

## Prerequisites

1. Server running (start with `npm run dev` or use production URL)
2. `curl` and `jq` installed
3. Platform admin account exists

## Environment Variables

```bash
# Set these variables for your environment
export BASE_URL="http://localhost:3000/api"
export PLATFORM_ADMIN_EMAIL="platformadmin@gurucool.xyz"
export PLATFORM_ADMIN_PASSWORD="Admin123!"

# Generate unique emails for testing
export TIMESTAMP=$(date +%s)
export SCHOOL_NAME="Test School $TIMESTAMP"
export SCHOOL_ADMIN_EMAIL="schooladmin${TIMESTAMP}@test.com"
export SCHOOL_ADMIN_PASSWORD="Test123!"
export TEACHER_EMAIL="teacher${TIMESTAMP}@test.com"
export TEACHER_PASSWORD="Test123!"
```

## Step-by-Step Testing

### 1. Register a New School

```bash
SCHOOL_RESPONSE=$(curl -s -X POST "$BASE_URL/schools/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$SCHOOL_NAME\",
    \"adminEmail\": \"$SCHOOL_ADMIN_EMAIL\",
    \"seats\": { \"total\": 50 }
  }")

echo "$SCHOOL_RESPONSE" | jq '.'

# Extract IDs
export SCHOOL_ID=$(echo "$SCHOOL_RESPONSE" | jq -r '.data.school.id')
export SCHOOL_ADMIN_ID=$(echo "$SCHOOL_RESPONSE" | jq -r '.data.adminUser.id')

echo "School ID: $SCHOOL_ID"
echo "School Admin ID: $SCHOOL_ADMIN_ID"
```

**Expected Result:** School and admin account created successfully.

---

### 2. Login as School Admin

```bash
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$SCHOOL_ADMIN_EMAIL\",
    \"password\": \"$SCHOOL_ADMIN_PASSWORD\"
  }")

echo "$ADMIN_LOGIN" | jq '.'

export ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.token')
echo "Admin Token: $ADMIN_TOKEN"
```

**Expected Result:** JWT token received.

---

### 3. Submit School Admin Profile for Approval

```bash
curl -s -X POST "$BASE_URL/profile/submit-approval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"firstName\": \"Admin\",
    \"lastName\": \"User\",
    \"schoolEmail\": \"admin@testschool.edu\"
  }" | jq '.'
```

**Expected Result:** Profile submitted successfully.

---

### 4. Login as Platform Admin

```bash
PLATFORM_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PLATFORM_ADMIN_EMAIL\",
    \"password\": \"$PLATFORM_ADMIN_PASSWORD\"
  }")

echo "$PLATFORM_LOGIN" | jq '.'

export PLATFORM_TOKEN=$(echo "$PLATFORM_LOGIN" | jq -r '.data.token')
echo "Platform Admin Token: $PLATFORM_TOKEN"
```

**Expected Result:** Platform admin JWT token received.

---

### 5. Approve School Admin Profile

```bash
curl -s -X PUT "$BASE_URL/admin/profile/$SCHOOL_ADMIN_ID/approve" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq '.'
```

**Expected Result:** School admin profile approved.

---

### 6. Teacher Signup

```bash
TEACHER_SIGNUP=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"password\": \"$TEACHER_PASSWORD\",
    \"role\": \"school_teacher\",
    \"schoolId\": \"$SCHOOL_ID\"
  }")

echo "$TEACHER_SIGNUP" | jq '.'

export TEACHER_ID=$(echo "$TEACHER_SIGNUP" | jq -r '.data.user.uid // .data.id')
echo "Teacher ID: $TEACHER_ID"
```

**Expected Result:** Teacher account created.

---

### 7. Teacher Login

```bash
TEACHER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"password\": \"$TEACHER_PASSWORD\"
  }")

echo "$TEACHER_LOGIN" | jq '.'

export TEACHER_TOKEN=$(echo "$TEACHER_LOGIN" | jq -r '.data.token')
echo "Teacher Token: $TEACHER_TOKEN"
```

**Expected Result:** Teacher JWT token received.

---

### 8. Teacher Submits Profile

```bash
curl -s -X POST "$BASE_URL/profile/submit-approval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -d "{
    \"firstName\": \"Test\",
    \"lastName\": \"Teacher\",
    \"schoolEmail\": \"teacher@testschool.edu\"
  }" | jq '.'
```

**Expected Result:** Teacher profile submitted.

---

### 9. Approve Teacher Profile

```bash
curl -s -X PUT "$BASE_URL/admin/profile/$TEACHER_ID/approve" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq '.'
```

**Expected Result:** Teacher profile approved.

---

### 10. List Teachers in School

```bash
curl -s -X GET "$BASE_URL/admin/school/teachers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:** List of teachers including the newly created one.

---

### 11. ⭐ School Admin Suspends Teacher

**This is the new feature being tested!**

```bash
SUSPEND_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"reason\": \"Test suspension for violating school attendance policy\"
  }")

echo "$SUSPEND_RESPONSE" | jq '.'
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "id": "teacher-id",
    "status": "suspended",
    "suspension": {
      "suspendedBy": "admin-id",
      "suspendedAt": "2026-01-03T...",
      "reason": "Test suspension for violating school attendance policy",
      "originalStatus": "active"
    }
  }
}
```

---

### 12. Verify Teacher is Suspended

```bash
curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TEACHER_TOKEN" | jq '.data.status'
```

**Expected Result:** `"suspended"`

---

### 13. ⭐ School Admin Unsuspends Teacher

```bash
UNSUSPEND_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER_ID/unsuspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$UNSUSPEND_RESPONSE" | jq '.'
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "id": "teacher-id",
    "status": "active"
  }
}
```

---

### 14. Verify Teacher is Active Again

```bash
curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TEACHER_TOKEN" | jq '.data.status'
```

**Expected Result:** `"active"`

---

## Testing Edge Cases

### Test 1: Cross-School Suspension (Should Fail)

Create a second school and try to suspend its teacher:

```bash
# Register another school
SCHOOL2_RESPONSE=$(curl -s -X POST "$BASE_URL/schools/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Other School\",
    \"adminEmail\": \"admin2@test.com\",
    \"seats\": { \"total\": 30 }
  }")

SCHOOL2_ID=$(echo "$SCHOOL2_RESPONSE" | jq -r '.data.school.id')

# Create teacher in school 2
TEACHER2_SIGNUP=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"teacher2@test.com\",
    \"password\": \"Test123!\",
    \"role\": \"school_teacher\",
    \"schoolId\": \"$SCHOOL2_ID\"
  }")

TEACHER2_ID=$(echo "$TEACHER2_SIGNUP" | jq -r '.data.user.uid // .data.id')

# Try to suspend teacher from school 2 using school 1 admin token
curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER2_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"reason\": \"Cross-school suspension attempt\"
  }" | jq '.'
```

**Expected Result:** 403 Forbidden - "You can only suspend teachers in your school"

---

### Test 2: Insufficient Reason (Should Fail)

```bash
curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"reason\": \"Short\"
  }" | jq '.'
```

**Expected Result:** 400 Bad Request - "Suspension reason must be at least 10 characters"

---

### Test 3: Missing Reason (Should Fail)

```bash
curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{}" | jq '.'
```

**Expected Result:** 400 Bad Request - Validation error

---

### Test 4: Non-Admin Suspension Attempt (Should Fail)

```bash
# Try to suspend using teacher token
curl -s -X POST "$BASE_URL/admin/school/teachers/$TEACHER_ID/suspend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -d "{
    \"reason\": \"Unauthorized suspension attempt\"
  }" | jq '.'
```

**Expected Result:** 403 Forbidden - Insufficient permissions

---

## Automated Test Script

For convenience, run the complete automated test:

```bash
chmod +x test-suspension-flow.sh
./test-suspension-flow.sh
```

## Cleanup (Optional)

To clean up test data, you can delete the created users and schools from Firebase Console or use the appropriate delete endpoints if available.

## Troubleshooting

### Issue: "Platform admin not found"
**Solution:** Create a platform admin first or run the seed script:
```bash
npm run seed
```

### Issue: "School association required"
**Solution:** Ensure the school admin profile has been approved and has the correct schoolId.

### Issue: "Cannot read properties of undefined"
**Solution:** Verify all environment variables are set correctly and server is running.

### Issue: "Teacher not found"
**Solution:** Ensure teacher signup was successful and TEACHER_ID is correctly extracted.

## Success Criteria

✅ School admin can suspend teacher in their school
✅ School admin can unsuspend teacher in their school
✅ School admin cannot suspend teachers from other schools
✅ Suspension requires a reason (10-500 characters)
✅ Suspended teachers cannot be unsuspended if suspended due to school suspension
✅ Audit logs are created for all suspension actions
✅ Notifications are sent to teachers

---

**Last Updated:** January 3, 2026
**Feature:** School Admin Suspension System
