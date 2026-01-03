import { Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { createLeadService } from '../services/lead.service';
import {
  createdResponse,
  successResponse,
  errorResponse,
} from '../utils/response';
import { AuthRequiredError, AppError } from '../utils/error';
import { HTTP_STATUS } from '../config/constants';
import { UpgradeRequestStatus } from '../types/school.types';

const leadService = createLeadService();

export const submitUpgradeLead = async (req: ApiRequest, res: Response) => {
  try {
    const { email, school, message } = req.body ?? {};
    if (!email || !school) {
      throw new AppError(
        'Email and school are required',
        HTTP_STATUS.BAD_REQUEST,
        'VALIDATION_ERROR'
      );
    }

    const lead = await leadService.submitUpgradeRequest({
      email,
      school,
      message,
    });

    return createdResponse(res, { leadId: lead.id });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const listUpgradeLeads = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { status, page, pageSize } = req.query;
    const normalizedStatus = status
      ? (String(status) as UpgradeRequestStatus)
      : undefined;
    const result = await leadService.listUpgradeRequests({
      status: normalizedStatus,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
    });

    return successResponse(res, result.items, HTTP_STATUS.OK, {
      page: result.page,
      limit: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
      hasNext: result.hasMore,
      hasPrev: result.page > 1,
    });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const updateLeadStatus = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!id) {
      throw new AppError(
        'Lead ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'LEAD_ID_REQUIRED'
      );
    }
    if (!status) {
      throw new AppError(
        'Status is required',
        HTTP_STATUS.BAD_REQUEST,
        'VALIDATION_ERROR'
      );
    }

    const lead = await leadService.updateLeadStatus(
      id,
      status as UpgradeRequestStatus
    );
    return successResponse(res, lead);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};
