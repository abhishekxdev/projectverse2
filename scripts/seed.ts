import * as dotenv from 'dotenv';
dotenv.config();

import { firestore } from 'firebase-admin';

import { auth, db } from '../src/config/firebase';
import {
  USER_ROLES,
  USER_STATUS,
  USER_TIERS,
  CREDENTIAL_STATUS,
  CREDENTIAL_TYPES,
  CREDENTIAL_VISIBILITY,
} from '../src/config/constants';
import type {
  UserRole,
  UserStatus,
  UserTier,
  GradeLevel,
  Subject,
  SchoolAdminRole,
} from '../src/types/user.types';
import type {
  SchoolStatus,
  SchoolVerificationStatus,
} from '../src/types/school.types';
import {
  NOTIFICATION_TYPES,
  type NotificationMetadata,
  type NotificationType,
} from '../src/types/notification.types';
import type {
  ProfileReviewMetadata,
  SuspensionMetadata,
} from '../src/repositories/user.repository';
import type {
  SmartCredential,
  CredentialMetadata,
} from '../src/types/growth.types';

type SeedUser = {
  uid: string;
  email: string;
  displayName: string;
  password?: string;
  role: UserRole;
  tier: UserTier;
  schoolId: string | null;
  status: UserStatus;
  profileCompleted?: boolean;
  // Profile fields
  firstName?: string;
  lastName?: string;
  phone?: string;
  subjects?: Subject[];
  gradeLevels?: GradeLevel[];
  teachingExperience?: string;
  country?: string;
  // School admin specific
  schoolAdminRole?: SchoolAdminRole;
  adminRole?: SchoolAdminRole;
  officialSchoolEmail?: string;
  // Teacher specific
  schoolEmail?: string;
  staffId?: string;
  aspiration?: string;
  profileReview?: Partial<ProfileReviewMetadata>;
};

type SeedSchool = {
  id: string;
  name: string;
  adminId: string;
  adminEmail: string;
  teacherLimit: number;
  status: SchoolStatus;
  verificationStatus: SchoolVerificationStatus;
  contactEmail: string;
  seats: { total: number; used: number };
  admins: string[];
};

type SeedNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  isRead?: boolean;
  createdAt: FirebaseFirestore.Timestamp;
};

type SeedCredential = {
  id: string;
  teacherId: string;
  type: SmartCredential['type'];
  name: string;
  trackId: string | null;
  badgeId: string | null;
  competencyKey?: string | null;
  skills: string[];
  metadata?: Partial<CredentialMetadata>;
  status?: SmartCredential['status'];
  visibility?: SmartCredential['visibility'];
  description?: string;
  issuedAt?: FirebaseFirestore.Timestamp;
  expiresAt?: FirebaseFirestore.Timestamp | null;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
  verificationHash?: string;
  verificationUrl?: string;
};

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';

const minutesAgo = (minutes: number): FirebaseFirestore.Timestamp => {
  const ms = Date.now() - minutes * 60 * 1000;
  return firestore.Timestamp.fromDate(new Date(ms));
};

const generateCredentialVerificationHash = (seed: SeedCredential): string => {
  if (seed.verificationHash) {
    return seed.verificationHash;
  }

  const data = `${seed.id}-${seed.teacherId}-${seed.name}-seed-${Date.now()}`;
  return Buffer.from(data).toString('base64').slice(0, 32);
};

const isProductionSeed = process.env.ALLOW_PRODUCTION_SEED === 'true';

