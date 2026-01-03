import { HTTP_STATUS } from '../config/constants';
import {
  CreateLeadInput,
  LeadListOptions,
  LeadListResult,
  LeadRepository,
  buildDuplicateKey,
  createLeadRepository,
} from '../repositories/lead.repository';
import { UpgradeRequest, UpgradeRequestStatus } from '../types/school.types';
import { AppError, NotFoundError } from '../utils/error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LeadService {
  submitUpgradeRequest(input: CreateLeadInput): Promise<UpgradeRequest>;
  listUpgradeRequests(options?: LeadListOptions): Promise<LeadListResult>;
  updateLeadStatus(
    id: string,
    status: UpgradeRequestStatus
  ): Promise<UpgradeRequest>;
}

const TRANSITIONS: Record<UpgradeRequestStatus, UpgradeRequestStatus[]> = {
  new: ['contacted'],
  contacted: ['closed'],
  closed: [],
};

const STATUSES: UpgradeRequestStatus[] = ['new', 'contacted', 'closed'];

export function createLeadService(
  repository: LeadRepository = createLeadRepository()
): LeadService {
  const validateEmail = (email: string) => {
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError(
        'Invalid email address',
        HTTP_STATUS.BAD_REQUEST,
        'INVALID_EMAIL'
      );
    }
  };

  const ensureValidStatus = (
    status: UpgradeRequestStatus | string
  ): UpgradeRequestStatus => {
    const normalized = status as UpgradeRequestStatus;
    if (!STATUSES.includes(normalized)) {
      throw new AppError(
        'Invalid lead status',
        HTTP_STATUS.BAD_REQUEST,
        'INVALID_STATUS'
      );
    }
    return normalized;
  };

  const assertTransition = (
    current: UpgradeRequestStatus,
    next: UpgradeRequestStatus
  ) => {
    if (current === next) {
      return;
    }

    const allowed = TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new AppError(
        `Invalid status transition from ${current} to ${next}`,
        HTTP_STATUS.CONFLICT,
        'INVALID_TRANSITION'
      );
    }
  };

  return {
    async submitUpgradeRequest(input) {
      validateEmail(input.email.trim());
      const duplicateKey = buildDuplicateKey(input.email, input.school);
      const existing = await repository.findByDuplicateKey(duplicateKey);
      if (existing) {
        throw new AppError(
          'Lead already exists',
          HTTP_STATUS.CONFLICT,
          'LEAD_EXISTS'
        );
      }
      return repository.createUpgradeRequest(input);
    },

    listUpgradeRequests(options) {
      const normalizedOptions = options?.status
        ? { ...options, status: ensureValidStatus(options.status) }
        : options;
      return repository.getUpgradeRequests(normalizedOptions);
    },

    async updateLeadStatus(id, status) {
      const existing = await repository.getById(id);
      if (!existing) {
        throw new NotFoundError('Lead not found');
      }

      const normalizedStatus = ensureValidStatus(status);
      assertTransition(existing.status, normalizedStatus);
      return repository.updateRequestStatus(id, normalizedStatus);
    },
  };
}
