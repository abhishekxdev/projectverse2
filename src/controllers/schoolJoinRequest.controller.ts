import { Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { schoolJoinRequestService } from '../services/schoolJoinRequest.service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequiredError, AppError } from '../utils/error';
import { HTTP_STATUS } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * POST /api/schools/:schoolId/join-request
 * User requests to join a school
 */
export const submitJoinRequest = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { schoolId } = req.params;
    const { message } = req.body ?? {};

    if (!schoolId) {
      throw new AppError(
        'School ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'SCHOOL_ID_REQUIRED'
      );
    }

    const request = await schoolJoinRequestService.submitJoinRequest(
      req.user.id,
      req.user.email,
      req.user.profile?.displayName as string | undefined,
      schoolId,
      message
    );

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: request,
    });
  } catch (error) {
    logger.error('Error in submitJoinRequest', error as Error, {
      userId: req.user?.id,
      schoolId: req.params.schoolId,
    });
    return errorResponse(res, error as Error);
  }
};

/**
 * GET /api/schools/:schoolId/join-request/status
 * User checks their own request status
 */
export const getJoinRequestStatus = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { schoolId } = req.params;

    if (!schoolId) {
      throw new AppError(
        'School ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'SCHOOL_ID_REQUIRED'
      );
    }

    const request = await schoolJoinRequestService.getRequestStatus(
      req.user.id,
      schoolId
    );

    return successResponse(res, request);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * GET /api/admin/school/join-requests
 * School admin lists pending join requests for their school
 */
export const listPendingJoinRequests = async (
  req: ApiRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    if (!req.user.schoolId) {
      throw new AppError(
        'You must be associated with a school to view join requests',
        HTTP_STATUS.FORBIDDEN,
        'NO_SCHOOL_ASSOCIATION'
      );
    }

    const requests = await schoolJoinRequestService.listPendingForSchool(
      req.user.schoolId
    );

    return successResponse(res, requests);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * PUT /api/admin/school/join-requests/:requestId/approve
 * School admin approves a join request
 */
export const approveJoinRequest = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { requestId } = req.params;

    if (!requestId) {
      throw new AppError(
        'Request ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'REQUEST_ID_REQUIRED'
      );
    }

    if (!req.user.schoolId) {
      throw new AppError(
        'You must be associated with a school to approve requests',
        HTTP_STATUS.FORBIDDEN,
        'NO_SCHOOL_ASSOCIATION'
      );
    }

    const updated = await schoolJoinRequestService.approveRequest(
      requestId,
      req.user.id,
      req.user.schoolId
    );

    return successResponse(res, {
      requestId: updated.id,
      status: updated.status,
      message: 'Join request approved. User has been added to your school.',
    });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * PUT /api/admin/school/join-requests/:requestId/reject
 * School admin rejects a join request
 */
export const rejectJoinRequest = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { requestId } = req.params;
    const { reason } = req.body ?? {};

    if (!requestId) {
      throw new AppError(
        'Request ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'REQUEST_ID_REQUIRED'
      );
    }

    if (!req.user.schoolId) {
      throw new AppError(
        'You must be associated with a school to reject requests',
        HTTP_STATUS.FORBIDDEN,
        'NO_SCHOOL_ASSOCIATION'
      );
    }

    const updated = await schoolJoinRequestService.rejectRequest(
      requestId,
      req.user.id,
      req.user.schoolId,
      reason
    );

    return successResponse(res, {
      requestId: updated.id,
      status: updated.status,
    });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};
