import { firestore } from 'firebase-admin';
import {
  createInviteRepository,
  InviteRepository,
} from '../../../src/repositories/invite.repository';
import { SchoolInvite, InviteStatus } from '../../../src/types/school.types';
import { ConflictError, NotFoundError } from '../../../src/utils/error';

// Mock Firebase
jest.mock('../../../src/config/firebase', () => ({
  getFirestore: jest.fn(),
}));

describe('InviteRepository', () => {
  let mockDb: jest.Mocked<FirebaseFirestore.Firestore>;
  let mockCol: jest.Mocked<FirebaseFirestore.CollectionReference>;
  let mockDoc: jest.Mocked<FirebaseFirestore.DocumentReference>;
  let mockSnap: jest.Mocked<FirebaseFirestore.DocumentSnapshot>;
  let mockQuery: jest.Mocked<FirebaseFirestore.Query>;
  let mockQuerySnap: jest.Mocked<FirebaseFirestore.QuerySnapshot>;
  let mockBatch: jest.Mocked<FirebaseFirestore.WriteBatch>;
  let repository: InviteRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock chain
    mockBatch = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockSnap = {
      exists: true,
      id: 'test-id',
      data: jest.fn(),
    } as any;

    mockQuerySnap = {
      empty: false,
      docs: [
        {
          id: 'test-id',
          data: jest.fn(),
        },
      ],
    } as any;

    mockDoc = {
      get: jest.fn().mockResolvedValue(mockSnap),
      set: jest.fn().mockResolvedValue(undefined),
      id: 'test-id',
    } as any;

    mockCol = {
      doc: jest.fn().mockReturnValue(mockDoc),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(mockQuerySnap),
    } as any;

    mockQuery = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(mockQuerySnap),
    } as any;

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCol),
      runTransaction: jest.fn(),
      batch: jest.fn().mockReturnValue(mockBatch),
    } as any;

    const { getFirestore } = require('../../../src/config/firebase');
    getFirestore.mockReturnValue(mockDb);

    repository = createInviteRepository(mockDb);
  });

  describe('createInvite', () => {
    it('should create a new invite successfully', async () => {
      const schoolId = 'school-123';
      const email = 'teacher@example.com';
      const invitedBy = 'admin-123';

      mockCol.doc.mockReturnValue(mockDoc);

      jest.spyOn(repository, 'getInviteByEmail').mockResolvedValue(null);

      const result = await repository.createInvite(schoolId, email, invitedBy);

      expect(mockCol.doc).toHaveBeenCalled();
      expect(mockDoc.set).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toMatchObject({
        id: 'test-id',
        schoolId,
        email: email.toLowerCase().trim(),
        status: 'pending',
        invitedBy,
      });
      expect(result.createdAt).toBeInstanceOf(firestore.Timestamp);
      expect(result.expiresAt).toBeInstanceOf(firestore.Timestamp);
      expect(result.expiresAt.seconds).toBe(
        result.createdAt.seconds + 7 * 24 * 60 * 60
      );
    });

    it('should throw ConflictError if invite already exists', async () => {
      // Arrange
      const schoolId = 'school-123';
      const email = 'teacher@example.com';
      const invitedBy = 'admin-123';
      const existingInvite: SchoolInvite = {
        id: 'existing-id',
        schoolId,
        email,
        status: 'pending',
        invitedBy: 'another-admin',
        createdAt: firestore.Timestamp.now(),
        expiresAt: firestore.Timestamp.now(),
      };

      // Mock getInviteByEmail to return existing invite
      jest
        .spyOn(repository, 'getInviteByEmail')
        .mockResolvedValue(existingInvite);

      // Act & Assert
      await expect(
        repository.createInvite(schoolId, email, invitedBy)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getInviteById', () => {
    it('should return invite if found', async () => {
      // Arrange
      const inviteId = 'invite-123';
      const expectedInvite: SchoolInvite = {
        id: inviteId,
        schoolId: 'school-123',
        email: 'teacher@example.com',
        status: 'pending',
        invitedBy: 'admin-123',
        createdAt: firestore.Timestamp.now(),
        expiresAt: firestore.Timestamp.now(),
      };

      const mockSnap = {
        exists: true,
        id: inviteId,
        data: jest.fn().mockReturnValue(expectedInvite),
      } as any;

      mockDoc.get.mockResolvedValue(mockSnap);

      // Act
      const result = await repository.getInviteById(inviteId);

      // Assert
      expect(mockCol.doc).toHaveBeenCalledWith(inviteId);
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toEqual({ ...expectedInvite, id: inviteId });
    });

    it('should return null if invite not found', async () => {
      // Arrange
      const inviteId = 'nonexistent-id';
      const mockSnap = {
        exists: false,
      } as any;

      mockDoc.get.mockResolvedValue(mockSnap);

      // Act
      const result = await repository.getInviteById(inviteId);

      // Assert
      expect(mockCol.doc).toHaveBeenCalledWith(inviteId);
      expect(result).toBeNull();
    });
  });

  describe('getInviteByEmail', () => {
    it('should return invite if found', async () => {
      // Arrange
      const schoolId = 'school-123';
      const email = 'teacher@example.com';
      const expectedInvite: SchoolInvite = {
        id: 'invite-123',
        schoolId,
        email,
        status: 'pending',
        invitedBy: 'admin-123',
        createdAt: firestore.Timestamp.now(),
        expiresAt: firestore.Timestamp.now(),
      };

      const mockQuerySnap = {
        empty: false,
        docs: [
          {
            id: 'invite-123',
            data: jest.fn().mockReturnValue(expectedInvite),
          } as any,
        ],
      } as any;

      mockCol.get.mockResolvedValue(mockQuerySnap);

      // Act
      const result = await repository.getInviteByEmail(email, schoolId);

      // Assert
      expect(mockCol.where).toHaveBeenCalledWith(
        'email',
        '==',
        email.toLowerCase().trim()
      );
      expect(mockCol.where).toHaveBeenCalledWith('schoolId', '==', schoolId);
      expect(result).toEqual({ ...expectedInvite, id: 'invite-123' });
    });

    it('should return null if no invite found', async () => {
      // Arrange
      const mockQuerySnap = {
        empty: true,
        docs: [],
      } as any;

      mockCol.get.mockResolvedValue(mockQuerySnap);

      // Act
      const result = await repository.getInviteByEmail(
        'teacher@example.com',
        'school-123'
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateInviteStatus', () => {
    it('should update invite status successfully', async () => {
      // Arrange
      const inviteId = 'invite-123';
      const newStatus: InviteStatus = 'accepted';
      const expectedInvite: SchoolInvite = {
        id: inviteId,
        schoolId: 'school-123',
        email: 'teacher@example.com',
        status: newStatus,
        invitedBy: 'admin-123',
        createdAt: firestore.Timestamp.now(),
        expiresAt: firestore.Timestamp.now(),
      };

      const mockSnap = {
        exists: true,
        id: inviteId,
        data: jest.fn().mockReturnValue(expectedInvite),
      } as any;
      mockDoc.get.mockResolvedValue(mockSnap);

      // Act
      const result = await repository.updateInviteStatus(inviteId, newStatus);

      // Assert
      expect(mockCol.doc).toHaveBeenCalledWith(inviteId);
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: newStatus,
        }),
        { merge: true }
      );
      expect(result).toEqual({ ...expectedInvite, id: inviteId });
    });

    it('should throw NotFoundError if invite not found', async () => {
      // Arrange
      const inviteId = 'nonexistent-id';
      const mockSnap = {
        exists: false,
      } as any;
      mockDoc.get.mockResolvedValue(mockSnap);

      // Act & Assert
      await expect(
        repository.updateInviteStatus(inviteId, 'accepted')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getSchoolInvites', () => {
    it('should return all invites for a school', async () => {
      // Arrange
      const schoolId = 'school-123';
      const expectedInvites: SchoolInvite[] = [
        {
          id: 'invite-1',
          schoolId,
          email: 'teacher1@example.com',
          status: 'pending',
          invitedBy: 'admin-123',
          createdAt: firestore.Timestamp.now(),
          expiresAt: firestore.Timestamp.now(),
        },
        {
          id: 'invite-2',
          schoolId,
          email: 'teacher2@example.com',
          status: 'accepted',
          invitedBy: 'admin-123',
          createdAt: firestore.Timestamp.now(),
          expiresAt: firestore.Timestamp.now(),
        },
      ];

      const mockQuerySnap = {
        empty: false,
        docs: expectedInvites.map(
          (invite) =>
            ({
              id: invite.id,
              data: jest.fn().mockReturnValue(invite),
            } as any)
        ),
      } as any;

      mockCol.get.mockResolvedValue(mockQuerySnap);

      // Act
      const result = await repository.getSchoolInvites(schoolId);

      // Assert
      expect(mockCol.where).toHaveBeenCalledWith('schoolId', '==', schoolId);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ...expectedInvites[0], id: 'invite-1' });
      expect(result[1]).toEqual({ ...expectedInvites[1], id: 'invite-2' });
    });

    it('should return filtered invites by status', async () => {
      // Arrange
      const schoolId = 'school-123';
      const status: InviteStatus = 'pending';
      const expectedInvites: SchoolInvite[] = [
        {
          id: 'invite-1',
          schoolId,
          email: 'teacher1@example.com',
          status,
          invitedBy: 'admin-123',
          createdAt: firestore.Timestamp.now(),
          expiresAt: firestore.Timestamp.now(),
        },
      ];

      const mockQuerySnap = {
        empty: false,
        docs: expectedInvites.map(
          (invite) =>
            ({
              id: invite.id,
              data: jest.fn().mockReturnValue(invite),
            } as any)
        ),
      } as any;

      mockCol.get.mockResolvedValue(mockQuerySnap);

      // Act
      const result = await repository.getSchoolInvites(schoolId, status);

      // Assert
      expect(mockCol.where).toHaveBeenCalledWith('schoolId', '==', schoolId);
      expect(mockCol.where).toHaveBeenCalledWith('status', '==', status);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ ...expectedInvites[0], id: 'invite-1' });
    });
  });

  describe('expireOldInvites', () => {
    it('should expire old pending invites', async () => {
      const oldInvites = [
        { id: 'invite-1', ref: { update: jest.fn() } },
        { id: 'invite-2', ref: { update: jest.fn() } },
      ];

      const mockQuerySnap = {
        empty: false,
        docs: oldInvites as any,
        size: oldInvites.length,
      } as any;

      mockCol.get.mockResolvedValue(mockQuerySnap);

      const result = await repository.expireOldInvites();

      expect(mockCol.where).toHaveBeenCalledWith('status', '==', 'pending');
      expect(mockCol.where).toHaveBeenCalledWith(
        'expiresAt',
        '<=',
        expect.any(firestore.Timestamp)
      );
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(result).toBe(oldInvites.length);
    });

    it('should return 0 if no old invites found', async () => {
      // Arrange
      const mockQuerySnap = {
        empty: true,
        docs: [],
      } as any;

      mockCol.get.mockResolvedValue(mockQuerySnap);

      // Act
      const result = await repository.expireOldInvites();

      // Assert
      expect(mockBatch.update).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });
});
