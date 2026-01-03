import { createSchoolService } from '../../../src/services/school.services';
import {
  createSchoolRepository,
  SchoolRepository,
} from '../../../src/repositories/school.repository';
import {
  createUserRepository,
  UserRepository,
} from '../../../src/repositories/user.repository';
import {
  createInviteRepository,
  InviteRepository,
} from '../../../src/repositories/invite.repository';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  AuthError,
  TierLimitError,
} from '../../../src/utils/error';
import { USER_ROLES, USER_TIERS } from '../../../src/config/constants';

// Mock Firebase Firestore
const mockFirestore = {
  collection: jest.fn(),
  runTransaction: jest.fn(async (fn: any) => fn({})),
};

// Mock repositories
const mockSchoolRepo: Partial<SchoolRepository> = {
  createSchool: jest.fn(),
  getSchoolByName: jest.fn(),
  getSchoolById: jest.fn(),
  updateSchool: jest.fn(),
  getSchoolTeachers: jest.fn(),
  updateSchoolSeats: jest.fn(),
};

const mockUserRepo: Partial<UserRepository> = {
  createUser: jest.fn(),
  getUserDocumentByEmail: jest.fn(),
  getUserById: jest.fn(),
  updateUser: jest.fn(),
};

const mockInviteRepo: Partial<InviteRepository> = {
  createInvite: jest.fn(),
  getInviteById: jest.fn(),
  getInviteByEmail: jest.fn(),
  updateInviteStatus: jest.fn(),
};

const mockAuthClient = {
  createUser: jest.fn().mockResolvedValue({
    uid: 'admin-uid',
    displayName: 'Admin User',
  }),
  deleteUser: jest.fn().mockResolvedValue(undefined),
};

const mockPasswordGenerator = jest.fn(() => 'TempPassAa1');
const mockAuthService = {
  syncClaimsFromUser: jest.fn().mockResolvedValue(undefined),
};

