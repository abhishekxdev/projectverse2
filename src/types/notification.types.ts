/**
 * Notification type definitions for the Gurucool AI backend
 */

/**
 * Enum of all notification types supported by the system
 */
export const NOTIFICATION_TYPES = {
  PROFILE_SUBMITTED: 'profile_submitted',
  PROFILE_APPROVED: 'profile_approved',
  PROFILE_REJECTED: 'profile_rejected',
  PD_COMPLETED: 'pd_completed',
  BADGE_EARNED: 'badge_earned',
  SUSPENSION: 'suspension',
  UNSUSPENSION: 'unsuspension',
  ASSIGNMENT_CREATED: 'assignment_created',
  // Competency assessment notifications (Task 5)
  COMPETENCY_SUBMITTED: 'competency_submitted',
  COMPETENCY_EVALUATED: 'competency_evaluated',
  // AI Tutor notifications (Task 8)
  TUTOR_SESSION_STARTED: 'tutor_session_started',
  LEARNING_PATH_CREATED: 'learning_path_created',
  MODULE_UNLOCKED: 'module_unlocked',
  // PD Module notifications (Task 9)
  PD_ATTEMPT_SUBMITTED: 'pd_attempt_submitted',
  PD_MODULE_PASSED: 'pd_module_passed',
  PD_MODULE_FAILED: 'pd_module_failed',
  // Growth system notifications
  AMBASSADOR_NOMINATION: 'ambassador_nomination',
  REFLECTION_EVALUATED: 'reflection_evaluated',
  URGENCY_ALERT: 'urgency_alert',
  NUDGE: 'nudge',
  CREDENTIAL_ISSUED: 'credential_issued',
  COHORT_JOINED: 'cohort_joined',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * Metadata for different notification types
 */
export type NotificationMetadata = {
  // For badge_earned notifications
  badgeId?: string;
  badgeName?: string;
  // For profile_rejected notifications
  rejectionReason?: string;
  // For assignment_created notifications
  assignmentId?: string;
  assessmentTitle?: string;
  // For suspension notifications
  suspensionReason?: string;
  // For pd_completed notifications
  moduleId?: string;
  moduleTitle?: string;
  // For competency assessment notifications
  attemptId?: string;
  resultId?: string;
  overallScore?: number;
  proficiencyLevel?: string;
  // Generic key-value store for future extensibility
  [key: string]: unknown;
};

/**
 * Core notification interface stored in Firestore
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: NotificationMetadata;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Input type for creating a new notification
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}

/**
 * Query options for fetching notifications with pagination
 */
export interface NotificationQueryOptions {
  /** Maximum number of notifications to return (default: 20, max: 100) */
  limit?: number;
  /** Notification ID to start after for cursor-based pagination */
  startAfter?: string;
}

/**
 * Response type for paginated notification list
 */
export interface NotificationListResponse {
  notifications: Notification[];
  hasMore: boolean;
}
