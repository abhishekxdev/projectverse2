import { UserRole, UserTier, UserStatus } from '../../src/types/user.types';

/**
 * Test user configurations for different scenarios
 */
export const testUsers = {
  individual: {
    email: 'individual@test.com',
    displayName: 'Test Individual',
    role: 'individual' as UserRole,
    tier: 'free' as UserTier,
    schoolId: null,
    status: 'active' as UserStatus,
  },
  schoolTeacher: {
    email: 'teacher@test.com',
    displayName: 'Test Teacher',
    role: 'school_teacher' as UserRole,
    tier: 'school' as UserTier,
    schoolId: 'school_alpha',
    status: 'active' as UserStatus,
  },
  schoolAdmin: {
    email: 'schooladmin@test.com',
    displayName: 'Test School Admin',
    role: 'school_admin' as UserRole,
    tier: 'school' as UserTier,
    schoolId: 'school_alpha',
    status: 'active' as UserStatus,
  },
  platformAdmin: {
    email: 'platformadmin@test.com',
    displayName: 'Test Platform Admin',
    role: 'platform_admin' as UserRole,
    tier: 'school' as UserTier,
    schoolId: null,
    status: 'active' as UserStatus,
  },
};

/**
 * Valid registration payloads for testing POST /api/auth/register
 */
export const validRegistrationPayloads = {
  basic: {
    firebaseUid: '', // Will be set dynamically
    email: 'newuser@test.com',
    displayName: 'New User',
  },
  withProfile: {
    firebaseUid: '', // Will be set dynamically
    email: 'profileuser@test.com',
    displayName: 'Profile User',
    profile: {
      subjects: ['math', 'science'],
      grades: ['9', '10'],
      competencyFocus: ['problem-solving'],
    },
  },
};

/**
 * Invalid payloads for testing validation
 */
export const invalidRegistrationPayloads = {
  missingUid: {
    email: 'test@test.com',
    displayName: 'Test User',
  },
  invalidEmail: {
    firebaseUid: 'some-uid',
    email: 'not-an-email',
    displayName: 'Test User',
  },
  shortDisplayName: {
    firebaseUid: 'some-uid',
    email: 'test@test.com',
    displayName: 'A', // Too short (min 2 chars)
  },
  extraFields: {
    firebaseUid: 'some-uid',
    email: 'test@test.com',
    displayName: 'Test User',
    unknownField: 'should fail strict validation',
  },
};

/**
 * Invalid auth headers for testing auth middleware
 */
export const invalidAuthHeaders = {
  missing: undefined,
  empty: '',
  noBearer: 'some-token-without-bearer',
  malformedBearer: 'Bearer',
  invalidToken: 'Bearer invalid-token-string',
};