const devUsers: SeedUser[] = [
  {
    uid: 'platform-admin',
    email: 'platform.admin@gurucool.dev',
    displayName: 'Paige Platform',
    firstName: 'Paige',
    lastName: 'Platform',
    role: USER_ROLES.PLATFORM_ADMIN,
    tier: USER_TIERS.SCHOOL,
    schoolId: null,
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
  },
  {
    uid: 'school-admin-alpha',
    email: 'admin.alpha@gurucool.dev',
    displayName: 'Avery Alpha',
    firstName: 'Avery',
    lastName: 'Alpha',
    role: USER_ROLES.SCHOOL_ADMIN,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-alpha',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    adminRole: 'Principal',
    officialSchoolEmail: 'admin.alpha@gurucool.dev',
    phone: '+1234567890',
    country: 'United States',
  },
  {
    uid: 'school-admin-beta',
    email: 'admin.beta@gurucool.dev',
    displayName: 'Beatrice Beta',
    firstName: 'Beatrice',
    lastName: 'Beta',
    role: USER_ROLES.SCHOOL_ADMIN,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-beta',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    adminRole: 'Vice Principal',
    officialSchoolEmail: 'admin.beta@gurucool.dev',
  },
  {
    uid: 'teacher-alpha-active',
    email: 'teacher.alpha@gurucool.dev',
    displayName: 'Tara Teacher',
    firstName: 'Tara',
    lastName: 'Teacher',
    role: USER_ROLES.SCHOOL_TEACHER,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-alpha',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    subjects: ['Mathematics', 'Science'],
    gradeLevels: ['Grade 6-8', 'Grade 9-10'],
    teachingExperience: '5-10 years',
    schoolEmail: 'tara@alpha-academy.edu',
    country: 'United States',
  },
  {
    uid: 'teacher-alpha-suspended',
    email: 'teacher.alpha.suspended@gurucool.dev',
    displayName: 'Sam Suspended',
    firstName: 'Sam',
    lastName: 'Suspended',
    role: USER_ROLES.SCHOOL_TEACHER,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-alpha',
    status: USER_STATUS.SUSPENDED,
    profileCompleted: true,
    subjects: ['English'],
    gradeLevels: ['Grade 1-5'],
    teachingExperience: '1-3 years',
  },
  {
    uid: 'teacher-beta',
    email: 'teacher.beta@gurucool.dev',
    displayName: 'Bianca Beta',
    firstName: 'Bianca',
    lastName: 'Beta',
    role: USER_ROLES.SCHOOL_TEACHER,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-beta',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    subjects: ['History', 'Geography'],
    gradeLevels: ['Grade 9-10', 'Grade 11-12'],
    teachingExperience: '3-5 years',
    schoolEmail: 'bianca@beta-institute.edu',
  },
  {
    uid: 'teacher-beta-approved',
    email: 'teacher.beta.approved@gurucool.dev',
    displayName: 'Cameron Credential',
    firstName: 'Cameron',
    lastName: 'Credential',
    role: USER_ROLES.SCHOOL_TEACHER,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-beta',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    subjects: ['History', 'Geography'],
    gradeLevels: ['Grade 9-10', 'Grade 11-12'],
    teachingExperience: '7-10 years',
    schoolEmail: 'cameron.credential@beta-institute.edu',
    aspiration: 'Serve as senior mentor for social science tracks',
    profileReview: {
      approvedBy: 'school-admin-beta',
      approvedByRole: USER_ROLES.SCHOOL_ADMIN,
      lastActionBy: 'school-admin-beta',
    },
  },
  {
    uid: 'teacher-alpha-pending',
    email: 'teacher.alpha.pending@gurucool.dev',
    displayName: 'Paula Pending',
    firstName: 'Paula',
    lastName: 'Pending',
    role: USER_ROLES.SCHOOL_TEACHER,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-alpha',
    status: USER_STATUS.PENDING,
    profileCompleted: true,
    subjects: ['Physics', 'Chemistry'],
    gradeLevels: ['Grade 11-12'],
    teachingExperience: '1-3 years',
  },
  {
    uid: 'teacher-alpha-draft',
    email: 'teacher.alpha.draft@gurucool.dev',
    displayName: 'Dana Draft',
    firstName: 'Dana',
    lastName: 'Draft',
    role: USER_ROLES.SCHOOL_TEACHER,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-alpha',
    status: USER_STATUS.DRAFT,
    profileCompleted: false,
  },
  {
    uid: 'school-admin-gamma',
    email: 'admin.gamma@gurucool.dev',
    displayName: 'Gary Gamma',
    firstName: 'Gary',
    lastName: 'Gamma',
    role: USER_ROLES.SCHOOL_ADMIN,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-gamma',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    adminRole: 'Head of Department',
  },
  {
    uid: 'school-admin-delta',
    email: 'admin.delta@gurucool.dev',
    displayName: 'Diana Delta',
    firstName: 'Diana',
    lastName: 'Delta',
    role: USER_ROLES.SCHOOL_ADMIN,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-delta',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    adminRole: 'HR / PD Coordinator',
  },
  {
    uid: 'school-admin-epsilon',
    email: 'admin.epsilon@gurucool.dev',
    displayName: 'Ethan Epsilon',
    firstName: 'Ethan',
    lastName: 'Epsilon',
    role: USER_ROLES.SCHOOL_ADMIN,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-epsilon',
    status: USER_STATUS.ACTIVE,
    profileCompleted: true,
    adminRole: 'Principal',
  },
  {
    uid: 'school-admin-zeta',
    email: 'admin.zeta@gurucool.dev',
    displayName: 'Zara Zeta',
    firstName: 'Zara',
    lastName: 'Zeta',
    role: USER_ROLES.SCHOOL_ADMIN,
    tier: USER_TIERS.SCHOOL,
    schoolId: 'school-zeta',
    status: USER_STATUS.PENDING,
    profileCompleted: true,
    adminRole: 'Other Admin',
  },
];

