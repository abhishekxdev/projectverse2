/**
 * Growth System Types
 * Includes: Badges, Cohorts, Reflections, Credentials, Urgency Alerts, Growth Snapshots
 * Based on AI_Tutor_Routing_Logic.md and Structured_Competency_Framework.md
 */

import { Timestamp } from 'firebase-admin/firestore';

// ============ BADGE SYSTEM TYPES ============

export type BadgeType = 'track_badge' | 'micro_badge' | 'ambassador_badge';
export type BadgeStatus = 'locked' | 'in_progress' | 'earned' | 'expired';

export interface Badge {
  id: string;
  teacherId: string;
  type: BadgeType;
  name: string;
  description: string;
  trackId: string | null;
  competencyKey: string | null;
  status: BadgeStatus;
  earnedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  criteria: BadgeCriteria;
  progress: BadgeProgress;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BadgeCriteria {
  minScore: number;
  requiresReflection: boolean;
  requiresPeerInteraction: boolean;
  requiresLeadershipActivity?: boolean;
  customCriteria?: string[];
}

export interface BadgeProgress {
  scoreAchieved: number;
  reflectionCompleted: boolean;
  peerInteractionCompleted: boolean;
  leadershipActivityCompleted?: boolean;
  progressPercent: number;
}

export interface BadgeEvaluationResult {
  eligible: boolean;
  badge: Badge | null;
  missingCriteria: string[];
  message: string;
}

// ============ PEER COHORT SYSTEM TYPES ============

export type CohortRole = 'learner' | 'mentor' | 'leader';
export type CohortStatus = 'forming' | 'active' | 'completed' | 'disbanded';

export interface PeerCohort {
  id: string;
  trackId: string;
  name: string;
  status: CohortStatus;
  members: CohortMember[];
  mentorIds: string[];
  leaderId: string | null;
  maxSize: number;
  currentSize: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}

export interface CohortMember {
  teacherId: string;
  role: CohortRole;
  joinedAt: Timestamp;
  proficiencyLevel: string;
  interactionCount: number;
  lastActiveAt: Timestamp;
}

export interface CohortPlacementResult {
  cohortId: string;
  role: CohortRole;
  isNewCohort: boolean;
  cohortMembers: number;
}

export interface CohortInteraction {
  id: string;
  cohortId: string;
  fromTeacherId: string;
  toTeacherId: string | null; // null for group interactions
  type: 'message' | 'feedback' | 'mentoring' | 'collaboration';
  content: string;
  createdAt: Timestamp;
}

// ============ REFLECTION SYSTEM TYPES ============

export type ReflectionStatus = 'pending' | 'submitted' | 'evaluated' | 'retry_required';
export type ReflectionQuality = 'poor' | 'acceptable' | 'good' | 'excellent';

export interface Reflection {
  id: string;
  teacherId: string;
  moduleId: string | null;
  trackId: string | null;
  competencyKey: string | null;
  prompt: string;
  response: string;
  status: ReflectionStatus;
  evaluation: ReflectionEvaluation | null;
  retryCount: number;
  maxRetries: number;
  submittedAt: Timestamp | null;
  evaluatedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReflectionEvaluation {
  overallScore: number;
  quality: ReflectionQuality;
  rubricScores: ReflectionRubricScores;
  feedback: string;
  actionRequired: string; // 'retry_or_coach', 'accepted_with_feedback', 'accepted', 'featured'
  evaluatedBy: 'ai' | 'peer' | 'admin';
}

export interface ReflectionRubricScores {
  depthOfInsight: number; // 0-3
  connectionToPractice: number; // 0-3
  growthMindset: number; // 0-3
  clarityExpression: number; // 0-3
}

export interface ReflectionPrompt {
  id: string;
  trackId: string;
  moduleId: string | null;
  prompt: string;
  context: string;
  expectedLength: 'short' | 'medium' | 'long';
  active: boolean;
}

// ============ URGENCY ALERTS SYSTEM TYPES ============

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type AlertType =
  | 'high_risk_teacher'
  | 'inactivity_nudge'
  | 'inactivity_warning'
  | 'inactivity_critical'
  | 'struggling_teacher'
  | 'pd_stalled';
export type AlertAction = 'send_nudge' | 'notify_admin' | 'assign_coach' | 'escalate';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export interface UrgencyAlert {
  id: string;
  teacherId: string;
  schoolId: string | null;
  type: AlertType;
  urgency: UrgencyLevel;
  status: AlertStatus;
  title: string;
  message: string;
  triggerData: AlertTriggerData;
  recommendedActions: AlertAction[];
  actionsTaken: AlertActionLog[];
  createdAt: Timestamp;
  acknowledgedAt: Timestamp | null;
  acknowledgedBy: string | null;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;
}

export interface AlertTriggerData {
  condition: string;
  value: number | string;
  threshold: number | string;
  trackScores?: Record<string, number>;
  daysInactive?: number;
  failedAttempts?: number;
}

export interface AlertActionLog {
  action: AlertAction;
  performedAt: Timestamp;
  performedBy: string;
  notes: string | null;
}

export interface TeacherRiskAssessment {
  teacherId: string;
  overallRisk: UrgencyLevel;
  alerts: UrgencyAlert[];
  beginnerTrackCount: number;
  daysInactive: number;
  failedAttempts: number;
  stalledPdModules: number;
  lastAssessedAt: Timestamp;
}

// ============ SMART CREDENTIALS SYSTEM TYPES ============

export type CredentialType = 'skill_badge' | 'track_certificate' | 'micro_credential' | 'ambassador_credential';
export type CredentialStatus = 'pending' | 'issued' | 'verified' | 'revoked' | 'expired';
export type CredentialVisibility = 'private' | 'school_only' | 'public';

export interface SmartCredential {
  id: string;
  teacherId: string;
  type: CredentialType;
  name: string;
  description: string;
  trackId: string | null;
  competencyKey: string | null;
  badgeId: string | null;
  status: CredentialStatus;
  visibility: CredentialVisibility;
  issuedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  verificationHash: string | null; // For blockchain-backed verification
  verificationUrl: string | null;
  skills: string[];
  metadata: CredentialMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CredentialMetadata {
  issuer: string;
  issuerLogo?: string;
  scoreAchieved?: number;
  hoursCompleted?: number;
  assessmentId?: string;
  blockchainTxId?: string; // For blockchain-backed credentials
  linkedInShareUrl?: string;
}

export interface CredentialVerification {
  credentialId: string;
  isValid: boolean;
  verifiedAt: Timestamp;
  verificationMethod: 'hash' | 'blockchain' | 'manual';
  issuerConfirmed: boolean;
}

// ============ GROWTH JOURNEY SNAPSHOT TYPES ============

export type SnapshotFrequency = 'weekly' | 'monthly' | 'quarterly';

export interface GrowthJourneySnapshot {
  id: string;
  teacherId: string;
  schoolId: string | null;
  frequency: SnapshotFrequency;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  metrics: GrowthMetrics;
  trackProgress: TrackProgressSnapshot[];
  highlights: GrowthHighlight[];
  recommendations: string[];
  comparisonToPrevious: MetricComparison | null;
  generatedAt: Timestamp;
}

export interface GrowthMetrics {
  overallProgress: number; // 0-100%
  badgeCount: number;
  badgesEarnedThisPeriod: number;
  reflectionQualityAvg: number; // 0-100
  peerInteractions: number;
  modulesCompleted: number;
  modulesCompletedThisPeriod: number;
  streakDays: number;
  longestStreak: number;
  mentorSessions: number;
  mentorSessionsThisPeriod: number;
  totalTimeSpentMinutes: number;
}

export interface TrackProgressSnapshot {
  trackId: string;
  trackName: string;
  proficiencyLevel: string;
  scorePercent: number;
  modulesCompleted: number;
  modulesTotal: number;
  badgesEarned: string[];
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface GrowthHighlight {
  type: 'badge_earned' | 'module_completed' | 'streak_milestone' | 'level_up' | 'mentor_feedback';
  title: string;
  description: string;
  date: Timestamp;
  metadata: Record<string, unknown>;
}

export interface MetricComparison {
  previousPeriod: GrowthMetrics;
  changes: Record<keyof GrowthMetrics, number>; // Percentage change
  trend: 'improving' | 'stable' | 'declining';
}

// ============ AI TUTOR FLOW TYPES ============

export interface AITutorFlowState {
  teacherId: string;
  currentStep: 'diagnose' | 'personalize' | 'deliver' | 'track' | 'credential';
  diagnosticComplete: boolean;
  assignedTracks: string[];
  currentModuleId: string | null;
  learningPathId: string | null;
  cohortId: string | null;
  pendingReflections: string[];
  earnedBadges: string[];
  earnedCredentials: string[];
  lastUpdated: Timestamp;
}

export interface PersonalizedPDRecommendation {
  teacherId: string;
  primaryTrack: string;
  secondaryTrack: string | null;
  recommendedModules: RecommendedModule[];
  rationale: string;
  generatedAt: Timestamp;
}

export interface RecommendedModule {
  moduleId: string;
  moduleName: string;
  trackId: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimatedDuration: number; // minutes
}
