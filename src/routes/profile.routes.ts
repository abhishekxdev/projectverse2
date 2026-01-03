import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  submitProfileApproval,
  listPendingApprovals,
  approveProfile,
  rejectProfile,
} from '../controllers/profileApproval.controller';
import { requirePlatformAdmin } from '../middlewares/role.guard';
import { checkUserNotSuspended } from '../middlewares/suspension';

const profileRouter = Router();

profileRouter.post(
  '/submit-approval',
  authMiddleware,
  checkUserNotSuspended,
  submitProfileApproval
);

const adminProfileRouter = Router();

adminProfileRouter.get(
  '/pending',
  authMiddleware,
  requirePlatformAdmin(),
  listPendingApprovals
);

adminProfileRouter.put(
  '/:userId/approve',
  authMiddleware,
  requirePlatformAdmin(),
  approveProfile
);

adminProfileRouter.put(
  '/:userId/reject',
  authMiddleware,
  requirePlatformAdmin(),
  rejectProfile
);

export default profileRouter;
export { adminProfileRouter };