const users: SeedUser[] = isProductionSeed
  ? [
      {
        uid: 'prod-platform-admin',
        email: process.env.PLATFORM_ADMIN_EMAIL || 'admin@gurucool.dev',
        displayName: 'Platform Admin',
        firstName: 'Platform',
        lastName: 'Admin',
        password: process.env.PLATFORM_ADMIN_PASSWORD,
        role: USER_ROLES.PLATFORM_ADMIN,
        tier: USER_TIERS.SCHOOL,
        schoolId: null,
        status: USER_STATUS.ACTIVE,
        profileCompleted: true,
      },
    ]
  : devUsers;

const devSchools: SeedSchool[] = [
  {
    id: 'school-alpha',
    name: 'Alpha Academy',
    adminId: 'school-admin-alpha',
    adminEmail: 'admin.alpha@gurucool.dev',
    teacherLimit: 50,
    status: 'active',
    verificationStatus: 'verified',
    contactEmail: 'contact@alpha.edu',
    admins: ['school-admin-alpha'],
    seats: {
      total: 50,
      used: 4, // 4 teachers: active, suspended, pending, draft
    },
  },
  {
    id: 'school-beta',
    name: 'Beta Institute',
    adminId: 'school-admin-beta',
    adminEmail: 'admin.beta@gurucool.dev',
    teacherLimit: 25,
    status: 'active',
    verificationStatus: 'verified',
    contactEmail: 'hi@beta.edu',
    admins: ['school-admin-beta'],
    seats: {
      total: 25,
      used: 2,
    },
  },
  {
    id: 'school-gamma',
    name: 'Gamma Grammar School',
    adminId: 'school-admin-gamma',
    adminEmail: 'admin.gamma@gurucool.dev',
    teacherLimit: 40,
    status: 'active',
    verificationStatus: 'verified',
    contactEmail: 'info@gamma.edu',
    admins: ['school-admin-gamma'],
    seats: {
      total: 40,
      used: 0,
    },
  },
  {
    id: 'school-delta',
    name: 'Delta Day School',
    adminId: 'school-admin-delta',
    adminEmail: 'admin.delta@gurucool.dev',
    teacherLimit: 30,
    status: 'active',
    verificationStatus: 'pending',
    contactEmail: 'hello@delta.edu',
    admins: ['school-admin-delta'],
    seats: {
      total: 30,
      used: 0,
    },
  },
  {
    id: 'school-epsilon',
    name: 'Epsilon Elementary',
    adminId: 'school-admin-epsilon',
    adminEmail: 'admin.epsilon@gurucool.dev',
    teacherLimit: 60,
    status: 'active',
    verificationStatus: 'verified',
    contactEmail: 'contact@epsilon.edu',
    admins: ['school-admin-epsilon'],
    seats: {
      total: 60,
      used: 0,
    },
  },
  {
    id: 'school-zeta',
    name: 'Zeta High School',
    adminId: 'school-admin-zeta',
    adminEmail: 'admin.zeta@gurucool.dev',
    teacherLimit: 100,
    status: 'pending',
    verificationStatus: 'pending',
    contactEmail: 'admin@zeta.edu',
    admins: ['school-admin-zeta'],
    seats: {
      total: 100,
      used: 0,
    },
  },
];

const schools: SeedSchool[] = isProductionSeed ? [] : devSchools;

