import { Request, Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { createSchoolService } from '../services/school.services';
import {
  successResponse,
  errorResponse,
  createdResponse,
} from '../utils/response';
import {
  schoolRegistrationSchema,
  schoolUpdateSchema,
  SchoolRegistrationInput,
  SchoolUpdateInput,
} from '../schemas/admin.schema';
import { z } from 'zod';

// Initialize school service
const schoolService = createSchoolService();

/**
 * List all schools
 */
export const listSchools = async (req: ApiRequest, res: Response) => {
  try {
    const schools = await schoolService.listSchools();
    return successResponse(res, schools);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Register a new school
 */
export const registerSchool = async (req: ApiRequest, res: Response) => {
  try {
    const { name, adminEmail, seats }: SchoolRegistrationInput = req.body;

    const school = await schoolService.registerSchool(name, adminEmail, seats);

    return createdResponse(res, school);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Get school details by ID
 */
export const getSchool = async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return errorResponse(res, new Error('Valid school ID is required'), 400);
    }

    const school = await schoolService.getSchoolDetails(id);

    return successResponse(res, school);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};

/**
 * Update school information
 */
export const updateSchool = async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: SchoolUpdateInput = req.body;

    if (!id || typeof id !== 'string') {
      return errorResponse(res, new Error('Valid school ID is required'), 400);
    }

    if (!req.user) {
      return errorResponse(res, new Error('Authentication required'), 401);
    }

    // If updating seats, we need to include current used count
    let finalUpdateData: SchoolUpdateInput = { ...updateData };
    if (updateData.seats && 'total' in updateData.seats) {
      // Get current school details to preserve used seat count
      const currentSchool = await schoolService.getSchoolDetails(id);
      // Create properly typed seats object
      const seatsUpdate: { total: number; used: number } = {
        total: updateData.seats.total,
        used: currentSchool.seats.used,
      };

      // Update updateData with properly typed seats
      finalUpdateData = {
        ...updateData,
        seats: seatsUpdate,
      };
    }

    const school = await schoolService.updateSchool(
      id,
      req.user.id,
      finalUpdateData as any
    );

    return successResponse(res, school);
  } catch (error) {
    return errorResponse(res, error as Error);
  }
};
