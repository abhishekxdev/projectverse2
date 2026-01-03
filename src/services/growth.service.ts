/**
 * Growth Service
 * Implements: Badge System, Peer Cohorts, Reflections, Urgency Alerts, Credentials, Growth Snapshots
 * Based on AI_Tutor_Routing_Logic.md and Structured_Competency_Framework.md
 */

import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { generateText } from 'ai';
import { client } from '../config/openai';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { NotFoundError, ConflictError } from '../utils/error';
import { notificationService } from './notification.service';
import {
  BADGE_TRIGGER_CRITERIA,
  BADGE_STATUS,
  BADGE_TYPES,
  COHORT_PLACEMENT_RULES,
  COHORT_SIZE_LIMITS,
  COHORT_ROLES,
  REFLECTION_QUALITY_THRESHOLDS,
  REFLECTION_RUBRIC,
  REFLECTION_STATUS,
  URGENCY_TRIGGERS,
  URGENCY_LEVELS,
  ALERT_ACTIONS,
  CREDENTIAL_TYPES,
  CREDENTIAL_STATUS,
  CREDENTIAL_VISIBILITY,
  GROWTH_SNAPSHOT_METRICS,
  PD_TRACKS,
  PROFICIENCY_LEVELS,
} from '../config/constants';
import type {
  Badge,
  BadgeEvaluationResult,
  BadgeProgress,
  PeerCohort,
  CohortMember,
  CohortPlacementResult,
  CohortInteraction,
  Reflection,
  ReflectionEvaluation,
  ReflectionRubricScores,
  UrgencyAlert,
  AlertTriggerData,
  TeacherRiskAssessment,
  SmartCredential,
  CredentialMetadata,
  GrowthJourneySnapshot,
  GrowthMetrics,
  TrackProgressSnapshot,
  GrowthHighlight,
} from '../types/growth.types';

const getModel = () => client('gpt-4o-mini');

// ============ BADGE SERVICE ============

export class BadgeService {
  /**
   * Evaluate if a teacher is eligible for a badge
   * Criteria: 70% score + reflection + peer interaction
   */
  async evaluateBadgeEligibility(
    teacherId: string,
    trackId: string,
    score: number
  ): Promise<BadgeEvaluationResult> {
    const criteria = BADGE_TRIGGER_CRITERIA.STANDARD_BADGE;
    const missingCriteria: string[] = [];

    // Check score
    if (score < criteria.minScore) {
      missingCriteria.push(`Score must be at least ${criteria.minScore}% (current: ${score}%)`);
    }

    // Check reflection completion
    const reflectionCompleted = await this.hasCompletedReflection(teacherId, trackId);
    if (criteria.requiresReflection && !reflectionCompleted) {
      missingCriteria.push('Must complete a reflection task');
    }

    // Check peer interaction
    const peerInteractionCompleted = await this.hasPeerInteraction(teacherId, trackId);
    if (criteria.requiresPeerInteraction && !peerInteractionCompleted) {
      missingCriteria.push('Must have peer interaction in cohort');
    }

    const eligible = missingCriteria.length === 0;

    if (eligible) {
      const badge = await this.awardBadge(teacherId, trackId, score);
      return {
        eligible: true,
        badge,
        missingCriteria: [],
        message: `Congratulations! You've earned the ${badge.name} badge!`,
      };
    }

    return {
      eligible: false,
      badge: null,
      missingCriteria,
      message: `Keep going! You need: ${missingCriteria.join(', ')}`,
    };
  }

