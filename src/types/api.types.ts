import { Request } from 'express';
import {
  UserDocument,
  TierInfo,
  UserUsageCounters,
  UserRole,
  UserStatus,
} from './user.types';

export interface ApiRequest extends Request {
  user?: UserDocument;
  tier?: TierInfo;
  usage?: UserUsageCounters;
  requestId?: string;
  role?: UserRole;
  schoolId?: string | null;
  status?: UserStatus;
  claimsUpdatedAt?: string;
  schoolSuspended?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Standard API response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

export interface AuthUserEnvelope {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  profileCompleted: boolean;
  profile?: Record<string, unknown>;
}

export interface AuthResponsePayload {
  token: string;
  refreshToken?: string;
  expiresIn?: string | number;
  user: AuthUserEnvelope;
}
