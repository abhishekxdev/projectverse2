import { HTTP_STATUS } from '../config/constants';
import {
  createSuspensionRepository,
  SuspensionRepository,
} from '../repositories/suspension.repository';
import { notificationService } from './notification.service';
import { AppError } from '../utils/error';
import { School } from '../types/school.types';
import { UserProfile } from '../repositories/user.repository';

export interface SuspendSchoolPayload {
  schoolId: string;
  actorId: string;
  reason: string;
}

export interface SuspendTeacherPayload {
  userId: string;
  actorId: string;
  reason: string;
}

export interface UnsuspendPayload {
  id: string;
  actorId: string;
}

export interface SuspensionService {
  suspendSchool(payload: SuspendSchoolPayload): Promise<School>;
  unsuspendSchool(payload: UnsuspendPayload): Promise<School>;
  suspendTeacher(payload: SuspendTeacherPayload): Promise<UserProfile>;
  unsuspendTeacher(payload: UnsuspendPayload): Promise<UserProfile>;
}

export function createSuspensionService(
  repository: SuspensionRepository = createSuspensionRepository()
): SuspensionService {
  const ensureReason = (reason: string) => {
    if (!reason || reason.trim().length === 0) {
      throw new AppError(
        'Suspension reason required',
        HTTP_STATUS.BAD_REQUEST,
        'REASON_REQUIRED'
      );
    }
  };

  return {
    async suspendSchool({ schoolId, actorId, reason }) {
      ensureReason(reason);
      return repository.suspendSchool(schoolId, {
        actorId,
        reason: reason.trim(),
      });
    },

    async unsuspendSchool({ id, actorId }) {
      return repository.unsuspendSchool(id, { actorId });
    },

    async suspendTeacher({ userId, actorId, reason }) {
      ensureReason(reason);
      const updated = await repository.suspendTeacher(userId, {
        actorId,
        reason: reason.trim(),
      });
      await notificationService.triggerSuspensionNotification(
        userId,
        reason.trim()
      );
      return updated;
    },

    async unsuspendTeacher({ id, actorId }) {
      const updated = await repository.unsuspendTeacher(id, { actorId });
      await notificationService.triggerUnsuspensionNotification(id);
      return updated;
    },
  };
}
