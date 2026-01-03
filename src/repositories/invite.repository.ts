import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import { SchoolInvite, InviteStatus } from '../types/school.types';
import { NotFoundError, ConflictError } from '../utils/error';

const COLLECTION = 'invites';

type TransactionOptions = { transaction?: FirebaseFirestore.Transaction };

export interface InviteRepository {
  createInvite(
    schoolId: string,
    email: string,
    invitedBy: string,
    options?: TransactionOptions
  ): Promise<SchoolInvite>;
  getInviteById(
    id: string,
    options?: TransactionOptions
  ): Promise<SchoolInvite | null>;
  getInviteByEmail(
    email: string,
    schoolId: string,
    options?: TransactionOptions
  ): Promise<SchoolInvite | null>;
  updateInviteStatus(
    id: string,
    status: InviteStatus,
    options?: TransactionOptions
  ): Promise<SchoolInvite>;
  getSchoolInvites(
    schoolId: string,
    status?: InviteStatus
  ): Promise<SchoolInvite[]>;
  expireOldInvites(): Promise<number>;
}

export function createInviteRepository(
  db: FirebaseFirestore.Firestore = getFirestore()
): InviteRepository {
  const col = db.collection(COLLECTION);

  return {
    async createInvite(schoolId, email, invitedBy, options) {
      const normalizedEmail = email.toLowerCase().trim();

      if (options?.transaction) {
        const existingInvite = await this.getInviteByEmail(
          normalizedEmail,
          schoolId,
          options
        );
        if (existingInvite && existingInvite.status === 'pending') {
          throw new ConflictError('Invite already exists for this email');
        }
      } else {
        const existingInvite = await this.getInviteByEmail(
          normalizedEmail,
          schoolId
        );
        if (existingInvite && existingInvite.status === 'pending') {
          throw new ConflictError('Invite already exists for this email');
        }
      }

      const ref = col.doc();
      const now = firestore.Timestamp.now();
      const expiresAt = new firestore.Timestamp(
        now.seconds + 7 * 24 * 60 * 60,
        now.nanoseconds
      );

      const invite: SchoolInvite = {
        id: ref.id,
        schoolId,
        email: normalizedEmail,
        status: 'pending',
        invitedBy,
        createdAt: now,
        expiresAt,
      };

      if (options?.transaction) {
        options.transaction.set(ref, invite, { merge: false });
      } else {
        await ref.set(invite);
      }
      return invite;
    },

    async getInviteById(id, options) {
      const ref = col.doc(id);
      const snap = options?.transaction
        ? await options.transaction.get(ref)
        : await ref.get();
      if (!snap.exists) return null;

      return { ...(snap.data() as SchoolInvite), id: snap.id };
    },

    async getInviteByEmail(email, schoolId, options) {
      const normalizedEmail = email.toLowerCase().trim();
      const query = col
        .where('email', '==', normalizedEmail)
        .where('schoolId', '==', schoolId)
        .limit(1);
      const snap = options?.transaction
        ? await options.transaction.get(query)
        : await query.get();

      if (snap.empty) return null;

      const doc = snap.docs[0];
      return { ...(doc.data() as SchoolInvite), id: doc.id };
    },

    async updateInviteStatus(id, status, options) {
      const ref = col.doc(id);
      const snap = options?.transaction
        ? await options.transaction.get(ref)
        : await ref.get();

      if (!snap.exists) {
        throw new NotFoundError('Invite not found');
      }

      const now = firestore.Timestamp.now();
      const updates = { status, updatedAt: now };

      if (options?.transaction) {
        options.transaction.set(ref, updates, { merge: true });
        return {
          ...(snap.data() as SchoolInvite),
          ...updates,
          id,
        };
      }

      await ref.set(updates, { merge: true });

      const updated = await ref.get();
      return { ...(updated.data() as SchoolInvite), id: updated.id };
    },

    async getSchoolInvites(schoolId, status) {
      let query = col.where('schoolId', '==', schoolId);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snap = await query.get();
      return snap.docs.map((doc) => ({
        ...(doc.data() as SchoolInvite),
        id: doc.id,
      }));
    },

    async expireOldInvites() {
      const now = firestore.Timestamp.now();
      const snap = await col
        .where('status', '==', 'pending')
        .where('expiresAt', '<=', now)
        .get();

      if (snap.empty) return 0;

      const batch = db.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'expired',
          updatedAt: now,
        });
      });

      await batch.commit();
      return snap.size;
    },
  };
}
