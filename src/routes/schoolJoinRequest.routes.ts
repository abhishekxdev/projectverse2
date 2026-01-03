import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requireSchoolAdmin } from '../middlewares/role.guard';
import { checkUserNotSuspended } from '../middlewares/suspension';
import {
  submitJoinRequest,
  getJoinRequestStatus,
  listPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from '../controllers/schoolJoinRequest.controller';

// User-facing routes (mounted on /schools)
const schoolJoinRequestRouter = Router();

/**
 * POST /api/schools/:schoolId/join-request
 * User requests to join a school
 */
schoolJoinRequestRouter.post(
  '/:schoolId/join-request',
  authMiddleware,
  checkUserNotSuspended,
  submitJoinRequest
);

/**
 * GET /api/schools/:schoolId/join-request/status
 * User checks their own request status
 */
schoolJoinRequestRouter.get(
  '/:schoolId/join-request/status',
  authMiddleware,
  getJoinRequestStatus
);

// Admin routes (mounted on /admin/school)
const schoolJoinAdminRouter = Router();

/**
 * GET /api/admin/school/join-requests
 * School admin lists pending join requests
 */
schoolJoinAdminRouter.get(
  '/join-requests',
  authMiddleware,
  requireSchoolAdmin(),
  listPendingJoinRequests
);

/**
 * PUT /api/admin/school/join-requests/:requestId/approve
 * School admin approves a join request
 */
schoolJoinAdminRouter.put(
  '/join-requests/:requestId/approve',
  authMiddleware,
  requireSchoolAdmin(),
  approveJoinRequest
);

/**
 * PUT /api/admin/school/join-requests/:requestId/reject
 * School admin rejects a join request
 */
schoolJoinAdminRouter.put(
  '/join-requests/:requestId/reject',
  authMiddleware,
  requireSchoolAdmin(),
  rejectJoinRequest
);

export { schoolJoinRequestRouter, schoolJoinAdminRouter };
