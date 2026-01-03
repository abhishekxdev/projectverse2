# School Admin Suspension Feature

## Overview

School admins can now suspend and unsuspend teachers within their own school. This provides school-level control over teacher access while maintaining proper authorization boundaries.

## Features

### ✅ School Admin Can:
- Suspend teachers in their school
- Unsuspend teachers they suspended
- View audit trail of suspension actions

### ❌ School Admin Cannot:
- Suspend teachers from other schools
- Unsuspend teachers suspended due to school-wide suspension (requires platform admin)
- Suspend themselves

## API Endpoints

### 1. Suspend a Teacher

**Endpoint:** `POST /api/admin/school/teachers/:id/suspend`

**Authorization:** School Admin only

**Request:**
```json
{
  "reason": "Violating school policy regarding attendance"
}
```

**Validation:**
- Reason must be 10-500 characters
- Teacher must belong to the school admin's school
- Teacher cannot be suspended due to school suspension

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "teacher-id",
    "email": "teacher@school.edu",
    "role": "school_teacher",
    "status": "suspended",
    "schoolId": "school-id",
    "suspension": {
      "suspendedBy": "admin-id",
      "suspendedAt": "2026-01-03T22:30:00Z",
      "reason": "Violating school policy regarding attendance",
      "originalStatus": "active"
    }
  }
}
```

**Error Responses:**

- **400 Bad Request:** Missing or invalid reason
  ```json
  {
    "success": false,
    "error": {
      "code": "REASON_REQUIRED",
      "message": "Suspension reason must be at least 10 characters"
    }
  }
  ```

- **403 Forbidden:** Attempting to suspend teacher from another school
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "You can only suspend teachers in your school"
    }
  }
  ```

- **404 Not Found:** Teacher not found
  ```json
  {
    "success": false,
    "error": {
      "code": "TEACHER_NOT_FOUND",
      "message": "Teacher not found"
    }
  }
  ```

### 2. Unsuspend a Teacher

**Endpoint:** `POST /api/admin/school/teachers/:id/unsuspend`

**Authorization:** School Admin only

**Request:** No body required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "teacher-id",
    "email": "teacher@school.edu",
    "role": "school_teacher",
    "status": "active",
    "schoolId": "school-id"
  }
}
```

**Error Responses:**

- **403 Forbidden:** Teacher suspended due to school suspension
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "This teacher was suspended due to school suspension. You cannot unsuspend them directly. Contact platform admin."
    }
  }
  ```

- **403 Forbidden:** Attempting to unsuspend teacher from another school
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "You can only unsuspend teachers in your school"
    }
  }
  ```

## Usage Examples

### Suspend a Teacher

```bash
curl -X POST http://localhost:3000/api/admin/school/teachers/TEACHER_ID/suspend \
  -H "Authorization: Bearer SCHOOL_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Repeated failure to submit required documentation"
  }'
```

### Unsuspend a Teacher

```bash
curl -X POST http://localhost:3000/api/admin/school/teachers/TEACHER_ID/unsuspend \
  -H "Authorization: Bearer SCHOOL_ADMIN_TOKEN"
```

## Authorization Flow

1. **Authentication:** Request must include valid JWT token
2. **Role Check:** User must be `school_admin` or `platform_admin`
3. **School Association:** Middleware validates school context
4. **Teacher Verification:** System checks teacher belongs to admin's school
5. **Action Execution:** Suspension/unsuspension performed with audit logging

## Audit Trail

All suspension actions are logged in the `suspension_audit_logs` collection:

```json
{
  "entityType": "user",
  "entityId": "teacher-id",
  "action": "suspend",
  "actorId": "admin-id",
  "reason": "Violating school policy",
  "timestamp": "2026-01-03T22:30:00Z"
}
```

## Notification System

When a teacher is suspended:
1. System triggers suspension notification
2. Teacher receives email about suspension
3. Teacher account access is immediately blocked

When unsuspended:
1. System triggers unsuspension notification
2. Teacher receives email about reinstatement
3. Teacher account access is restored

## Technical Implementation

### Files Modified

1. **src/controllers/schoolAdmin.controller.ts**
   - Added `suspendTeacher()` function
   - Added `unsuspendTeacher()` function

2. **src/routes/schoolAdmin.routes.ts**
   - Added `POST /teachers/:id/suspend` route
   - Added `POST /teachers/:id/unsuspend` route

3. **src/schemas/admin.schema.ts**
   - Added `suspendTeacherSchema` validation

### Key Functions

```typescript
// Verify teacher belongs to school
const teacher = await userRepository.getUserById(id);
const schoolId = resolveSchoolIdOrThrow(req);
if (teacher.schoolId !== schoolId) {
  throw new ForbiddenError('You can only suspend teachers in your school');
}

// Perform suspension
await suspensionService.suspendTeacher({
  userId: id,
  actorId: req.user.id,
  reason: reason.trim(),
});
```

## Testing

Run integration tests:

```bash
# Start Firebase emulators
npm run test:emulators

# Run suspension tests
npm run test:e2e -- --testPathPattern=schoolAdmin.suspension
```

Test scenarios covered:
- ✅ Suspend teacher in same school
- ✅ Unsuspend teacher in same school
- ✅ Reject cross-school suspension
- ✅ Reject cross-school unsuspension
- ✅ Reject suspension without reason
- ✅ Reject suspension with short reason
- ✅ Reject unsuspending school-suspended teacher
- ✅ Reject suspension by non-admin

## Security Considerations

1. **Authorization Boundaries:** School admins cannot affect teachers outside their school
2. **School-Wide Protection:** Teachers suspended due to school suspension can only be unsuspended by platform admin
3. **Audit Logging:** All actions logged with actor, timestamp, and reason
4. **Reason Requirement:** Mandatory suspension reason ensures accountability
5. **Status Preservation:** Original status saved for proper restoration

## Comparison: Platform Admin vs School Admin

| Feature | Platform Admin | School Admin |
|---------|---------------|--------------|
| Suspend teachers | ✅ Any teacher | ✅ Own school only |
| Unsuspend teachers | ✅ Any teacher | ✅ Own school only* |
| Suspend schools | ✅ Yes | ❌ No |
| Override school suspension | ✅ Yes | ❌ No |
| View all audit logs | ✅ Yes | ❌ No |

*Cannot unsuspend teachers suspended due to school-wide suspension

## Future Enhancements

- [ ] Add suspension duration (temporary suspensions)
- [ ] Add bulk suspension/unsuspension
- [ ] Add suspension appeal workflow
- [ ] Add suspension analytics dashboard
- [ ] Add email templates for suspension notices
- [ ] Add suspension history view for school admins
