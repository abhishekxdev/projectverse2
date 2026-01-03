/**
 * Additional school lifecycle status for verification
 */
export type SchoolVerificationStatus = 'pending' | 'verified' | 'rejected';

/**
 * School status lifecycle states
 */
export type SchoolStatus = 'pending' | 'active' | 'suspended' | 'deleted';

/**
 * School invitation status
 */
export type InviteStatus = 'pending' | 'accepted' | 'expired';

/**
 * Upgrade request status for sales pipeline tracking
 */
export type UpgradeRequestStatus = 'new' | 'contacted' | 'closed';

/**
 * School entity representing a school account
 */
export interface School {
  id: string;
  name: string;
  adminId: string; // Firebase UID of primary school admin
  seats: {
    total: number; // Total licensed seats
    used: number; // Currently used seats
  };
  teacherLimit: number;
  status: SchoolStatus;
  verificationStatus: SchoolVerificationStatus;
  admins: string[];
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  establishedYear?: number;
  principalName?: string;
  totalTeachers?: number;
  totalStudents?: number;
  logo?: string;
  nameLower?: string;
  suspendedBy?: string | null;
  suspendedAt?: any | null;
  suspensionReason?: string | null;
  isSuspended?: boolean; // Computed field (status === 'suspended'), not stored in DB
  createdAt: any; // FirebaseFirestore.Timestamp
  updatedAt?: any; // FirebaseFirestore.Timestamp
}

/**
 * School invite entity for tracking teacher invitations
 */
export interface SchoolInvite {
  id: string;
  schoolId: string;
  email: string;
  status: InviteStatus;
  invitedBy: string; // Firebase UID of admin who sent invite
  createdAt: any; // FirebaseFirestore.Timestamp
  expiresAt: any; // FirebaseFirestore.Timestamp - Auto-set to createdAt + 7 days
}

/**
 * Assignment entity for tracking assessment assignments to teachers
 */
export interface Assignment {
  id: string;
  schoolId: string;
  assessmentId: string;
  assignedTo: string[]; // Array of teacher Firebase UIDs
  assignedBy: string; // Admin Firebase UID
  deadline: any | null; // FirebaseFirestore.Timestamp - Optional deadline
  createdAt: any; // FirebaseFirestore.Timestamp
}

/**
 * Upgrade request entity for lead generation
 */
export interface UpgradeRequest {
  id: string;
  email: string;
  school: string;
  message?: string | null;
  status: UpgradeRequestStatus;
  duplicateKey: string;
  createdAt: any; // FirebaseFirestore.Timestamp
  updatedAt: any; // FirebaseFirestore.Timestamp
}

/**
 * Input type for creating a new school
 */
export interface CreateSchoolInput {
  name: string;
  adminId: string;
  adminEmail: string;
  teacherLimit: number;
  verificationStatus?: SchoolVerificationStatus;
  status?: SchoolStatus;
  admins?: string[];
  seats?: {
    total: number;
    used?: number;
  };
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  establishedYear?: number;
  principalName?: string;
  totalTeachers?: number;
  totalStudents?: number;
  logo?: string;
}

/**
 * Input type for updating school information
 */
export type UpdateSchoolInput = Partial<
  Pick<
    School,
    | 'name'
    | 'seats'
    | 'status'
    | 'teacherLimit'
    | 'verificationStatus'
    | 'contactEmail'
    | 'contactPhone'
    | 'address'
    | 'establishedYear'
    | 'principalName'
    | 'totalTeachers'
    | 'totalStudents'
    | 'logo'
    | 'admins'
  >
> & {
  teacherLimit?: number;
};

/**
 * Response type for school registration including admin credentials
 */
export interface SchoolRegistrationResponse {
  school: School;
  admin: {
    uid: string;
    email: string;
    temporaryPassword: string;
  };
}
