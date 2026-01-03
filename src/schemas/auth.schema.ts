import { z } from 'zod';
import { GRADE_LEVELS, SUBJECTS, SCHOOL_ADMIN_ROLES } from '../config/constants';

const allowedRoles = ['teacher', 'school'] as const;
const gradeLevelsEnum = z.enum(GRADE_LEVELS);
const subjectsEnum = z.enum(SUBJECTS);
const schoolAdminRolesEnum = z.enum(SCHOOL_ADMIN_ROLES);

export const userProfileSchema = z
  .object({
    subjects: z.array(z.string()).optional(),
    grades: z.array(z.string()).optional(),
    competencyFocus: z.array(z.string()).optional(),
  })
  .strict();

export const registrationSchema = z
  .object({
    firebaseUid: z.string().min(1),
    email: z.string().email(),
    displayName: z.string().min(2),
    profile: userProfileSchema.optional(),
    schoolId: z.string().min(1).optional(), // Optional: Include to join a school (requires admin approval)
  })
  .strict();

export const profileUpdateSchema = userProfileSchema.partial().strict();

export const backendSignupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(allowedRoles),
    displayName: z.string().min(2).optional(),
    profile: userProfileSchema.optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export const onboardingProfileSchema = z
  .object({
    role: z.enum(allowedRoles),
    profile: z.object({
      // Common fields
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      profilePhoto: z.string().optional(),
      country: z.string().optional(),
      countryId: z.string().optional(),
      gender: z.string().optional(),

      // Teacher-specific fields
      schoolEmail: z.string().email().optional(), // Official school email
      schoolId: z.string().optional(), // Selected school
      subjects: z.array(subjectsEnum).min(1).max(5).optional(), // 1-5 subjects
      grades: z.array(z.string()).min(1).optional(),
      gradeLevels: z.array(gradeLevelsEnum).min(1).optional(), // At least 1 grade level
      yearsExperience: z.number().int().nonnegative().optional(),
      teachingExperience: z.string().optional(), // Experience range (e.g., "0-2", "3-5")
      competencyFocus: z.array(z.string()).optional(),
      proficiencyLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(), // Now optional
      currentSchool: z.string().optional(),
      staffId: z.string().optional(), // Staff ID or employment proof
      certificates: z.string().optional(), // S3 link or file name for uploaded certificates
      aspiration: z.string().optional(), // Career aspiration

      // School admin-specific fields
      schoolName: z.string().min(2).optional(),
      officialSchoolEmail: z.string().email().optional(), // Official school email for admins
      adminRole: schoolAdminRolesEnum.optional(), // Role of the admin
      schoolAdminRole: schoolAdminRolesEnum.optional(), // Keep for backward compatibility
      contactName: z.string().min(2).optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      schoolAddress: z.string().optional(), // School address
      schoolSize: z.string().optional(),
      establishedYear: z.number().int().optional(),
      principalName: z.string().optional(),
      totalTeachers: z.number().int().optional(),
      totalStudents: z.number().int().optional(),
      logo: z.string().optional(), // School logo
    }),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.role === 'teacher') {
      // Required fields for teacher
      if (!val.profile.firstName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'firstName is required for teacher onboarding',
          path: ['profile', 'firstName'],
        });
      }
      if (!val.profile.lastName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'lastName is required for teacher onboarding',
          path: ['profile', 'lastName'],
        });
      }
      if (!val.profile.schoolEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'schoolEmail is required for teacher onboarding',
          path: ['profile', 'schoolEmail'],
        });
      }
      if (!val.profile.teachingExperience) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'teachingExperience is required for teacher onboarding',
          path: ['profile', 'teachingExperience'],
        });
      }
      if (!val.profile.subjects || val.profile.subjects.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'subjects are required for teacher onboarding (1-5 items)',
          path: ['profile', 'subjects'],
        });
      }
      if (!val.profile.gradeLevels || val.profile.gradeLevels.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'gradeLevels are required for teacher onboarding (at least 1)',
          path: ['profile', 'gradeLevels'],
        });
      }
      if (!val.profile.certificates) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'certificates are required for teacher onboarding',
          path: ['profile', 'certificates'],
        });
      }
    }

    if (val.role === 'school') {
      // Required fields for school admin
      if (!val.profile.schoolName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'schoolName is required for school onboarding',
          path: ['profile', 'schoolName'],
        });
      }
      if (!val.profile.officialSchoolEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'officialSchoolEmail is required for school onboarding',
          path: ['profile', 'officialSchoolEmail'],
        });
      }
      if (!val.profile.adminRole && !val.profile.schoolAdminRole) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'adminRole is required for school onboarding',
          path: ['profile', 'adminRole'],
        });
      }
      if (!val.profile.countryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'countryId is required for school onboarding',
          path: ['profile', 'countryId'],
        });
      }
      if (!val.profile.phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'phone is required for school onboarding',
          path: ['profile', 'phone'],
        });
      }
      if (!val.profile.schoolAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'schoolAddress is required for school onboarding',
          path: ['profile', 'schoolAddress'],
        });
      }
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type BackendSignupInput = z.infer<typeof backendSignupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
