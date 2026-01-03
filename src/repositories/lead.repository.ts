import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import { API_CONFIG } from '../config/constants';
import { UpgradeRequest, UpgradeRequestStatus } from '../types/school.types';
import { ConflictError, NotFoundError } from '../utils/error';

const COLLECTION = 'upgrade_leads';

export interface CreateLeadInput {
  email: string;
  school: string;
  message?: string | null;
}

export interface LeadListOptions {
  status?: UpgradeRequestStatus;
  page?: number;
  pageSize?: number;
}

export interface LeadListResult {
  items: UpgradeRequest[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface LeadRepository {
  createUpgradeRequest(input: CreateLeadInput): Promise<UpgradeRequest>;
  getUpgradeRequests(options?: LeadListOptions): Promise<LeadListResult>;
  updateRequestStatus(
    id: string,
    status: UpgradeRequestStatus
  ): Promise<UpgradeRequest>;
  findByDuplicateKey(duplicateKey: string): Promise<UpgradeRequest | null>;
  getById(id: string): Promise<UpgradeRequest | null>;
}

const normalizeLead = (
  id: string,
  data: FirebaseFirestore.DocumentData
): UpgradeRequest => {
  return {
    id,
    email: data.email,
    school: data.school,
    message: data.message ?? null,
    status: data.status as UpgradeRequestStatus,
    duplicateKey: data.duplicateKey,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

export const buildDuplicateKey = (email: string, school: string): string => {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedSchool = school.toLowerCase().trim();
  return `${normalizedEmail}|${normalizedSchool}`;
};

export function createLeadRepository(
  db: FirebaseFirestore.Firestore = getFirestore()
): LeadRepository {
  const col = db.collection(COLLECTION);

  return {
    async createUpgradeRequest({ email, school, message }) {
      const duplicateKey = buildDuplicateKey(email, school);

      const existing = await col
        .where('duplicateKey', '==', duplicateKey)
        .limit(1)
        .get();

      if (!existing.empty) {
        throw new ConflictError('Lead already exists');
      }

      const now = firestore.Timestamp.now();
      const ref = col.doc();
      const payload = {
        email: email.trim(),
        school: school.trim(),
        message: message ?? null,
        status: 'new' as UpgradeRequestStatus,
        duplicateKey,
        createdAt: now,
        updatedAt: now,
      };

      await ref.set(payload, { merge: false });
      return normalizeLead(ref.id, payload);
    },

    async getUpgradeRequests(options) {
      const page = options?.page && options.page > 0 ? options.page : 1;
      const pageSize = options?.pageSize
        ? Math.min(options.pageSize, API_CONFIG.MAX_PAGE_SIZE)
        : API_CONFIG.DEFAULT_PAGE_SIZE;
      const offset = (page - 1) * pageSize;

      let query: FirebaseFirestore.Query = col.orderBy('createdAt', 'desc');

      if (options?.status) {
        query = query.where('status', '==', options.status);
      }

      const totalSnap = await query.count().get();
      const snapshot = await query
        .offset(offset)
        .limit(pageSize + 1)
        .get();

      const items = snapshot.docs
        .slice(0, pageSize)
        .map((doc) => normalizeLead(doc.id, doc.data()));

      return {
        items,
        total: totalSnap.data().count,
        page,
        pageSize,
        hasMore: snapshot.size > pageSize,
      };
    },

    async updateRequestStatus(id, status) {
      const ref = col.doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        throw new NotFoundError('Lead not found');
      }

      const now = firestore.Timestamp.now();
      await ref.set({ status, updatedAt: now }, { merge: true });
      const updated = await ref.get();
      return normalizeLead(updated.id, updated.data()!);
    },

    async findByDuplicateKey(duplicateKey: string) {
      const snapshot = await col
        .where('duplicateKey', '==', duplicateKey)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return normalizeLead(doc.id, doc.data());
    },

    async getById(id: string) {
      const doc = await col.doc(id).get();
      if (!doc.exists) {
        return null;
      }
      const data = doc.data();
      if (!data) {
        return null;
      }
      return normalizeLead(doc.id, data);
    },
  };
}
