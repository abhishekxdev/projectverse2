import { Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { createProfileApprovalService } from '../services/profileApproval.service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequiredError, AppError } from '../utils/error';
import { HTTP_STATUS } from '../config/constants';

const profileApprovalService = createProfileApprovalService();

export const submitProfileApproval = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const updated = await profileApprovalService.submitProfileForApproval({
      userId: req.user.id,
      actorId: req.user.id,
    });

    return successResponse(res, { status: updated.status });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const listPendingApprovals = async (req: ApiRequest, res: Response) => {
  try {
    const limit = req.query.limit
      ? parseInt(String(req.query.limit), 10)
      : undefined;
    const startAfter = req.query.startAfter
      ? String(req.query.startAfter)
      : undefined;
    const role = req.query.role ? String(req.query.role) : undefined;

    const pending = await profileApprovalService.listPendingProfiles({
      limit,
      startAfter,
      role,
    });

    return successResponse(res, pending);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const approveProfile = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { userId } = req.params;
    if (!userId) {
      throw new AppError(
        'User ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'USER_ID_REQUIRED'
      );
    }

    const updated = await profileApprovalService.approveProfile({
      userId,
      reviewerId: req.user.id,
      reviewerRole: req.user.role,
      reviewerSchoolId: req.user.schoolId,
    });

    return successResponse(res, { status: updated.status });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const rejectProfile = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { userId } = req.params;
    const { reason } = req.body ?? {};

    if (!userId) {
      throw new AppError(
        'User ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'USER_ID_REQUIRED'
      );
    }

    const updated = await profileApprovalService.rejectProfile({
      userId,
      reviewerId: req.user.id,
      reviewerRole: req.user.role,
      reviewerSchoolId: req.user.schoolId,
      reason,
    });

    return successResponse(res, { status: updated.status });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};
