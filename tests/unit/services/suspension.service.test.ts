import { createSuspensionService } from '../../../src/services/suspension.service';
import { SuspensionRepository } from '../../../src/repositories/suspension.repository';
import { USER_STATUS } from '../../../src/config/constants';
import { UserProfile } from '../../../src/repositories/user.repository';
import { School } from '../../../src/types/school.types';
import { AppError } from '../../../src/utils/error';

jest.mock('../../../src/services/notification.service', () => ({
  notificationService: {
    triggerSuspensionNotification: jest.fn().mockResolvedValue(undefined),
    triggerUnsuspensionNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockRepository = (): jest.Mocked<SuspensionRepository> => ({
  suspendSchool: jest.fn(),
  unsuspendSchool: jest.fn(),
  suspendTeacher: jest.fn(),
  unsuspendTeacher: jest.fn(),
  getSuspensionStatus: jest.fn(),
});

describe('SuspensionService', () => {
  let repo: jest.Mocked<SuspensionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = mockRepository();
  });

  it('requires reason when suspending teacher', async () => {
    const service = createSuspensionService(repo);

    await expect(
      service.suspendTeacher({
        userId: 'user-1',
        actorId: 'admin-1',
        reason: '',
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(repo.suspendTeacher).not.toHaveBeenCalled();
  });

  it('suspends teacher and triggers notification', async () => {
    const updatedUser: UserProfile = {
      email: 'teacher@example.com',
      status: USER_STATUS.SUSPENDED,
      usage: {},
      suspension: {
        suspendedBy: 'admin-1',
        suspendedAt: {} as any,
        reason: 'Policy',
      },
    } as UserProfile;

    repo.suspendTeacher.mockResolvedValue(updatedUser);

    const service = createSuspensionService(repo);

    const result = await service.suspendTeacher({
      userId: 'user-1',
      actorId: 'admin-1',
      reason: 'Policy',
    });

    expect(repo.suspendTeacher).toHaveBeenCalledWith('user-1', {
      actorId: 'admin-1',
      reason: 'Policy',
    });
    expect(result.status).toBe(USER_STATUS.SUSPENDED);
  });

  it('suspends school with reason', async () => {
    const school = { id: 'school-1', status: 'suspended' } as School;
    repo.suspendSchool.mockResolvedValue(school);
    const service = createSuspensionService(repo);

    const result = await service.suspendSchool({
      schoolId: 'school-1',
      actorId: 'admin-1',
      reason: 'Policy',
    });

    expect(repo.suspendSchool).toHaveBeenCalledWith('school-1', {
      actorId: 'admin-1',
      reason: 'Policy',
    });
    expect(result.status).toBe('suspended');
  });
});
