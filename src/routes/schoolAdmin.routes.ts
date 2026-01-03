import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requireAnyAdmin } from '../middlewares/role.guard';
import { schoolAssociationMiddleware } from '../middlewares/schoolAssociation';
import { validate, validateParams } from '../middlewares/validate';
import {
  teacherInviteSchema,
  bulkInviteSchema,
  assignmentSchema,
} from '../schemas/admin.schema';
import {
  listTeachers,
  inviteTeacher,
  bulkInvite,
  removeTeacher,
  listAssignments,
  createAssignment,
  deleteAssignment,
  viewProgress,
  viewTeacherProgress,
} from '../controllers/schoolAdmin.controller';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/admin/school/teachers - List all teachers in a school
 */
router.get(
  '/teachers',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  listTeachers
);

/**
 * POST /api/admin/school/invite - Invite a single teacher
 */
router.post(
  '/invite',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  validate(teacherInviteSchema),
  inviteTeacher
);

/**
 * POST /api/admin/school/invite/bulk - Invite multiple teachers
 */
router.post(
  '/invite/bulk',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  validate(bulkInviteSchema),
  bulkInvite
);

/**
 * DELETE /api/admin/school/teachers/:id - Remove a teacher
 */
router.delete(
  '/teachers/:id',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  validateParams(z.object({ id: z.string() })),
  removeTeacher
);

/**
 * GET /api/admin/school/assignments - List all assignments
 */
router.get(
  '/assignments',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  listAssignments
);

/**
 * POST /api/admin/school/assignments - Create a new assignment
 */
router.post(
  '/assignments',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  validate(assignmentSchema),
  createAssignment
);

/**
 * DELETE /api/admin/school/assignments/:id - Delete an assignment
 */
router.delete(
  '/assignments/:id',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  validateParams(z.object({ id: z.string() })),
  deleteAssignment
);

/**
 * GET /api/admin/school/progress - View progress for all teachers
 */
router.get(
  '/progress',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  viewProgress
);

/**
 * GET /api/admin/school/progress/:teacherId - View progress for a specific teacher
 */
router.get(
  '/progress/:teacherId',
  authMiddleware,
  requireAnyAdmin(),
  schoolAssociationMiddleware(),
  validateParams(z.object({ teacherId: z.string() })),
  viewTeacherProgress
);

export default router;
