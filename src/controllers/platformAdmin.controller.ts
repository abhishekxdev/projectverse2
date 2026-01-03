import { Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { createSuspensionService } from '../services/suspension.service';
import { createUserRepository } from '../repositories/user.repository';
import { createSchoolRepository } from '../repositories/school.repository';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
} from '../utils/response';
import {
  AppError,
  AuthRequiredError,
  NotFoundError,
  ValidationError,
} from '../utils/error';
import { HTTP_STATUS, API_CONFIG } from '../config/constants';

const suspensionService = createSuspensionService();
const userRepository = createUserRepository();
const schoolRepository = createSchoolRepository();

export const suspendSchool = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    const { reason } = req.body ?? {};

    if (!id) {
      throw new AppError(
        'School ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'SCHOOL_ID_REQUIRED'
      );
    }

    const updated = await suspensionService.suspendSchool({
      schoolId: id,
      actorId: req.user.id,
      reason,
    });

    return successResponse(res, updated);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const unsuspendSchool = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    if (!id) {
      throw new AppError(
        'School ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'SCHOOL_ID_REQUIRED'
      );
    }

    const updated = await suspensionService.unsuspendSchool({
      id,
      actorId: req.user.id,
    });

    return successResponse(res, updated);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const suspendTeacher = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    const { reason } = req.body ?? {};

    if (!id) {
      throw new AppError(
        'User ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'USER_ID_REQUIRED'
      );
    }

    const updated = await suspensionService.suspendTeacher({
      userId: id,
      actorId: req.user.id,
      reason,
    });

    return successResponse(res, updated);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const unsuspendTeacher = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    if (!id) {
      throw new AppError(
        'User ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'USER_ID_REQUIRED'
      );
    }

    const updated = await suspensionService.unsuspendTeacher({
      id,
      actorId: req.user.id,
    });

    return successResponse(res, updated);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const listAllTeachers = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(
      API_CONFIG.MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(req.query.limit as string, 10) || API_CONFIG.DEFAULT_PAGE_SIZE
      )
    );

    const approvedByPlatformAdmin =
      String(req.query.approvedByPlatformAdmin ?? '')
        .toLowerCase()
        .trim() === 'true';

    const [teachers, total] = await Promise.all([
      userRepository.getAllTeachers({ page, limit, approvedByPlatformAdmin }),
      userRepository.countTeachers({ approvedByPlatformAdmin }),
    ]);

    return paginatedResponse(res, teachers, page, limit, total);
  } catch (error) {
    console.error('Error listing teachers:', error);
    return errorResponse(res, error as Error);
  }
};

export const listAllSchools = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const schools = await schoolRepository.getAllSchools();

    return successResponse(res, schools);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

export const updateSchoolSeatLimit = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    const { totalSeats } = req.body ?? {};

    if (!id) {
      throw new AppError(
        'School ID is required',
        HTTP_STATUS.BAD_REQUEST,
        'SCHOOL_ID_REQUIRED'
      );
    }

    if (typeof totalSeats !== 'number') {
      throw new ValidationError('totalSeats is required and must be a number');
    }

    const school = await schoolRepository.getSchoolById(id);

    if (!school) {
      throw new NotFoundError('School not found');
    }

    if (totalSeats < school.seats.used) {
      throw new ValidationError(
        'Total seats cannot be less than current usage'
      );
    }

    const updated = await schoolRepository.updateSchool(id, {
      teacherLimit: totalSeats,
      seats: {
        total: totalSeats,
        used: school.seats.used,
      },
    });

    return successResponse(res, updated);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};
