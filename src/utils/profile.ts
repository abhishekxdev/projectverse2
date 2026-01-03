import { UserRole } from '../types/user.types';
import { USER_ROLES } from '../config/constants';

/**
 * Determines if a user profile is complete based on their role
 * @param role - The user's role
 * @param profile - The user's profile object
 * @returns boolean indicating if ALL onboarding fields are complete
 */
export function isProfileComplete(
  role: UserRole,
  profile: Record<string, unknown>
): boolean {
  if (!profile) {
    return false;
  }

  switch (role) {
    case USER_ROLES.SCHOOL_TEACHER: {
      // Use the public role checker for teacher requirements
      return isPublicRoleProfileComplete('teacher', profile);
    }

    case USER_ROLES.SCHOOL_ADMIN: {
      // Use the public role checker for school admin requirements
      return isPublicRoleProfileComplete('school', profile);
    }

    case USER_ROLES.PLATFORM_ADMIN: {
      // Platform admin profiles are considered complete by default
      return true;
    }

    default: {
      // For any unknown role, require at least some profile data
      return Object.keys(profile).length > 0;
    }
  }
}

/**
 * Determines profile completion for public role types used in onboarding
 * @param role - The public role ('teacher' or 'school')
 * @param profile - The profile object
 * @returns boolean indicating if ALL onboarding fields are complete
 */
export function isPublicRoleProfileComplete(
  role: 'teacher' | 'school',
  profile: Record<string, unknown>
): boolean {
  if (!profile) {
    return false;
  }

  // Helper function to check if a field exists and has meaningful content
  const hasValue = (value: unknown): boolean => {
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !isNaN(value);
    return true;
  };

  // Note: firstName/lastName are only required for teachers, not school admins
  // School admins have different required fields per payload-example.md

  switch (role) {
    case 'teacher': {
      // All teacher-specific required fields (based on payload-example.md)
      const teacherRequiredFields = [
        'firstName', // Teacher's first name (required)
        'lastName', // Teacher's last name (required)
        'schoolEmail', // Official school email (required)
        'teachingExperience', // Experience range (required)
        'subjects', // Teaching subjects (required, 1-5 items)
        'gradeLevels', // Grade levels (required, at least 1)
        'certificates', // Certificates (required, S3 link or file name)
      ];

      // Check all teacher fields
      for (const field of teacherRequiredFields) {
        if (!hasValue(profile[field])) {
          return false;
        }
      }

      // Additional validation for teacher arrays
      const subjects = profile.subjects as string[] | undefined;
      const gradeLevels = profile.gradeLevels as string[] | undefined;

      // Validate subjects: 1-5 items
      if (!subjects || !Array.isArray(subjects) || subjects.length === 0 || subjects.length > 5) {
        return false;
      }

      // Validate gradeLevels: at least 1 item
      if (!gradeLevels || !Array.isArray(gradeLevels) || gradeLevels.length === 0) {
        return false;
      }

      // Validate schoolEmail format
      const schoolEmail = profile.schoolEmail as string | undefined;
      if (!schoolEmail || typeof schoolEmail !== 'string' || !schoolEmail.includes('@')) {
        return false;
      }

      // All required fields are valid
      return true;
    }

    case 'school': {
      // All school admin required fields (based on payload-example.md)
      const schoolRequiredFields = [
        'schoolName', // Name of the school (required)
        'officialSchoolEmail', // Official school email (required)
        'adminRole', // Role of the admin (required, checking both adminRole and schoolAdminRole for backward compatibility)
        'countryId', // Country (required)
        'phone', // Phone number (required)
        'schoolAddress', // School address (required)
      ];

      // Check all school fields
      for (const field of schoolRequiredFields) {
        // Special handling for adminRole vs schoolAdminRole
        if (field === 'adminRole') {
          const adminRole = profile.adminRole as string | undefined;
          const schoolAdminRole = profile.schoolAdminRole as string | undefined;
          if (!hasValue(adminRole) && !hasValue(schoolAdminRole)) {
            return false;
          }
        } else if (!hasValue(profile[field])) {
          return false;
        }
      }

      // Additional validation for school-specific requirements
      const schoolName = profile.schoolName as string | undefined;
      const officialSchoolEmail = profile.officialSchoolEmail as string | undefined;
      const phone = profile.phone as string | undefined;

      return !!(
        schoolName &&
        schoolName.length >= 2 &&
        officialSchoolEmail &&
        typeof officialSchoolEmail === 'string' &&
        officialSchoolEmail.includes('@') &&
        phone &&
        phone.length >= 10
      );
    }

    default:
      return false;
  }
}
