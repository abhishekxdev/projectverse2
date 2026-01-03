import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { validate, validateParams } from '../middlewares/validate';
import {
  schoolRegistrationSchema,
  schoolUpdateSchema,
} from '../schemas/admin.schema';
import {
  listSchools,
  registerSchool,
  getSchool,
  updateSchool,
} from '../controllers/school.controller';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/schools - List all schools
 */
router.get('/', listSchools);

/**
 * POST /api/schools/register - Register a new school
 */
router.post('/register', validate(schoolRegistrationSchema), registerSchool);

/**
 * GET /api/schools/:id - Get school details by ID
 */
router.get('/:id', validateParams(z.object({ id: z.string() })), getSchool);

/**
 * PUT /api/schools/:id - Update school information
 */
router.put(
  '/:id',
  authMiddleware,
  validateParams(z.object({ id: z.string() })),
  validate(schoolUpdateSchema),
  updateSchool
);

export default router;