const devNotifications: SeedNotification[] = [
  {
    id: 'notif-profile-approved-alpha',
    userId: 'teacher-alpha-active',
    type: NOTIFICATION_TYPES.PROFILE_APPROVED,
    title: 'Profile approved',
    message: 'Your teaching profile at Alpha Academy is now live.',
    createdAt: minutesAgo(5),
  },
  {
    id: 'notif-pd-completed-alpha',
    userId: 'teacher-alpha-active',
    type: NOTIFICATION_TYPES.PD_COMPLETED,
    title: 'PD milestone unlocked',
    message: 'Great job completing Inclusive Classrooms PD module.',
    metadata: {
      moduleId: 'pd-inclusive-classrooms',
      moduleTitle: 'Inclusive Classrooms 101',
    },
    createdAt: minutesAgo(10),
  },
  {
    id: 'notif-credential-issued-beta',
    userId: 'teacher-beta-approved',
    type: NOTIFICATION_TYPES.CREDENTIAL_ISSUED,
    title: 'Credential approved',
    message:
      'Beta Institute approved your Inclusive Classroom Strategist credential.',
    metadata: {
      credentialId: 'cred-teacher-beta-approved-inclusive-strategist',
      credentialName: 'Inclusive Classroom Strategist',
    },
    createdAt: minutesAgo(8),
  },
  {
    id: 'notif-badge-earned-alpha',
    userId: 'teacher-alpha-active',
    type: NOTIFICATION_TYPES.BADGE_EARNED,
    title: 'Badge earned',
    message: 'You earned the Engagement Pro badge.',
    metadata: {
      badgeId: 'badge-engagement-pro',
      badgeName: 'Engagement Pro',
    },
    isRead: true,
    createdAt: minutesAgo(20),
  },
  {
    id: 'notif-assignment-alpha',
    userId: 'teacher-alpha-active',
    type: NOTIFICATION_TYPES.ASSIGNMENT_CREATED,
    title: 'New assignment posted',
    message: 'School admin assigned the Classroom Climate assessment to you.',
    metadata: {
      assignmentId: 'assignment-alpha-001',
      assessmentTitle: 'Classroom Climate Pulse',
    },
    createdAt: minutesAgo(30),
  },
  {
    id: 'notif-suspension-alpha',
    userId: 'teacher-alpha-suspended',
    type: NOTIFICATION_TYPES.SUSPENSION,
    title: 'Account suspended',
    message: 'Your account is temporarily suspended pending review.',
    metadata: {
      suspensionReason: 'Multiple failed verification attempts',
    },
    createdAt: minutesAgo(15),
  },
  {
    id: 'notif-unsuspension-alpha',
    userId: 'teacher-alpha-suspended',
    type: NOTIFICATION_TYPES.UNSUSPENSION,
    title: 'Account reinstated',
    message: 'Your account access is restored. Please review updated policies.',
    createdAt: minutesAgo(2),
  },
  {
    id: 'notif-profile-rejected-beta',
    userId: 'teacher-beta',
    type: NOTIFICATION_TYPES.PROFILE_REJECTED,
    title: 'Profile requires updates',
    message: 'We need additional credentials before approving your profile.',
    metadata: {
      rejectionReason: 'Missing certification proof',
    },
    createdAt: minutesAgo(25),
  },
];

const notifications: SeedNotification[] = isProductionSeed
  ? []
  : devNotifications;

const devCredentials: SeedCredential[] = [
  {
    id: 'cred-teacher-beta-approved-inclusive-strategist',
    teacherId: 'teacher-beta-approved',
    type: CREDENTIAL_TYPES.MICRO_CREDENTIAL,
    name: 'Inclusive Classroom Strategist',
    trackId: 'inclusive_practice',
    badgeId: 'badge-inclusive-classroom-champion',
    competencyKey: 'inclusive_education',
    skills: ['Differentiated Instruction', 'SEL Integration', 'UDL Planning'],
    status: CREDENTIAL_STATUS.VERIFIED,
    visibility: CREDENTIAL_VISIBILITY.PUBLIC,
    issuedAt: minutesAgo(60 * 24),
    metadata: {
      issuer: 'Beta Institute Credentialing Committee',
      hoursCompleted: 12,
      scoreAchieved: 92,
      assessmentId: 'assessment-inclusion-2024-01',
      linkedInShareUrl: 'https://www.linkedin.com/company/gurucool',
    },
  },
];