  /**
   * Award a badge to a teacher
   */
  async awardBadge(teacherId: string, trackId: string, score: number): Promise<Badge> {
    const track = Object.values(PD_TRACKS).find((t) => t.id === trackId);
    if (!track) {
      throw new NotFoundError(`Track ${trackId} not found`);
    }

    const now = Timestamp.now();
    const badgeId = `badge-${teacherId}-${trackId}-${Date.now()}`;

    const badge: Badge = {
      id: badgeId,
      teacherId,
      type: BADGE_TYPES.TRACK_BADGE as Badge['type'],
      name: track.badge,
      description: `Awarded for completing ${track.name} with excellence`,
      trackId,
      competencyKey: null,
      status: BADGE_STATUS.EARNED as Badge['status'],
      earnedAt: now,
      expiresAt: null,
      criteria: BADGE_TRIGGER_CRITERIA.STANDARD_BADGE,
      progress: {
        scoreAchieved: score,
        reflectionCompleted: true,
        peerInteractionCompleted: true,
        progressPercent: 100,
      },
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('badges').doc(badgeId).set(badge);

    // Send notification
    await notificationService.createNotification({
      userId: teacherId,
      type: 'badge_earned',
      title: 'Badge Earned!',
      message: `You've earned the "${track.badge}" badge for completing ${track.name}!`,
      metadata: { badgeId, badgeName: track.badge, trackId },
    });

    // Check for ambassador nomination (85% score)
    if (score >= BADGE_TRIGGER_CRITERIA.AMBASSADOR_NOMINATION.minScore) {
      await this.nominateForAmbassador(teacherId, trackId, score);
    }

    return badge;
  }

  /**
   * Nominate teacher for ambassador status
   */
  async nominateForAmbassador(teacherId: string, trackId: string, score: number): Promise<void> {
    const now = Timestamp.now();
    const nominationId = `ambassador-nom-${teacherId}-${trackId}`;

    await db.collection('ambassador_nominations').doc(nominationId).set({
      id: nominationId,
      teacherId,
      trackId,
      score,
      status: 'pending',
      nominatedAt: now,
    });

    await notificationService.createNotification({
      userId: teacherId,
      type: 'ambassador_nomination',
      title: 'Ambassador Nomination!',
      message: `Your exceptional performance (${score}%) has nominated you for Ambassador status!`,
      metadata: { trackId, score },
    });

    logger.info('Teacher nominated for ambassador', { teacherId, trackId, score });
  }

  private async hasCompletedReflection(teacherId: string, trackId: string): Promise<boolean> {
    const snapshot = await db
      .collection('reflections')
      .where('teacherId', '==', teacherId)
      .where('trackId', '==', trackId)
      .where('status', '==', REFLECTION_STATUS.EVALUATED)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  private async hasPeerInteraction(teacherId: string, trackId: string): Promise<boolean> {
    const snapshot = await db
      .collection('cohort_interactions')
      .where('fromTeacherId', '==', teacherId)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  /**
   * Get all badges for a teacher
   */
  async getTeacherBadges(teacherId: string): Promise<Badge[]> {
    const snapshot = await db
      .collection('badges')
      .where('teacherId', '==', teacherId)
      .orderBy('earnedAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as Badge);
  }
}

// ============ COHORT SERVICE ============

export class CohortService {
  /**
   * Place a teacher into an appropriate cohort based on proficiency
   */
  async placeInCohort(
    teacherId: string,
    trackId: string,
    proficiencyLevel: string
  ): Promise<CohortPlacementResult> {
    const placementRule = COHORT_PLACEMENT_RULES[proficiencyLevel as keyof typeof COHORT_PLACEMENT_RULES];
    if (!placementRule) {
      throw new Error(`Invalid proficiency level: ${proficiencyLevel}`);
    }

    const role = placementRule.cohortRole as CohortMember['role'];

    // Try to find an existing cohort with space
    let cohort = await this.findAvailableCohort(trackId, role);
    let isNewCohort = false;

    if (!cohort) {
      cohort = await this.createCohort(trackId);
      isNewCohort = true;
    }

    // Add teacher to cohort
    await this.addMemberToCohort(cohort.id, teacherId, role, proficiencyLevel);

    // Update cohort size
    await db.collection('cohorts').doc(cohort.id).update({
      currentSize: cohort.currentSize + 1,
      updatedAt: Timestamp.now(),
    });

    return {
      cohortId: cohort.id,
      role,
      isNewCohort,
      cohortMembers: cohort.currentSize + 1,
    };
  }

  private async findAvailableCohort(trackId: string, role: string): Promise<PeerCohort | null> {
    const snapshot = await db
      .collection('cohorts')
      .where('trackId', '==', trackId)
      .where('status', '==', 'active')
      .where('currentSize', '<', COHORT_SIZE_LIMITS.MAX_COHORT_SIZE)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as PeerCohort;
  }

  private async createCohort(trackId: string): Promise<PeerCohort> {
    const now = Timestamp.now();
    const cohortId = `cohort-${trackId}-${Date.now()}`;
    const track = Object.values(PD_TRACKS).find((t) => t.id === trackId);

    const cohort: PeerCohort = {
      id: cohortId,
      trackId,
      name: `${track?.name || trackId} Cohort`,
      status: 'active',
      members: [],
      mentorIds: [],
      leaderId: null,
      maxSize: COHORT_SIZE_LIMITS.MAX_COHORT_SIZE,
      currentSize: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    await db.collection('cohorts').doc(cohortId).set(cohort);
    return cohort;
  }

  private async addMemberToCohort(
    cohortId: string,
    teacherId: string,
    role: CohortMember['role'],
    proficiencyLevel: string
  ): Promise<void> {
    const now = Timestamp.now();
    const memberId = `${cohortId}-${teacherId}`;

    const member: CohortMember = {
      teacherId,
      role,
      joinedAt: now,
      proficiencyLevel,
      interactionCount: 0,
      lastActiveAt: now,
    };

    await db.collection('cohort_members').doc(memberId).set({
      ...member,
      cohortId,
    });

    // Update cohort mentors/leaders if applicable
    if (role === COHORT_ROLES.MENTOR) {
      await db.collection('cohorts').doc(cohortId).update({
        mentorIds: FieldValue.arrayUnion(teacherId),
      });
    } else if (role === COHORT_ROLES.LEADER) {
      await db.collection('cohorts').doc(cohortId).update({
        leaderId: teacherId,
      });
    }
  }

  /**
   * Record a peer interaction
   */
  async recordInteraction(
    cohortId: string,
    fromTeacherId: string,
    toTeacherId: string | null,
    type: CohortInteraction['type'],
    content: string
  ): Promise<CohortInteraction> {
    const now = Timestamp.now();
    const interactionId = `interaction-${cohortId}-${Date.now()}`;

    const interaction: CohortInteraction = {
      id: interactionId,
      cohortId,
      fromTeacherId,
      toTeacherId,
      type,
      content,
      createdAt: now,
    };

    await db.collection('cohort_interactions').doc(interactionId).set(interaction);

    // Update member's interaction count
    const memberId = `${cohortId}-${fromTeacherId}`;
    await db.collection('cohort_members').doc(memberId).update({
      interactionCount: FieldValue.increment(1),
      lastActiveAt: now,
    });

    return interaction;
  }

  /**
   * Get cohort for a teacher
   */
  async getTeacherCohort(teacherId: string, trackId: string): Promise<PeerCohort | null> {
    const memberSnapshot = await db
      .collection('cohort_members')
      .where('teacherId', '==', teacherId)
      .get();

    if (memberSnapshot.empty) return null;

    for (const doc of memberSnapshot.docs) {
      const data = doc.data();
      const cohortDoc = await db.collection('cohorts').doc(data.cohortId).get();
      if (cohortDoc.exists) {
        const cohort = cohortDoc.data() as PeerCohort;
        if (cohort.trackId === trackId) {
          return cohort;
        }
      }
    }

    return null;
  }
}

// ============ REFLECTION SERVICE ============

export class ReflectionService {
  /**
   * Submit a reflection for evaluation
   */
  async submitReflection(
    teacherId: string,
    moduleId: string | null,
    trackId: string | null,
    response: string,
    prompt: string
  ): Promise<Reflection> {
    const now = Timestamp.now();
    const reflectionId = `reflection-${teacherId}-${Date.now()}`;

    const reflection: Reflection = {
      id: reflectionId,
      teacherId,
      moduleId,
      trackId,
      competencyKey: null,
      prompt,
      response,
      status: REFLECTION_STATUS.SUBMITTED as Reflection['status'],
      evaluation: null,
      retryCount: 0,
      maxRetries: 2,
      submittedAt: now,
      evaluatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('reflections').doc(reflectionId).set(reflection);

    // Trigger async evaluation
    this.evaluateReflection(reflectionId).catch((err) => {
      logger.error('Reflection evaluation failed', err, { reflectionId });
    });

    return reflection;
  }

  /**
   * Evaluate a reflection using NLP
   */
  async evaluateReflection(reflectionId: string): Promise<ReflectionEvaluation> {
    const reflectionDoc = await db.collection('reflections').doc(reflectionId).get();
    if (!reflectionDoc.exists) {
      throw new NotFoundError('Reflection not found');
    }

    const reflection = reflectionDoc.data() as Reflection;

    // Use AI to evaluate the reflection
    const evaluation = await this.aiEvaluateReflection(reflection.prompt, reflection.response);

    // Update reflection with evaluation
    await db.collection('reflections').doc(reflectionId).update({
      status: evaluation.actionRequired === 'retry_or_coach'
        ? REFLECTION_STATUS.RETRY_REQUIRED
        : REFLECTION_STATUS.EVALUATED,
      evaluation,
      evaluatedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Send notification based on result
    const notificationMessage = this.getReflectionNotificationMessage(evaluation);
    await notificationService.createNotification({
      userId: reflection.teacherId,
      type: 'reflection_evaluated',
      title: 'Reflection Evaluated',
      message: notificationMessage,
      metadata: { reflectionId, quality: evaluation.quality },
    });

    return evaluation;
  }

  private async aiEvaluateReflection(prompt: string, response: string): Promise<ReflectionEvaluation> {
    const evaluationPrompt = `Evaluate this teacher's reflection based on the following rubric.

REFLECTION PROMPT:
${prompt}

TEACHER'S REFLECTION:
${response}

RUBRIC (Score each 0-3):
1. DEPTH OF INSIGHT (Weight: 30%)
   - 0: No meaningful reflection
   - 1: Surface-level observations
   - 2: Some analysis of experience
   - 3: Deep, actionable insights

2. CONNECTION TO PRACTICE (Weight: 30%)
   - 0: No connection to teaching
   - 1: Vague connection
   - 2: Clear connection with examples
   - 3: Strong integration with practice

3. GROWTH MINDSET (Weight: 20%)
   - 0: Fixed mindset language
   - 1: Acknowledges room for growth
   - 2: Identifies specific growth areas
   - 3: Sets concrete improvement goals

4. CLARITY OF EXPRESSION (Weight: 20%)
   - 0: Incoherent or incomplete
   - 1: Understandable but vague
   - 2: Clear and organized
   - 3: Articulate and compelling

Respond with JSON:
{
  "rubricScores": {
    "depthOfInsight": <0-3>,
    "connectionToPractice": <0-3>,
    "growthMindset": <0-3>,
    "clarityExpression": <0-3>
  },
  "feedback": "<constructive feedback string>"
}`;

    try {
      const { text } = await generateText({
        model: getModel() as unknown as Parameters<typeof generateText>[0]['model'],
        prompt: evaluationPrompt,
        temperature: 0.3,
      });

      const result = JSON.parse(text);
      const rubricScores: ReflectionRubricScores = result.rubricScores;

      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        ((rubricScores.depthOfInsight * 0.3 +
          rubricScores.connectionToPractice * 0.3 +
          rubricScores.growthMindset * 0.2 +
          rubricScores.clarityExpression * 0.2) /
          3) *
          100
      );

      // Determine quality and action
      let quality: ReflectionEvaluation['quality'];
      let actionRequired: string;

      if (overallScore < 40) {
        quality = 'poor';
        actionRequired = 'retry_or_coach';
      } else if (overallScore < 70) {
        quality = 'acceptable';
        actionRequired = 'accepted_with_feedback';
      } else if (overallScore < 90) {
        quality = 'good';
        actionRequired = 'accepted';
      } else {
        quality = 'excellent';
        actionRequired = 'featured';
      }

      return {
        overallScore,
        quality,
        rubricScores,
        feedback: result.feedback,
        actionRequired,
        evaluatedBy: 'ai',
      };
    } catch (error) {
      logger.error('AI reflection evaluation failed', error instanceof Error ? error : undefined);
      // Return default acceptable evaluation on error
      return {
        overallScore: 50,
        quality: 'acceptable',
        rubricScores: {
          depthOfInsight: 2,
          connectionToPractice: 2,
          growthMindset: 1,
          clarityExpression: 2,
        },
        feedback: 'Thank you for your reflection. Keep developing your reflective practice!',
        actionRequired: 'accepted_with_feedback',
        evaluatedBy: 'ai',
      };
    }
  }

  private getReflectionNotificationMessage(evaluation: ReflectionEvaluation): string {
    switch (evaluation.quality) {
      case 'excellent':
        return 'Outstanding reflection! Your insights have been featured.';
      case 'good':
        return 'Great reflection! You demonstrated strong reflective practice.';
      case 'acceptable':
        return 'Good effort! Review the feedback to deepen your reflection.';
      case 'poor':
        return 'Please revise your reflection based on the feedback provided.';
      default:
        return 'Your reflection has been evaluated.';
    }
  }

  /**
   * Get reflections for a teacher
   */
  async getTeacherReflections(teacherId: string): Promise<Reflection[]> {
    const snapshot = await db
      .collection('reflections')
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as Reflection);
  }
}

// ============ URGENCY ALERT SERVICE ============

export class UrgencyAlertService {
  /**
   * Assess teacher risk and create alerts
   */
  async assessTeacherRisk(teacherId: string): Promise<TeacherRiskAssessment> {
    const now = Timestamp.now();
    const alerts: UrgencyAlert[] = [];

    // Get teacher's track scores
    const resultDoc = await db
      .collection('competency_results')
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    let beginnerTrackCount = 0;
    const trackScores: Record<string, number> = {};

    if (!resultDoc.empty) {
      const result = resultDoc.docs[0].data();
      if (result.domainScores) {
        for (const domain of result.domainScores) {
          trackScores[domain.domainKey] = domain.scorePercent;
          if (domain.scorePercent < 40) {
            beginnerTrackCount++;
          }
        }
      }
    }

    // Check for multiple beginner tracks
    if (beginnerTrackCount >= 3) {
      const alert = await this.createAlert(teacherId, 'MULTIPLE_BEGINNER_TRACKS', {
        condition: 'beginner_track_count >= 3',
        value: beginnerTrackCount,
        threshold: 3,
        trackScores,
      });
      alerts.push(alert);
    }

    // Check for inactivity
    const userDoc = await db.collection('users').doc(teacherId).get();
    let daysInactive = 0;
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.lastActiveAt) {
        const lastActive = userData.lastActiveAt.toDate();
        daysInactive = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    if (daysInactive >= 30) {
      const alert = await this.createAlert(teacherId, 'INACTIVE_30_DAYS', {
        condition: 'days_inactive >= 30',
        value: daysInactive,
        threshold: 30,
        daysInactive,
      });
      alerts.push(alert);
    } else if (daysInactive >= 14) {
      const alert = await this.createAlert(teacherId, 'INACTIVE_14_DAYS', {
        condition: 'days_inactive >= 14',
        value: daysInactive,
        threshold: 14,
        daysInactive,
      });
      alerts.push(alert);
    } else if (daysInactive >= 7) {
      const alert = await this.createAlert(teacherId, 'INACTIVE_7_DAYS', {
        condition: 'days_inactive >= 7',
        value: daysInactive,
        threshold: 7,
        daysInactive,
      });
      alerts.push(alert);
    }

    // Check for failed attempts
    const attemptSnapshot = await db
      .collection('competency_attempts')
      .where('teacherId', '==', teacherId)
      .where('status', '==', 'FAILED')
      .get();

    const failedAttempts = attemptSnapshot.size;
    if (failedAttempts >= 3) {
      const alert = await this.createAlert(teacherId, 'MULTIPLE_FAILED_ATTEMPTS', {
        condition: 'failed_attempts >= 3',
        value: failedAttempts,
        threshold: 3,
        failedAttempts,
      });
      alerts.push(alert);
    }

    // Determine overall risk
    let overallRisk: TeacherRiskAssessment['overallRisk'] = 'low';
    if (alerts.some((a) => a.urgency === 'critical')) {
      overallRisk = 'critical';
    } else if (alerts.some((a) => a.urgency === 'high')) {
      overallRisk = 'high';
    } else if (alerts.some((a) => a.urgency === 'medium')) {
      overallRisk = 'medium';
    }

    return {
      teacherId,
      overallRisk,
      alerts,
      beginnerTrackCount,
      daysInactive,
      failedAttempts,
      stalledPdModules: 0, // TODO: Implement PD stall detection
      lastAssessedAt: now,
    };
  }

  private async createAlert(
    teacherId: string,
    triggerType: keyof typeof URGENCY_TRIGGERS,
    triggerData: AlertTriggerData
  ): Promise<UrgencyAlert> {
    const trigger = URGENCY_TRIGGERS[triggerType];
    const now = Timestamp.now();
    const alertId = `alert-${teacherId}-${triggerType}-${Date.now()}`;

    // Get teacher's school
    const userDoc = await db.collection('users').doc(teacherId).get();
    const schoolId = userDoc.exists ? userDoc.data()?.schoolId : null;

    const alert: UrgencyAlert = {
      id: alertId,
      teacherId,
      schoolId,
      type: trigger.alertType as UrgencyAlert['type'],
      urgency: trigger.urgency as UrgencyAlert['urgency'],
      status: 'active',
      title: this.getAlertTitle(trigger.alertType),
      message: this.getAlertMessage(trigger.alertType, triggerData),
      triggerData,
      recommendedActions: this.getRecommendedActions(trigger.urgency),
      actionsTaken: [],
      createdAt: now,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    await db.collection('urgency_alerts').doc(alertId).set(alert);

    // Notify admins for high/critical alerts
    if (trigger.urgency === 'high' || trigger.urgency === 'critical') {
      await this.notifyAdmins(alert);
    }

    // Send nudge to teacher for medium alerts
    if (trigger.urgency === 'medium') {
      await this.sendNudge(teacherId, alert);
    }

    return alert;
  }

  private getAlertTitle(alertType: string): string {
    const titles: Record<string, string> = {
      high_risk_teacher: 'High-Risk Teacher Alert',
      inactivity_nudge: 'Activity Reminder',
      inactivity_warning: 'Inactivity Warning',
      inactivity_critical: 'Critical Inactivity Alert',
      struggling_teacher: 'Teacher Needs Support',
      pd_stalled: 'PD Progress Stalled',
    };
    return titles[alertType] || 'Alert';
  }

  private getAlertMessage(alertType: string, data: AlertTriggerData): string {
    const messages: Record<string, string> = {
      high_risk_teacher: `Teacher has ${data.value} beginner-level tracks and needs intensive support.`,
      inactivity_nudge: `Teacher has been inactive for ${data.daysInactive} days.`,
      inactivity_warning: `Teacher has been inactive for ${data.daysInactive} days. Please check in.`,
      inactivity_critical: `Critical: Teacher has been inactive for ${data.daysInactive} days.`,
      struggling_teacher: `Teacher has failed ${data.failedAttempts} assessment attempts.`,
      pd_stalled: 'Assigned PD modules have not been completed within expected timeframe.',
    };
    return messages[alertType] || 'An alert condition was triggered.';
  }

  private getRecommendedActions(urgency: string): UrgencyAlert['recommendedActions'] {
    switch (urgency) {
      case 'critical':
        return [ALERT_ACTIONS.ESCALATE, ALERT_ACTIONS.NOTIFY_ADMIN, ALERT_ACTIONS.ASSIGN_COACH] as UrgencyAlert['recommendedActions'];
      case 'high':
        return [ALERT_ACTIONS.NOTIFY_ADMIN, ALERT_ACTIONS.ASSIGN_COACH] as UrgencyAlert['recommendedActions'];
      case 'medium':
        return [ALERT_ACTIONS.SEND_NUDGE, ALERT_ACTIONS.NOTIFY_ADMIN] as UrgencyAlert['recommendedActions'];
      default:
        return [ALERT_ACTIONS.SEND_NUDGE] as UrgencyAlert['recommendedActions'];
    }
  }

  private async notifyAdmins(alert: UrgencyAlert): Promise<void> {
    if (!alert.schoolId) return;

    const adminsSnapshot = await db
      .collection('users')
      .where('schoolId', '==', alert.schoolId)
      .where('role', '==', 'school_admin')
      .get();

    for (const adminDoc of adminsSnapshot.docs) {
      await notificationService.createNotification({
        userId: adminDoc.id,
        type: 'urgency_alert',
        title: alert.title,
        message: alert.message,
        metadata: { alertId: alert.id, teacherId: alert.teacherId, urgency: alert.urgency },
      });
    }
  }

  private async sendNudge(teacherId: string, alert: UrgencyAlert): Promise<void> {
    await notificationService.createNotification({
      userId: teacherId,
      type: 'nudge',
      title: 'We miss you!',
      message: 'Continue your professional development journey. Your next module awaits!',
      metadata: { alertId: alert.id },
    });
  }

  /**
   * Get active alerts for a school
   */
  async getSchoolAlerts(schoolId: string): Promise<UrgencyAlert[]> {
    const snapshot = await db
      .collection('urgency_alerts')
      .where('schoolId', '==', schoolId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as UrgencyAlert);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, adminId: string): Promise<void> {
    await db.collection('urgency_alerts').doc(alertId).update({
      status: 'acknowledged',
      acknowledgedAt: Timestamp.now(),
      acknowledgedBy: adminId,
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, adminId: string, notes: string): Promise<void> {
    const now = Timestamp.now();
    await db.collection('urgency_alerts').doc(alertId).update({
      status: 'resolved',
      resolvedAt: now,
      resolvedBy: adminId,
      actionsTaken: FieldValue.arrayUnion({
        action: 'resolved',
        performedAt: now,
        performedBy: adminId,
        notes,
      }),
    });
  }
}

// ============ CREDENTIAL SERVICE ============

export class CredentialService {
  /**
   * Issue a credential to a teacher
   */
  async issueCredential(
    teacherId: string,
    type: SmartCredential['type'],
    name: string,
    trackId: string | null,
    badgeId: string | null,
    skills: string[],
    metadata: Partial<CredentialMetadata>
  ): Promise<SmartCredential> {
    const now = Timestamp.now();
    const credentialId = `cred-${teacherId}-${Date.now()}`;

    // Generate verification hash
    const verificationHash = this.generateVerificationHash(credentialId, teacherId, name);

    const credential: SmartCredential = {
      id: credentialId,
      teacherId,
      type,
      name,
      description: `${name} - Issued for professional development achievement`,
      trackId,
      competencyKey: null,
      badgeId,
      status: CREDENTIAL_STATUS.ISSUED as SmartCredential['status'],
      visibility: CREDENTIAL_VISIBILITY.PUBLIC as SmartCredential['visibility'],
      issuedAt: now,
      expiresAt: null,
      verificationHash,
      verificationUrl: `https://gurucool.ai/verify/${credentialId}`,
      skills,
      metadata: {
        issuer: 'GuruCool AI',
        ...metadata,
      },
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('credentials').doc(credentialId).set(credential);

    // Send notification
    await notificationService.createNotification({
      userId: teacherId,
      type: 'credential_issued',
      title: 'Credential Issued!',
      message: `Your "${name}" credential is now available and can be shared on LinkedIn!`,
      metadata: { credentialId, credentialName: name },
    });

    return credential;
  }

  private generateVerificationHash(credentialId: string, teacherId: string, name: string): string {
    // Simple hash for demo - in production, use proper cryptographic hashing
    const data = `${credentialId}-${teacherId}-${name}-${Date.now()}`;
    return Buffer.from(data).toString('base64').slice(0, 32);
  }

  /**
   * Get all credentials for a teacher
   */
  async getTeacherCredentials(teacherId: string): Promise<SmartCredential[]> {
    const snapshot = await db
      .collection('credentials')
      .where('teacherId', '==', teacherId)
      .orderBy('issuedAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => doc.data() as SmartCredential);
  }

  /**
   * Verify a credential
   */
  async verifyCredential(credentialId: string): Promise<{ isValid: boolean; credential: SmartCredential | null }> {
    const doc = await db.collection('credentials').doc(credentialId).get();

    if (!doc.exists) {
      return { isValid: false, credential: null };
    }

    const credential = doc.data() as SmartCredential;
    const isValid = credential.status === CREDENTIAL_STATUS.ISSUED || credential.status === CREDENTIAL_STATUS.VERIFIED;

    return { isValid, credential };
  }
}

// ============ GROWTH SNAPSHOT SERVICE ============

export class GrowthSnapshotService {
  /**
   * Generate a growth journey snapshot for a teacher
   */
  async generateSnapshot(
    teacherId: string,
    frequency: GrowthJourneySnapshot['frequency']
  ): Promise<GrowthJourneySnapshot> {
    const now = Timestamp.now();
    const snapshotId = `snapshot-${teacherId}-${frequency}-${Date.now()}`;

    // Calculate period dates
    const periodEnd = now;
    let periodStart: Timestamp;
    switch (frequency) {
      case 'weekly':
        periodStart = Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        periodStart = Timestamp.fromMillis(now.toMillis() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        periodStart = Timestamp.fromMillis(now.toMillis() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    // Gather metrics
    const metrics = await this.gatherMetrics(teacherId, periodStart, periodEnd);
    const trackProgress = await this.gatherTrackProgress(teacherId);
    const highlights = await this.gatherHighlights(teacherId, periodStart, periodEnd);
    const recommendations = this.generateRecommendations(metrics, trackProgress);

    // Get previous snapshot for comparison
    const previousSnapshot = await this.getPreviousSnapshot(teacherId, frequency);
    const comparisonToPrevious = previousSnapshot
      ? this.compareMetrics(metrics, previousSnapshot.metrics)
      : null;

    // Get school ID
    const userDoc = await db.collection('users').doc(teacherId).get();
    const schoolId = userDoc.exists ? userDoc.data()?.schoolId : null;

    const snapshot: GrowthJourneySnapshot = {
      id: snapshotId,
      teacherId,
      schoolId,
      frequency,
      periodStart,
      periodEnd,
      metrics,
      trackProgress,
      highlights,
      recommendations,
      comparisonToPrevious,
      generatedAt: now,
    };

    await db.collection('growth_snapshots').doc(snapshotId).set(snapshot);

    return snapshot;
  }

  private async gatherMetrics(
    teacherId: string,
    periodStart: Timestamp,
    periodEnd: Timestamp
  ): Promise<GrowthMetrics> {
    // Get badges
    const badgesSnapshot = await db
      .collection('badges')
      .where('teacherId', '==', teacherId)
      .where('status', '==', BADGE_STATUS.EARNED)
      .get();

    const badgesThisPeriod = badgesSnapshot.docs.filter((doc) => {
      const earnedAt = doc.data().earnedAt;
      return earnedAt && earnedAt.toMillis() >= periodStart.toMillis();
    });

    // Get modules completed
    const modulesSnapshot = await db
      .collection('pd_attempts')
      .where('teacherId', '==', teacherId)
      .where('status', '==', 'passed')
      .get();

    const modulesThisPeriod = modulesSnapshot.docs.filter((doc) => {
      const completedAt = doc.data().completedAt;
      return completedAt && completedAt.toMillis() >= periodStart.toMillis();
    });

    // Get reflections
    const reflectionsSnapshot = await db
      .collection('reflections')
      .where('teacherId', '==', teacherId)
      .where('status', '==', REFLECTION_STATUS.EVALUATED)
      .get();

    const reflectionScores = reflectionsSnapshot.docs.map(
      (doc) => doc.data().evaluation?.overallScore || 0
    );
    const avgReflectionQuality =
      reflectionScores.length > 0
        ? reflectionScores.reduce((a, b) => a + b, 0) / reflectionScores.length
        : 0;

    // Get peer interactions
    const interactionsSnapshot = await db
      .collection('cohort_interactions')
      .where('fromTeacherId', '==', teacherId)
      .get();

    // Get overall progress from competency result
    const resultSnapshot = await db
      .collection('competency_results')
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const overallProgress = !resultSnapshot.empty
      ? resultSnapshot.docs[0].data().overallScore || 0
      : 0;

    return {
      overallProgress,
      badgeCount: badgesSnapshot.size,
      badgesEarnedThisPeriod: badgesThisPeriod.length,
      reflectionQualityAvg: Math.round(avgReflectionQuality),
      peerInteractions: interactionsSnapshot.size,
      modulesCompleted: modulesSnapshot.size,
      modulesCompletedThisPeriod: modulesThisPeriod.length,
      streakDays: 0, // TODO: Implement streak tracking
      longestStreak: 0,
      mentorSessions: 0, // TODO: Implement mentor session tracking
      mentorSessionsThisPeriod: 0,
      totalTimeSpentMinutes: 0, // TODO: Implement time tracking
    };
  }

  private async gatherTrackProgress(teacherId: string): Promise<TrackProgressSnapshot[]> {
    const progress: TrackProgressSnapshot[] = [];

    // Get competency result
    const resultSnapshot = await db
      .collection('competency_results')
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const domainScores: Record<string, number> = {};
    if (!resultSnapshot.empty) {
      const result = resultSnapshot.docs[0].data();
      if (result.domainScores) {
        for (const domain of result.domainScores) {
          domainScores[domain.domainKey] = domain.scorePercent;
        }
      }
    }

    // Get badges
    const badgesSnapshot = await db
      .collection('badges')
      .where('teacherId', '==', teacherId)
      .where('status', '==', BADGE_STATUS.EARNED)
      .get();

    const earnedBadges = badgesSnapshot.docs.map((doc) => doc.data().name);

    for (const [key, track] of Object.entries(PD_TRACKS)) {
      // Calculate average score for track competencies
      const trackScores = track.competencies.map((c) => domainScores[c] || 0);
      const avgScore =
        trackScores.length > 0
          ? trackScores.reduce((a, b) => a + b, 0) / trackScores.length
          : 0;

      // Determine proficiency level
      let proficiencyLevel: string = PROFICIENCY_LEVELS.BEGINNER;
      if (avgScore >= 80) proficiencyLevel = PROFICIENCY_LEVELS.ADVANCED;
      else if (avgScore >= 60) proficiencyLevel = PROFICIENCY_LEVELS.PROFICIENT;
      else if (avgScore >= 40) proficiencyLevel = PROFICIENCY_LEVELS.DEVELOPING;

      // Get modules for this track
      const modulesSnapshot = await db
        .collection('pd_attempts')
        .where('teacherId', '==', teacherId)
        .where('trackId', '==', track.id)
        .where('status', '==', 'passed')
        .get();

      const trackBadges = earnedBadges.filter(
        (b) => b === track.badge || (track.microBadges as readonly string[]).includes(b)
      );

      progress.push({
        trackId: track.id,
        trackName: track.name,
        proficiencyLevel,
        scorePercent: Math.round(avgScore),
        modulesCompleted: modulesSnapshot.size,
        modulesTotal: 3, // Assuming 3 modules per track
        badgesEarned: trackBadges,
        status: avgScore >= 80 ? 'completed' : avgScore > 0 ? 'in_progress' : 'not_started',
      });
    }

    return progress;
  }

  private async gatherHighlights(
    teacherId: string,
    periodStart: Timestamp,
    periodEnd: Timestamp
  ): Promise<GrowthHighlight[]> {
    const highlights: GrowthHighlight[] = [];

    // Get badges earned this period
    const badgesSnapshot = await db
      .collection('badges')
      .where('teacherId', '==', teacherId)
      .where('earnedAt', '>=', periodStart)
      .where('earnedAt', '<=', periodEnd)
      .get();

    for (const doc of badgesSnapshot.docs) {
      const badge = doc.data();
      highlights.push({
        type: 'badge_earned',
        title: `Earned "${badge.name}" Badge`,
        description: badge.description,
        date: badge.earnedAt,
        metadata: { badgeId: badge.id },
      });
    }

    // Get modules completed this period
    const modulesSnapshot = await db
      .collection('pd_attempts')
      .where('teacherId', '==', teacherId)
      .where('status', '==', 'passed')
      .where('completedAt', '>=', periodStart)
      .where('completedAt', '<=', periodEnd)
      .get();

    for (const doc of modulesSnapshot.docs) {
      const attempt = doc.data();
      highlights.push({
        type: 'module_completed',
        title: 'Module Completed',
        description: `Completed PD module with score: ${attempt.scorePercent}%`,
        date: attempt.completedAt,
        metadata: { moduleId: attempt.moduleId },
      });
    }

    return highlights.sort((a, b) => b.date.toMillis() - a.date.toMillis()).slice(0, 10);
  }

  private generateRecommendations(
    metrics: GrowthMetrics,
    trackProgress: TrackProgressSnapshot[]
  ): string[] {
    const recommendations: string[] = [];

    // Based on overall progress
    if (metrics.overallProgress < 40) {
      recommendations.push('Focus on completing foundational modules to build your baseline skills.');
    }

    // Based on reflection quality
    if (metrics.reflectionQualityAvg < 60) {
      recommendations.push('Spend more time on your reflections - they help deepen your learning.');
    }

    // Based on peer interactions
    if (metrics.peerInteractions < 3) {
      recommendations.push('Engage more with your cohort peers for collaborative learning.');
    }

    // Based on track progress
    const lowestTrack = trackProgress.reduce((min, t) =>
      t.scorePercent < min.scorePercent ? t : min
    );
    if (lowestTrack.scorePercent < 50) {
      recommendations.push(`Focus on improving your "${lowestTrack.trackName}" skills.`);
    }

    // Based on badges
    if (metrics.badgesEarnedThisPeriod === 0 && metrics.modulesCompletedThisPeriod > 0) {
      recommendations.push('Complete a reflection and peer interaction to earn your next badge!');
    }

    return recommendations.slice(0, 5);
  }

  private async getPreviousSnapshot(
    teacherId: string,
    frequency: string
  ): Promise<GrowthJourneySnapshot | null> {
    const snapshot = await db
      .collection('growth_snapshots')
      .where('teacherId', '==', teacherId)
      .where('frequency', '==', frequency)
      .orderBy('generatedAt', 'desc')
      .limit(2)
      .get();

    if (snapshot.docs.length < 2) return null;
    return snapshot.docs[1].data() as GrowthJourneySnapshot;
  }

  private compareMetrics(
    current: GrowthMetrics,
    previous: GrowthMetrics
  ): GrowthJourneySnapshot['comparisonToPrevious'] {
    const changes: Record<keyof GrowthMetrics, number> = {} as Record<keyof GrowthMetrics, number>;
    let totalChange = 0;
    let metricCount = 0;

    for (const key of Object.keys(current) as (keyof GrowthMetrics)[]) {
      const curr = current[key] as number;
      const prev = previous[key] as number;
      if (prev === 0) {
        changes[key] = curr > 0 ? 100 : 0;
      } else {
        changes[key] = Math.round(((curr - prev) / prev) * 100);
      }
      totalChange += changes[key];
      metricCount++;
    }

    const avgChange = totalChange / metricCount;
    let trend: 'improving' | 'stable' | 'declining';
    if (avgChange > 10) trend = 'improving';
    else if (avgChange < -10) trend = 'declining';
    else trend = 'stable';

    return {
      previousPeriod: previous,
      changes,
      trend,
    };
  }

  /**
   * Get snapshots for a teacher
   */
  async getTeacherSnapshots(teacherId: string): Promise<GrowthJourneySnapshot[]> {
    const snapshot = await db
      .collection('growth_snapshots')
      .where('teacherId', '==', teacherId)
      .orderBy('generatedAt', 'desc')
      .limit(10)
      .get();

    return snapshot.docs.map((doc) => doc.data() as GrowthJourneySnapshot);
  }
}

// ============ EXPORT SINGLETON INSTANCES ============

export const badgeService = new BadgeService();
export const cohortService = new CohortService();
export const reflectionService = new ReflectionService();
export const urgencyAlertService = new UrgencyAlertService();
export const credentialService = new CredentialService();
export const growthSnapshotService = new GrowthSnapshotService();
