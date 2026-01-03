/**
 * Growth Controller
 * Handles: Badges, Cohorts, Reflections, Credentials, Alerts, Snapshots
 */

import { Request, Response, NextFunction } from 'express';
import {
  badgeService,
  cohortService,
  reflectionService,
  urgencyAlertService,
  credentialService,
  growthSnapshotService,
} from '../services/growth.service';
import { HTTP_STATUS } from '../config/constants';
import { logger } from '../utils/logger';

// ============ BADGE ENDPOINTS ============

/**
 * Get all badges for the authenticated teacher
 */
export const getMyBadges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const badges = await badgeService.getTeacherBadges(teacherId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: badges,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check badge eligibility for a track
 */
export const checkBadgeEligibility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const { trackId, score } = req.body;

    const result = await badgeService.evaluateBadgeEligibility(teacherId, trackId, score);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ============ COHORT ENDPOINTS ============

/**
 * Get cohort for a track
 */
export const getMyCohort = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const { trackId } = req.params;

    const cohort = await cohortService.getTeacherCohort(teacherId, trackId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: cohort,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Join a cohort
 */
export const joinCohort = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const { trackId, proficiencyLevel } = req.body;

    const result = await cohortService.placeInCohort(teacherId, trackId, proficiencyLevel);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record a cohort interaction
 */
export const recordCohortInteraction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const { cohortId, toTeacherId, type, content } = req.body;

    const interaction = await cohortService.recordInteraction(
      cohortId,
      teacherId,
      toTeacherId,
      type,
      content
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: interaction,
    });
  } catch (error) {
    next(error);
  }
};

// ============ REFLECTION ENDPOINTS ============

/**
 * Submit a reflection
 */
export const submitReflection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const { moduleId, trackId, response, prompt } = req.body;

    const reflection = await reflectionService.submitReflection(
      teacherId,
      moduleId,
      trackId,
      response,
      prompt
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: reflection,
      message: 'Reflection submitted for evaluation',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my reflections
 */
export const getMyReflections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const reflections = await reflectionService.getTeacherReflections(teacherId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: reflections,
    });
  } catch (error) {
    next(error);
  }
};

// ============ CREDENTIAL ENDPOINTS ============

/**
 * Get my credentials
 */
export const getMyCredentials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const credentials = await credentialService.getTeacherCredentials(teacherId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: credentials,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify a credential (public endpoint)
 */
export const verifyCredential = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credentialId } = req.params;
    const result = await credentialService.verifyCredential(credentialId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ============ GROWTH SNAPSHOT ENDPOINTS ============

/**
 * Generate a growth snapshot
 */
export const generateSnapshot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const { frequency } = req.body;

    const snapshot = await growthSnapshotService.generateSnapshot(teacherId, frequency);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my snapshots
 */
export const getMySnapshots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.user!.uid;
    const snapshots = await growthSnapshotService.getTeacherSnapshots(teacherId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: snapshots,
    });
  } catch (error) {
    next(error);
  }
};

// ============ ADMIN: URGENCY ALERTS ENDPOINTS ============

/**
 * Get school alerts (admin only)
 */
export const getSchoolAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user!.schoolId;
    if (!schoolId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'No school associated',
      });
    }

    const alerts = await urgencyAlertService.getSchoolAlerts(schoolId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assess teacher risk (admin only)
 */
export const assessTeacherRisk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teacherId } = req.params;
    const assessment = await urgencyAlertService.assessTeacherRisk(teacherId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Acknowledge an alert (admin only)
 */
export const acknowledgeAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.uid;
    const { alertId } = req.params;

    await urgencyAlertService.acknowledgeAlert(alertId, adminId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Alert acknowledged',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve an alert (admin only)
 */
export const resolveAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.uid;
    const { alertId } = req.params;
    const { notes } = req.body;

    await urgencyAlertService.resolveAlert(alertId, adminId, notes);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Alert resolved',
    });
  } catch (error) {
    next(error);
  }
};
