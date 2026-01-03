import { NextFunction, Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { ZodSchema } from 'zod';
import { createValidationError } from '../utils/error';

export const validate = (schema: ZodSchema<any>) => {
  return (req: ApiRequest, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return next(createValidationError(err));
      }
      return next(err);
    }
  };
};

export const validateParams = (schema: ZodSchema<any>) => {
  return (req: ApiRequest, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params);
      req.params = parsed;
      next();
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return next(createValidationError(err));
      }
      return next(err);
    }
  };
};

export const validateQuery = (schema: ZodSchema<any>) => {
  return (req: ApiRequest, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed;
      next();
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return next(createValidationError(err));
      }
      return next(err);
    }
  };
};