const credentials: SeedCredential[] = isProductionSeed ? [] : devCredentials;

const assertEmulatorEnvironment = (): void => {
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST
  );

  if (!isEmulator && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error(
      'Seeding is restricted to Firebase emulators. Set ALLOW_PRODUCTION_SEED=true if you really intend to seed a live project.'
    );
  }
};

const ensureAuthUser = async (user: SeedUser): Promise<void> => {
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, {
      email: user.email,
      displayName: user.displayName,
      password: user.password ?? DEFAULT_PASSWORD,
      emailVerified: true,
    });
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }

    await auth.createUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      password: user.password ?? DEFAULT_PASSWORD,
      emailVerified: true,
    });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: user.role,
    schoolId: user.schoolId,
    status: user.status,
  });
};

const upsertUserDocument = async (user: SeedUser): Promise<void> => {
  const ref = db.collection('users').doc(user.uid);
  const snapshot = await ref.get();
  const now = firestore.Timestamp.now();
  const existing = snapshot.exists ? snapshot.data() ?? {} : {};

  const usage = (existing.usage as Record<string, number>) ?? {};

  // Build profileReview metadata for status tracking
  const profileReviewDefaults: ProfileReviewMetadata | undefined =
    user.status === USER_STATUS.ACTIVE
      ? {
          approvedAt: now,
          approvedBy: 'seed-script',
          lastActionAt: now,
          lastActionBy: 'seed-script',
        }
      : user.status === USER_STATUS.PENDING
      ? {
          submittedAt: now,
          submittedBy: user.uid,
          lastActionAt: now,
          lastActionBy: user.uid,
        }
      : undefined;

  let profileReview: ProfileReviewMetadata | undefined;
  if (profileReviewDefaults || user.profileReview) {
    profileReview = {
      ...(profileReviewDefaults ?? {}),
      ...(user.profileReview ?? {}),
    } as ProfileReviewMetadata;

    if (!profileReview.lastActionAt) {
      profileReview.lastActionAt = now;
    }

    if (!profileReview.lastActionBy) {
      profileReview.lastActionBy =
        user.profileReview?.lastActionBy ??
        (user.status === USER_STATUS.PENDING ? user.uid : 'seed-script');
    }

    if (user.status === USER_STATUS.ACTIVE) {
      if (!profileReview.approvedAt) {
        profileReview.approvedAt = now;
      }

      if (!profileReview.approvedBy) {
        profileReview.approvedBy =
          user.profileReview?.approvedBy ?? 'seed-script';
      }
    }

    if (user.status === USER_STATUS.PENDING) {
      if (!profileReview.submittedAt) {
        profileReview.submittedAt = now;
      }

      if (!profileReview.submittedBy) {
        profileReview.submittedBy = user.profileReview?.submittedBy ?? user.uid;
      }
    }
  }

  // Build suspension metadata for suspended users
  const suspension: SuspensionMetadata | null =
    user.status === USER_STATUS.SUSPENDED
      ? {
          suspendedBy: 'seed-script',
          suspendedAt: now,
          reason: 'Suspended by seed script for testing',
          originalStatus: USER_STATUS.ACTIVE,
        }
      : null;

  // Build user document matching current repository pattern
  const userDoc: Record<string, unknown> = {
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    tier: user.tier,
    schoolId: user.schoolId,
    status: user.status,
    profileCompleted: user.profileCompleted ?? false,
    usage,
    createdAt: existing.createdAt ?? now,
    updatedAt: now,
  };

  // Add profile fields if present
  if (user.firstName) userDoc.firstName = user.firstName;
  if (user.lastName) userDoc.lastName = user.lastName;
  if (user.phone) userDoc.phone = user.phone;
  if (user.country) userDoc.country = user.country;
  if (user.subjects) userDoc.subjects = user.subjects;
  if (user.gradeLevels) userDoc.gradeLevels = user.gradeLevels;
  if (user.teachingExperience)
    userDoc.teachingExperience = user.teachingExperience;

  // School admin specific fields
  if (user.adminRole) userDoc.adminRole = user.adminRole;
  if (user.officialSchoolEmail)
    userDoc.officialSchoolEmail = user.officialSchoolEmail;

  // Teacher specific fields
  if (user.schoolEmail) userDoc.schoolEmail = user.schoolEmail;
  if (user.staffId) userDoc.staffId = user.staffId;
  if (user.aspiration) userDoc.aspiration = user.aspiration;

  // Add metadata fields
  if (profileReview) userDoc.profileReview = profileReview;
  if (suspension) userDoc.suspension = suspension;

  await ref.set(userDoc, { merge: true });
};

