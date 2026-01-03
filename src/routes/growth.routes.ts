/**
 * Growth Routes
 * Routes for: Badges, Cohorts, Reflections, Credentials, Alerts, Snapshots
 */

import { Router } from 'express';
import {
  getMyBadges,
  checkBadgeEligibility,
  getMyCohort,
  joinCohort,
  recordCohortInteraction,
  submitReflection,
  getMyReflections,
  getMyCredentials,
  verifyCredential,
  generateSnapshot,
  getMySnapshots,
  getSchoolAlerts,
  assessTeacherRisk,
  acknowledgeAlert,
  resolveAlert,
} from '../controllers/growth.controller';
import { authMiddleware } from '../middlewares/auth';
import { requireTeacher, requireRoles } from '../middlewares/role.guard';
import { requireNotSuspended } from '../middlewares/suspension';
import { USER_ROLES } from '../config/constants';

const router = Router();

// Base middleware for authenticated teachers
const teacherMiddleware = [authMiddleware, requireTeacher(), requireNotSuspended];

// Admin middleware
const adminMiddleware = [
  authMiddleware,
  requireRoles([USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PLATFORM_ADMIN]),
];

// ============ BADGE ROUTES ============

// Get all my badges
router.get('/badges', ...teacherMiddleware, getMyBadges);

// Check badge eligibility
router.post('/badges/check-eligibility', ...teacherMiddleware, checkBadgeEligibility);

// ============ COHORT ROUTES ============

// Get my cohort for a track
router.get('/cohorts/:trackId', ...teacherMiddleware, getMyCohort);

// Join a cohort
router.post('/cohorts/join', ...teacherMiddleware, joinCohort);

// Record a cohort interaction
router.post('/cohorts/interactions', ...teacherMiddleware, recordCohortInteraction);

// ============ REFLECTION ROUTES ============

// Submit a reflection
router.post('/reflections', ...teacherMiddleware, submitReflection);

// Get my reflections
router.get('/reflections', ...teacherMiddleware, getMyReflections);

// ============ CREDENTIAL ROUTES ============

// Get my credentials
router.get('/credentials', ...teacherMiddleware, getMyCredentials);

// Verify a credential (public - no auth required)
router.get('/credentials/verify/:credentialId', verifyCredential);

// ============ GROWTH SNAPSHOT ROUTES ============

// Generate a growth snapshot
router.post('/snapshots', ...teacherMiddleware, generateSnapshot);

// Get my snapshots
router.get('/snapshots', ...teacherMiddleware, getMySnapshots);

// ============ ADMIN: URGENCY ALERTS ROUTES ============

// Get school alerts
router.get('/admin/alerts', ...adminMiddleware, getSchoolAlerts);

// Assess teacher risk
router.get('/admin/risk/:teacherId', ...adminMiddleware, assessTeacherRisk);

// Acknowledge an alert
router.post('/admin/alerts/:alertId/acknowledge', ...adminMiddleware, acknowledgeAlert);

// Resolve an alert
router.post('/admin/alerts/:alertId/resolve', ...adminMiddleware, resolveAlert);

export default router;
