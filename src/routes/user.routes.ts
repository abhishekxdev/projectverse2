import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  enforceAssessmentLimit,
  enforceTutorMessageLimit,
} from '../middlewares/tier.guard';
import { HTTP_STATUS } from '../config/constants';
import { successResponse, errorResponse } from '../utils/response';
import { getUserPermissions } from '../services/learning.services';
import { AuthRequiredError } from '../utils/error';

const userRouter = Router();

// Placeholder: start assessment (enforces assessment limit)
userRouter.post(
  '/assessments/start',
  authMiddleware,
  enforceAssessmentLimit,
  (req, res) => {
    return res
      .status(HTTP_STATUS.OK)
      .json({ success: true, data: { started: true } });
  }
);

// Placeholder: tutor message send (enforces tutor message limit)
userRouter.post(
  '/tutor/message',
  authMiddleware,
  enforceTutorMessageLimit,
  (req, res) => {
    return res
      .status(HTTP_STATUS.OK)
      .json({ success: true, data: { sent: true } });
  }
);

userRouter.get('/me/permissions', authMiddleware, (req, res) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const permissions = getUserPermissions(req.user);
    return successResponse(res, permissions);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
});

export default userRouter;