const seedUsers = async (): Promise<void> => {
  for (const user of users) {
    await ensureAuthUser(user);
    await upsertUserDocument(user);
    console.log(`✓ Seeded user ${user.email} (${user.role})`);
  }
};

const upsertSchool = async (school: SeedSchool): Promise<void> => {
  const ref = db.collection('schools').doc(school.id);
  const snapshot = await ref.get();
  const now = firestore.Timestamp.now();
  const existing = snapshot.exists ? snapshot.data() ?? {} : {};

  await ref.set(
    {
      id: school.id,
      name: school.name,
      adminId: school.adminId,
      teacherLimit: school.teacherLimit,
      status: school.status,
      verificationStatus: school.verificationStatus,
      admins: school.admins,
      contactEmail: school.contactEmail,
      seats: school.seats,
      nameLower: school.name.toLowerCase().trim(),
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
    },
    { merge: true }
  );
};

const seedSchools = async (): Promise<void> => {
  for (const school of schools) {
    await upsertSchool(school);
    console.log(`✓ Seeded school ${school.name}`);
  }
};

const clearNotifications = async (userIds: string[]): Promise<void> => {
  if (userIds.length === 0) return;
  const chunkSize = 10;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const ids = userIds.slice(i, i + chunkSize);
    const snapshot = await db
      .collection('notifications')
      .where('userId', 'in', ids)
      .get();

    if (snapshot.empty) continue;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
};

const seedNotifications = async (): Promise<void> => {
  const userIds = Array.from(new Set(notifications.map((n) => n.userId)));
  await clearNotifications(userIds);

  for (const notification of notifications) {
    const ref = db.collection('notifications').doc(notification.id);
    await ref.set({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata ?? {},
      isRead: notification.isRead ?? false,
      createdAt: notification.createdAt,
      updatedAt: notification.createdAt,
    });
    console.log(
      `✓ Notification ${notification.id} → ${notification.userId} (${notification.type})`
    );
  }
};

const seedCredentials = async (): Promise<void> => {
  for (const seed of credentials) {
    const issuedAt = seed.issuedAt ?? firestore.Timestamp.now();
    const createdAt = seed.createdAt ?? issuedAt;
    const updatedAt = seed.updatedAt ?? issuedAt;

    const credentialDoc: SmartCredential = {
      id: seed.id,
      teacherId: seed.teacherId,
      type: seed.type,
      name: seed.name,
      description:
        seed.description ?? `${seed.name} credential issued via seed script`,
      trackId: seed.trackId,
      competencyKey: seed.competencyKey ?? null,
      badgeId: seed.badgeId,
      status:
        seed.status ?? (CREDENTIAL_STATUS.ISSUED as SmartCredential['status']),
      visibility:
        seed.visibility ??
        (CREDENTIAL_VISIBILITY.PUBLIC as SmartCredential['visibility']),
      issuedAt,
      expiresAt: seed.expiresAt ?? null,
      verificationHash: generateCredentialVerificationHash(seed),
      verificationUrl:
        seed.verificationUrl ?? `https://gurucool.ai/verify/${seed.id}`,
      skills: seed.skills,
      metadata: {
        issuer: 'GuruCool AI',
        ...(seed.metadata ?? {}),
      } as CredentialMetadata,
      createdAt,
      updatedAt,
    };

    await db
      .collection('credentials')
      .doc(credentialDoc.id)
      .set(credentialDoc, { merge: true });
    console.log(
      `✓ Credential ${credentialDoc.id} → ${credentialDoc.teacherId} (${credentialDoc.status})`
    );
  }
};

const main = async (): Promise<void> => {
  assertEmulatorEnvironment();

  await seedUsers();
  await seedSchools();
  await seedCredentials();
  await seedNotifications();
  console.log('✅ Seeding completed successfully.');
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
