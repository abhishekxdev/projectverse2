import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePlatformAdmin } from '../middlewares/role.guard';
import { validate, validateParams } from '../middlewares/validate';
import {
  suspendSchool,
  unsuspendSchool,
  suspendTeacher,
  unsuspendTeacher,
  listAllTeachers,
  listAllSchools,
  updateSchoolSeatLimit,
} from '../controllers/platformAdmin.controller';
import { platformAdminSeatUpdateSchema } from '../schemas/platformAdmin.schema';
import { z } from 'zod';

const platformAdminRouter = Router();

platformAdminRouter.post(
  '/schools/:id/suspend',
  authMiddleware,
  requirePlatformAdmin(),
  suspendSchool
);

platformAdminRouter.post(
  '/schools/:id/unsuspend',
  authMiddleware,
  requirePlatformAdmin(),
  unsuspendSchool
);

platformAdminRouter.put(
  '/schools/:id/seats',
  authMiddleware,
  requirePlatformAdmin(),
  validateParams(z.object({ id: z.string() })),
  validate(platformAdminSeatUpdateSchema),
  updateSchoolSeatLimit
);

platformAdminRouter.get(
  '/schools',
  authMiddleware,
  requirePlatformAdmin(),
  listAllSchools
);

platformAdminRouter.post(
  '/users/:id/suspend',
  authMiddleware,
  requirePlatformAdmin(),
  suspendTeacher
);

platformAdminRouter.post(
  '/users/:id/unsuspend',
  authMiddleware,
  requirePlatformAdmin(),
  unsuspendTeacher
);

platformAdminRouter.get(
  '/teachers',
  authMiddleware,
  requirePlatformAdmin(),
  listAllTeachers
);

export default platformAdminRouter;
