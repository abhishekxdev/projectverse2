import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import {
  SchoolJoinRequest,
  JoinRequestStatus,
  CreateJoinRequestPayload,
} from '../types/schoolJoinRequest.types';

const COLLECTION = 'school_join_requests';

export interface SchoolJoinRequestRepository {
  createRequest(payload: CreateJoinRequestPayload): Promise<SchoolJoinRequest>;
  getRequestById(id: string): Promise<SchoolJoinRequest | null>;
  getRequestsBySchool(
    schoolId: string,
    status?: JoinRequestStatus
  ): Promise<SchoolJoinRequest[]>;
  getRequestsByUser(userId: string): Promise<SchoolJoinRequest[]>;
  getPendingRequestByUserAndSchool(
    userId: string,
    schoolId: string
  ): Promise<SchoolJoinRequest | null>;
  getLatestRequestByUserAndSchool(
    userId: string,
    schoolId: string
  ): Promise<SchoolJoinRequest | null>;
  updateRequestStatus(
    id: string,
    status: JoinRequestStatus,
    reviewerId: string,
    reason?: string
  ): Promise<SchoolJoinRequest>;
}

export function createSchoolJoinRequestRepository(
  db: FirebaseFirestore.Firestore = getFirestore()
): SchoolJoinRequestRepository {
  const col = db.collection(COLLECTION);

  const normalize = (
    id: string,
    data: FirebaseFirestore.DocumentData
  ): SchoolJoinRequest => ({
    id,
    userId: data.userId,
    userEmail: data.userEmail,
    userDisplayName: data.userDisplayName,
    schoolId: data.schoolId,
    status: data.status,
    message: data.message,
    rejectionReason: data.rejectionReason,
    reviewedBy: data.reviewedBy,
    reviewedAt: data.reviewedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });

  return {
    async createRequest(payload) {
      const now = firestore.Timestamp.now();
      const docRef = col.doc();

      const requestDoc: Record<string, any> = {
        userId: payload.userId,
        userEmail: payload.userEmail,
        schoolId: payload.schoolId,
        status: 'pending' as JoinRequestStatus,
        createdAt: now,
        updatedAt: now,
      };

      if (payload.userDisplayName !== undefined) {
        requestDoc.userDisplayName = payload.userDisplayName;
      }

      if (payload.message !== undefined) {
        requestDoc.message = payload.message;
      }

      await docRef.set(requestDoc);
      return normalize(docRef.id, requestDoc);
    },

    async getRequestById(id) {
      const snap = await col.doc(id).get();
      if (!snap.exists) return null;
      return normalize(snap.id, snap.data()!);
    },

    async getRequestsBySchool(schoolId, status) {
      let query: FirebaseFirestore.Query = col.where(
        'schoolId',
        '==',
        schoolId
      );

      if (status) {
        query = query.where('status', '==', status);
      }

      query = query.orderBy('createdAt', 'desc');
      const q = await query.get();
      return q.docs.map((doc) => normalize(doc.id, doc.data()));
    },

    async getRequestsByUser(userId) {
      const q = await col
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      return q.docs.map((doc) => normalize(doc.id, doc.data()));
    },

    async getPendingRequestByUserAndSchool(userId, schoolId) {
      const q = await col
        .where('userId', '==', userId)
        .where('schoolId', '==', schoolId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (q.empty) return null;
      const doc = q.docs[0];
      return normalize(doc.id, doc.data());
    },

    async getLatestRequestByUserAndSchool(userId, schoolId) {
      const q = await col
        .where('userId', '==', userId)
        .where('schoolId', '==', schoolId)
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();

      if (q.empty) return null;
      const doc = q.docs[0];
      return normalize(doc.id, doc.data());
    },

    async updateRequestStatus(id, status, reviewerId, reason) {
      const ref = col.doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        throw new Error('Request not found');
      }

      const now = firestore.Timestamp.now();
      const updates: Partial<SchoolJoinRequest> = {
        status,
        reviewedBy: reviewerId,
        reviewedAt: now,
        updatedAt: now,
      };

      if (reason) {
        updates.rejectionReason = reason;
      }

      await ref.set(updates, { merge: true });
      const updated = await ref.get();
      return normalize(updated.id, updated.data()!);
    },
  };
}
