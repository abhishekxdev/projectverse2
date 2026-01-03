import {
  USER_ROLES,
  USER_TIERS,
  USER_STATUS,
  TIER_LIMITS,
  GRADE_LEVELS,
  SUBJECTS,
  SCHOOL_ADMIN_ROLES,
} from '../config/constants';

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type UserTier = (typeof USER_TIERS)[keyof typeof USER_TIERS];
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];
export type GradeLevel = (typeof GRADE_LEVELS)[number];
export type Subject = (typeof SUBJECTS)[number];
export type SchoolAdminRole = (typeof SCHOOL_ADMIN_ROLES)[number];

export type ProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

// Computed/derived types (not stored in DB, computed from status field)
export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface TeacherCertificate {
  id: string;
  name: string;
  fileName: string;
  uploadDate: string;
  type: 'optional' | 'earned';
}

export interface TeacherBadge {
  id: string;
  name: string;
  description: string;
  earnedDate: string;
  imageUrl: string;
}

export interface TeacherAssessment {
  id: string;
  title: string;
  status: 'completed' | 'in_progress';
  score: number;
  attempts: number;
  lastAttempt: string;
}

/**
 * Profile review metadata for approval workflow
 */
export interface ProfileReviewMetadata {
  submittedBy?: string;
  submittedAt?: any; // FirebaseFirestore.Timestamp
  approvedBy?: string;
  approvedByRole?: string;
  approvedAt?: any; // FirebaseFirestore.Timestamp
  rejectedBy?: string;
  rejectedByRole?: string;
  rejectedAt?: any; // FirebaseFirestore.Timestamp
  rejectionReason?: string;
  lastActionBy?: string;
  lastActionAt?: any; // FirebaseFirestore.Timestamp
}

/**
 * Suspension metadata
 */
export interface SuspensionMetadata {
  suspendedBy?: string;
  suspendedAt?: any; // FirebaseFirestore.Timestamp
  reason?: string;
  originalStatus?: UserStatus; // Preserve original status for restoration
}

/**
 * Comprehensive user profile type used throughout the application
 * This is the single source of truth for user data structure
 */
export interface UserProfile {
  // Identity fields
  id?: string;
  email: string;
  displayName?: string;
  username?: string;

  // Role and tier
  role?: UserRole;
  tier?: UserTier;
  status: UserStatus;

  // Basic profile information
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  profilePhoto?: string;
  country?: string;
  countryId?: string;
  gender?: string;

  // School association
  schoolId?: string | null;
  profileCompleted?: boolean;

  // Teacher-specific fields
  subjects?: Subject[];
  grades?: string[];
  gradeLevels?: GradeLevel[];
  competencyFocus?: string[];
  teachingExperience?: string;
  proficiencyLevel?: ProficiencyLevel;
  currentSchool?: string;
  schoolEmail?: string; // Official school email for teachers
  staffId?: string; // Staff ID or employment proof (S3 link or file name)
  aspiration?: string; // Career aspiration
  certificates?: TeacherCertificate[];

  // School Admin specific fields
  schoolAdminRole?: SchoolAdminRole;
  officialSchoolEmail?: string; // Official school email for admins
  adminRole?: SchoolAdminRole; // Role of the admin (Principal, etc.)
  schoolAddress?: string; // School address
  logo?: string; // School logo (S3 link or base64)

  // Activity and progress
  joinDate?: string;
  totalPdCompleted?: number;
  totalBadgesEarned?: number;
  pdHours?: number;
  latestPd?: string;
  lastActive?: string;
  badges?: TeacherBadge[];
  assessments?: TeacherAssessment[];

  // System fields
  emailVerified?: boolean;
  suspensionNote?: string;
  usage?: Record<string, number>;
  profile?: Record<string, unknown>; // Legacy nested profile object

  // Approval workflow metadata
  profileReview?: ProfileReviewMetadata;
  suspension?: SuspensionMetadata | null;

  // Timestamps
  createdAt?: any; // FirebaseFirestore.Timestamp
  updatedAt?: any; // FirebaseFirestore.Timestamp
}

export interface UserUsageCounters {
  assessmentsTakenMonth: number;
  tutorMessagesMonth: number;
}

export interface TierInfo {
  tier: UserTier;
  limits: (typeof TIER_LIMITS)[UserTier];
}

export interface UserDocument {
  id: string;
  uid: string;
  role: UserRole;
  tier: UserTier;
  email: string;
  status: UserStatus;
  isSuspended?: boolean; // Computed field (status === 'suspended'), not stored in DB
  schoolId?: string | null;
  profile?: UserProfile;
  profileCompleted?: boolean;
  usage?: Partial<UserUsageCounters>;
  createdAt?: any;
  updatedAt?: any;
}