describe('SchoolService', () => {
  let schoolService: ReturnType<typeof createSchoolService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.syncClaimsFromUser.mockClear();
    (mockUserRepo.getUserDocumentByEmail as jest.Mock).mockResolvedValue(null);
    (mockSchoolRepo.getSchoolByName as jest.Mock).mockResolvedValue(null);
    (mockInviteRepo.getInviteByEmail as jest.Mock).mockResolvedValue(null);
    (mockInviteRepo.getInviteById as jest.Mock).mockResolvedValue(null);
    schoolService = createSchoolService({
      db: mockFirestore as any,
      schoolRepo: mockSchoolRepo as any,
      userRepo: mockUserRepo as any,
      inviteRepo: mockInviteRepo as any,
      authClient: mockAuthClient as any,
      passwordGenerator: mockPasswordGenerator,
      authService: mockAuthService as any,
    });
  });

  describe('registerSchool', () => {
    it('should throw ValidationError for invalid school name', async () => {
      await expect(
        schoolService.registerSchool('', 'admin@example.com', { total: 10 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid admin email', async () => {
      await expect(
        schoolService.registerSchool('Test School', 'invalid-email', {
          total: 10,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid seat total', async () => {
      await expect(
        schoolService.registerSchool('Test School', 'admin@example.com', {
          total: 0,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError if admin email already exists', async () => {
      (mockUserRepo.getUserDocumentByEmail as jest.Mock).mockResolvedValue({
        id: 'existing-admin',
        email: 'admin@example.com',
        data: {
          email: 'admin@example.com',
          role: USER_ROLES.INDIVIDUAL,
        },
      });

      await expect(
        schoolService.registerSchool('Test School', 'admin@example.com', {
          total: 10,
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getSchoolDetails', () => {
    it('should throw NotFoundError for non-existent school', async () => {
      (mockSchoolRepo.getSchoolById as jest.Mock).mockResolvedValue(null);

      await expect(
        schoolService.getSchoolDetails('non-existent-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('should return school with teacher count', async () => {
      const mockSchool = {
        id: 'school-123',
        name: 'Test School',
        adminId: 'admin-123',
        seats: { total: 10, used: 5 },
        status: 'active' as const,
        createdAt: new Date(),
      };

      const mockTeachers = [
        { id: 'teacher-1', email: 'teacher1@example.com' },
        { id: 'teacher-2', email: 'teacher2@example.com' },
      ];

      (mockSchoolRepo.getSchoolById as jest.Mock).mockResolvedValue(mockSchool);
      (mockSchoolRepo.getSchoolTeachers as jest.Mock).mockResolvedValue(
        mockTeachers as any
      );

      const result = await schoolService.getSchoolDetails('school-123');

      expect(result).toEqual({
        ...mockSchool,
        teacherCount: mockTeachers.length,
      });
    });
  });

  describe('inviteTeacher', () => {
    it('should throw ValidationError for invalid email', async () => {
      await expect(
        schoolService.inviteTeacher('school-123', 'admin-123', 'invalid-email')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AuthError for non-admin user', async () => {
      (mockUserRepo.getUserById as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        role: USER_ROLES.INDIVIDUAL,
        schoolId: 'school-123',
      });

      await expect(
        schoolService.inviteTeacher(
          'school-123',
          'admin-123',
          'teacher@example.com'
        )
      ).rejects.toThrow(AuthError);
    });

    it('should throw NotFoundError for non-existent school', async () => {
      (mockUserRepo.getUserById as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        role: USER_ROLES.SCHOOL_ADMIN,
        schoolId: 'school-123',
      });
      (mockSchoolRepo.getSchoolById as jest.Mock).mockResolvedValue(null);

      await expect(
        schoolService.inviteTeacher(
          'school-123',
          'admin-123',
          'teacher@example.com'
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw TierLimitError when no seats available', async () => {
      (mockUserRepo.getUserById as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        role: USER_ROLES.SCHOOL_ADMIN,
        schoolId: 'school-123',
      });
      (mockSchoolRepo.getSchoolById as jest.Mock).mockResolvedValue({
        id: 'school-123',
        seats: { total: 5, used: 5 },
      });

      await expect(
        schoolService.inviteTeacher(
          'school-123',
          'admin-123',
          'teacher@example.com'
        )
      ).rejects.toThrow(TierLimitError);
    });
  });

  describe('removeTeacher', () => {
    it('should throw AuthError for non-admin user', async () => {
      (mockUserRepo.getUserById as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        role: USER_ROLES.INDIVIDUAL,
        schoolId: 'school-123',
      });

      await expect(
        schoolService.removeTeacher('school-123', 'admin-123', 'teacher-123')
      ).rejects.toThrow(AuthError);
    });

    it('should throw NotFoundError for non-existent teacher', async () => {
      (mockUserRepo.getUserById as jest.Mock)
        .mockResolvedValueOnce({
          id: 'admin-123',
          role: USER_ROLES.SCHOOL_ADMIN,
          schoolId: 'school-123',
        })
        .mockResolvedValueOnce({
          id: 'admin-123',
          role: USER_ROLES.SCHOOL_ADMIN,
          schoolId: 'school-123',
        })
        .mockResolvedValueOnce(null);

      await expect(
        schoolService.removeTeacher('school-123', 'admin-123', 'teacher-123')
      ).rejects.toThrow(NotFoundError);
    });

    it('should successfully remove teacher and update seat usage', async () => {
      const mockTeacher = {
        id: 'teacher-123',
        email: 'teacher@example.com',
        role: USER_ROLES.SCHOOL_TEACHER,
        schoolId: 'school-123',
      };

      const mockSchool = {
        id: 'school-123',
        seats: { total: 10, used: 5 },
      };

      const updatedTeacher = {
        ...mockTeacher,
        tier: USER_TIERS.FREE,
        role: USER_ROLES.INDIVIDUAL,
        schoolId: null,
      };

      (mockUserRepo.getUserById as jest.Mock)
        .mockResolvedValueOnce({
          id: 'admin-123',
          role: USER_ROLES.SCHOOL_ADMIN,
          schoolId: 'school-123',
        })
        .mockResolvedValueOnce({
          id: 'admin-123',
          role: USER_ROLES.SCHOOL_ADMIN,
          schoolId: 'school-123',
        })
        .mockResolvedValueOnce(mockTeacher);
      (mockSchoolRepo.getSchoolById as jest.Mock).mockResolvedValue(mockSchool);
      (mockUserRepo.updateUser as jest.Mock).mockResolvedValue(updatedTeacher);
      (mockSchoolRepo.updateSchoolSeats as jest.Mock).mockResolvedValue({
        ...mockSchool,
        seats: { ...mockSchool.seats, used: 4 },
      });

      const result = await schoolService.removeTeacher(
        'school-123',
        'admin-123',
        'teacher-123'
      );

      expect(result).toEqual(updatedTeacher);
      expect(mockUserRepo.updateUser).toHaveBeenCalledWith(
        'teacher-123',
        {
          tier: USER_TIERS.FREE,
          role: USER_ROLES.INDIVIDUAL,
          schoolId: null,
        },
        expect.objectContaining({ transaction: expect.any(Object) })
      );
      expect(mockSchoolRepo.updateSchoolSeats).toHaveBeenCalledWith(
        'school-123',
        4,
        expect.objectContaining({ transaction: expect.any(Object) })
      );
    });
  });
});
