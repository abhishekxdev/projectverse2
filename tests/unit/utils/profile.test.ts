import {
  isProfileComplete,
  isPublicRoleProfileComplete,
} from '../../../src/utils/profile';
import { USER_ROLES } from '../../../src/config/constants';

describe('Profile Completion Utilities', () => {
  describe('isPublicRoleProfileComplete', () => {
    describe('Teacher role', () => {
      it('should return true when ALL required fields are provided', () => {
        const profile = {
          // Common fields
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          address: '123 Main St',
          country: 'India',
          countryId: 'IN',
          gender: 'Male',
          // Teacher-specific fields
          subjects: ['Mathematics', 'Physics'],
          grades: ['9', '10'],
          gradeLevels: ['Grade 9-10'],
          teachingExperience: '5 years',
          proficiencyLevel: 'Advanced',
          currentSchool: 'Test School',
        };
        expect(isPublicRoleProfileComplete('teacher', profile)).toBe(true);
      });

      it('should return false when firstName is missing', () => {
        const profile = {
          lastName: 'Doe',
          phone: '+1234567890',
          address: '123 Main St',
          country: 'India',
          countryId: 'IN',
          gender: 'Male',
          subjects: ['Mathematics'],
          grades: ['9'],
          gradeLevels: ['Grade 9-10'],
          teachingExperience: '5 years',
          proficiencyLevel: 'Advanced',
          currentSchool: 'Test School',
        };
        expect(isPublicRoleProfileComplete('teacher', profile)).toBe(false);
      });

      it('should return false when subjects are missing', () => {
        const profile = {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          address: '123 Main St',
          country: 'India',
          countryId: 'IN',
          gender: 'Male',
          grades: ['9', '10'],
          gradeLevels: ['Grade 9-10'],
          teachingExperience: '5 years',
          proficiencyLevel: 'Advanced',
          currentSchool: 'Test School',
        };
        expect(isPublicRoleProfileComplete('teacher', profile)).toBe(false);
      });

      it('should return false when any required field is empty string', () => {
        const profile = {
          firstName: '',
          lastName: 'Doe',
          phone: '+1234567890',
          address: '123 Main St',
          country: 'India',
          countryId: 'IN',
          gender: 'Male',
          subjects: ['Mathematics'],
          grades: ['9'],
          gradeLevels: ['Grade 9-10'],
          teachingExperience: '5 years',
          proficiencyLevel: 'Advanced',
          currentSchool: 'Test School',
        };
        expect(isPublicRoleProfileComplete('teacher', profile)).toBe(false);
      });
    });

    describe('School role', () => {
      it('should return true when ALL required fields are provided', () => {
        const profile = {
          // Common fields
          firstName: 'Admin',
          lastName: 'User',
          phone: '+1234567890',
          address: '456 School St',
          country: 'India',
          countryId: 'IN',
          gender: 'Female',
          // School-specific fields
          schoolName: 'Test School',
          schoolAdminRole: 'Principal',
          contactName: 'John Admin',
          contactEmail: 'admin@school.com',
          contactPhone: '+9876543210',
          schoolSize: 'Large',
          establishedYear: 2000,
          principalName: 'Dr. Smith',
          totalTeachers: 50,
          totalStudents: 1000,
        };
        expect(isPublicRoleProfileComplete('school', profile)).toBe(true);
      });

      it('should return false when any common field is missing', () => {
        const profile = {
          // firstName missing
          lastName: 'User',
          phone: '+1234567890',
          address: '456 School St',
          country: 'India',
          countryId: 'IN',
          gender: 'Female',
          schoolName: 'Test School',
          schoolAdminRole: 'Principal',
          contactName: 'John Admin',
          contactEmail: 'admin@school.com',
          contactPhone: '+9876543210',
          schoolSize: 'Large',
          establishedYear: 2000,
          principalName: 'Dr. Smith',
          totalTeachers: 50,
          totalStudents: 1000,
        };
        expect(isPublicRoleProfileComplete('school', profile)).toBe(false);
      });

      it('should return false when school-specific field is missing', () => {
        const profile = {
          firstName: 'Admin',
          lastName: 'User',
          phone: '+1234567890',
          address: '456 School St',
          country: 'India',
          countryId: 'IN',
          gender: 'Female',
          // schoolName missing
          schoolAdminRole: 'Principal',
          contactName: 'John Admin',
          contactEmail: 'admin@school.com',
          contactPhone: '+9876543210',
          schoolSize: 'Large',
          establishedYear: 2000,
          principalName: 'Dr. Smith',
          totalTeachers: 50,
          totalStudents: 1000,
        };
        expect(isPublicRoleProfileComplete('school', profile)).toBe(false);
      });
    });

    it('should return false for empty profile', () => {
      expect(isPublicRoleProfileComplete('teacher', {})).toBe(false);
      expect(isPublicRoleProfileComplete('school', {})).toBe(false);
    });

    it('should return false for null/undefined profile', () => {
      expect(isPublicRoleProfileComplete('teacher', null as any)).toBe(false);
      expect(isPublicRoleProfileComplete('school', undefined as any)).toBe(
        false
      );
    });
  });

  describe('isProfileComplete', () => {
    describe('School Teacher role', () => {
      it('should return true when ALL required fields are provided', () => {
        const profile = {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          address: '123 Main St',
          country: 'USA',
          countryId: 'US',
          gender: 'Male',
          subjects: ['Mathematics'],
          grades: ['9'],
          gradeLevels: ['Grade 9-10'],
          teachingExperience: '5 years',
          proficiencyLevel: 'Advanced',
          currentSchool: 'Test School',
        };
        expect(isProfileComplete(USER_ROLES.SCHOOL_TEACHER, profile)).toBe(
          true
        );
      });

      it('should return false when subjects are missing', () => {
        const profile = {
          grades: ['9'],
        };
        expect(isProfileComplete(USER_ROLES.SCHOOL_TEACHER, profile)).toBe(
          false
        );
      });
    });

    describe('Individual role', () => {
      it('should return true when ALL required fields are provided', () => {
        const profile = {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567890',
          address: '456 Oak St',
          country: 'USA',
          countryId: 'US',
          gender: 'Female',
          subjects: ['Mathematics'],
          grades: ['9'],
          gradeLevels: ['Grade 9-10'],
          teachingExperience: '3 years',
          proficiencyLevel: 'Intermediate',
          currentSchool: 'Test School',
        };
        expect(isProfileComplete(USER_ROLES.INDIVIDUAL, profile)).toBe(true);
      });

      it('should return false when requirements are not met', () => {
        const profile = {
          firstName: 'John',
        };
        expect(isProfileComplete(USER_ROLES.INDIVIDUAL, profile)).toBe(false);
      });
    });

    describe('School Admin role', () => {
      it('should return true when ALL required fields are provided', () => {
        const profile = {
          firstName: 'Admin',
          lastName: 'User',
          phone: '+1234567890',
          address: '789 School St',
          country: 'USA',
          countryId: 'US',
          gender: 'Male',
          schoolName: 'Test School',
          schoolAdminRole: 'Principal',
          contactName: 'John Admin',
          contactEmail: 'admin@school.com',
          contactPhone: '+1234567890',
          schoolSize: 'Large',
          establishedYear: 1950,
          principalName: 'Dr. Principal',
          totalTeachers: 50,
          totalStudents: 1000,
        };
        expect(isProfileComplete(USER_ROLES.SCHOOL_ADMIN, profile)).toBe(true);
      });

      it('should return false when requirements are not met', () => {
        const profile = {
          schoolName: 'Test School',
        };
        expect(isProfileComplete(USER_ROLES.SCHOOL_ADMIN, profile)).toBe(false);
      });
    });

    describe('Platform Admin role', () => {
      it('should always return true', () => {
        expect(isProfileComplete(USER_ROLES.PLATFORM_ADMIN, {})).toBe(true);
        expect(
          isProfileComplete(USER_ROLES.PLATFORM_ADMIN, { name: 'Admin' })
        ).toBe(true);
      });
    });
  });
});
