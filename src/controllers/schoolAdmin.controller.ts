import { Request, Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { createSchoolService } from '../services/school.services';
import {
  successResponse,
  errorResponse,
  createdResponse,
} from '../utils/response';
import {
  teacherInviteSchema,
  bulkInviteSchema,
  assignmentSchema,
  TeacherInviteInput,
  BulkInviteInput,
  AssignmentInput,
} from '../schemas/admin.schema';
import { USER_ROLES } from '../config/constants';
import { CrossSchoolAccessError, ForbiddenError, AppError } from '../utils/error';
import { createSuspensionService } from '../services/suspension.service';
import { createUserRepository } from '../repositories/user.repository';

// Initialize services
const schoolService = createSchoolService();
const suspensionService = createSuspensionService();
const userRepository = createUserRepository();

const resolveSchoolIdOrThrow = (req: ApiRequest): string => {
  const schoolId =
    req.schoolId ||
    (req.user?.schoolId as string | undefined) ||
    (req.query.schoolId as string | undefined) ||
    (req.body?.schoolId as string | undefined);
  if (!schoolId) {
    throw new CrossSchoolAccessError('School ID is required');
  }
  return schoolId;
};

/**
 * List all teachers in a school
 */
export const listTeachers = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    // Get school ID from user profile or use a different approach
    // For now, we'll assume school ID is passed in query params
    const schoolId = resolveSchoolIdOrThrow(req);
    const teachers = await schoolService.getSchoolTeachers(schoolId);

    return successResponse(res, teachers);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Invite a single teacher to a school
 */
export const inviteTeacher = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    const { email }: TeacherInviteInput = req.body;
    const schoolId = resolveSchoolIdOrThrow(req);

    const result = await schoolService.inviteTeacher(
      schoolId,
      req.user.id,
      email
    );

    return createdResponse(res, result);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Invite multiple teachers to a school
 */
export const bulkInvite = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    const { emails }: BulkInviteInput = req.body;
    const schoolId = resolveSchoolIdOrThrow(req);

    const results = await schoolService.bulkInviteTeachers(
      schoolId,
      req.user.id,
      emails
    );

    return createdResponse(res, results);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Remove a teacher from a school
 */
export const removeTeacher = async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return errorResponse(res, new Error('Valid teacher ID is required'), 400);
    }

    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    // Get school ID from request body or query params
    const schoolId = resolveSchoolIdOrThrow(req);

    const updatedUser = await schoolService.removeTeacher(
      schoolId,
      req.user.id,
      id
    );

    return successResponse(res, updatedUser);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * List all assignments for a school
 */
export const listAssignments = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    // Get school ID from query params
    const schoolId = resolveSchoolIdOrThrow(req);

    // Note: This is a placeholder implementation
    // In a real implementation, you would call assignmentService.getSchoolAssignments
    const assignments: any[] = []; // Placeholder

    return successResponse(res, assignments);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Create a new assignment
 */
export const createAssignment = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    const { assessmentId, teacherIds, deadline }: AssignmentInput = req.body;
    const schoolId = resolveSchoolIdOrThrow(req);

    // Note: This is a placeholder implementation
    // In a real implementation, you would call assignmentService.createAssignment
    const assignment = {
      id: 'placeholder-id',
      schoolId: schoolId,
      assessmentId,
      teacherIds,
      deadline,
      assignedBy: req.user.id,
      createdAt: new Date(),
    };

    return createdResponse(res, assignment);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Delete an assignment
 */
export const deleteAssignment = async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return errorResponse(
        res,
        new Error('Valid assignment ID is required'),
        400
      );
    }

    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    // Note: This is a placeholder implementation
    // In a real implementation, you would call assignmentService.deleteAssignment
    const deleted = true; // Placeholder

    return successResponse(res, { deleted });
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * View progress for all teachers in a school
 */
export const viewProgress = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    // Get school ID from query params
    const schoolId = resolveSchoolIdOrThrow(req);

    const progress = await schoolService.getTeacherProgress(schoolId);

    return successResponse(res, progress);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * View progress for a specific teacher
 */
export const viewTeacherProgress = async (req: ApiRequest, res: Response) => {
  try {
    const { teacherId } = req.params;

    if (!teacherId || typeof teacherId !== 'string') {
      return errorResponse(res, new Error('Valid teacher ID is required'), 400);
    }

    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    // Get school ID from query params
    const schoolId = resolveSchoolIdOrThrow(req);

    const progress = await schoolService.getTeacherProgress(
      schoolId,
      teacherId
    );

    return successResponse(res, progress);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Suspend a teacher (school admin only)
 */
export const suspendTeacher = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      throw new AppError('Teacher ID is required', 400, 'TEACHER_ID_REQUIRED');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new AppError('Suspension reason is required', 400, 'REASON_REQUIRED');
    }

    // Get teacher to verify they belong to the school admin's school
    const teacher = await userRepository.getUserById(id);
    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'TEACHER_NOT_FOUND');
    }

    // Verify teacher belongs to the school admin's school
    const schoolId = resolveSchoolIdOrThrow(req);
    if (teacher.schoolId !== schoolId) {
      throw new ForbiddenError('You can only suspend teachers in your school');
    }

    // Perform suspension
    const updated = await suspensionService.suspendTeacher({
      userId: id,
      actorId: req.user.id,
      reason: reason.trim(),
    });

    return successResponse(res, updated);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Unsuspend a teacher (school admin only)
 */
export const unsuspendTeacher = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    const { id } = req.params;

    if (!id) {
      throw new AppError('Teacher ID is required', 400, 'TEACHER_ID_REQUIRED');
    }

    // Get teacher to verify they belong to the school admin's school
    const teacher = await userRepository.getUserById(id);
    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'TEACHER_NOT_FOUND');
    }

    // Verify teacher belongs to the school admin's school
    const schoolId = resolveSchoolIdOrThrow(req);
    if (teacher.schoolId !== schoolId) {
      throw new ForbiddenError('You can only unsuspend teachers in your school');
    }

    // Check if teacher was suspended due to school suspension
    if (teacher.suspension?.reason?.startsWith('School suspended:')) {
      throw new ForbiddenError(
        'This teacher was suspended due to school suspension. You cannot unsuspend them directly. Contact platform admin.'
      );
    }

    // Perform unsuspension
    const updated = await suspensionService.unsuspendTeacher({
      id,
      actorId: req.user.id,
    });

    return successResponse(res, updated);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};
