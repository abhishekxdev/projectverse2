import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import {
  School,
  CreateSchoolInput,
  UpdateSchoolInput,
} from '../types/school.types';
import { UserProfile, createUserRepository } from './user.repository';
import { NotFoundError } from '../utils/error';

const COLLECTION = 'schools';

// Remove undefined values so Firestore doesn't reject the payload
const omitUndefinedFields = <T extends Record<string, unknown>>(obj: T): T => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      (acc as Record<string, unknown>)[key] = value;
    }
    return acc;
  }, {} as T);
};

export interface SchoolRepository {
  createSchool(
    data: CreateSchoolInput,
    options?: { transaction?: FirebaseFirestore.Transaction; id?: string }
  ): Promise<School>;
  getSchoolById(
    id: string,
    options?: { transaction?: FirebaseFirestore.Transaction }
  ): Promise<School | null>;
  getSchoolByName(
    name: string,
    options?: { transaction?: FirebaseFirestore.Transaction }
  ): Promise<School | null>;
  getAllSchools(): Promise<School[]>;
  updateSchool(
    id: string,
    data: UpdateSchoolInput,
    options?: { transaction?: FirebaseFirestore.Transaction }
  ): Promise<School>;
  deleteSchool(id: string): Promise<void>;
  getSchoolTeachers(schoolId: string): Promise<UserProfile[]>;
  updateSchoolSeats(
    schoolId: string,
    used: number,
    options?: { transaction?: FirebaseFirestore.Transaction }
  ): Promise<School>;
}

export function createSchoolRepository(
  db: FirebaseFirestore.Firestore = getFirestore()
): SchoolRepository {
  const col = db.collection(COLLECTION);
  const userRepo = createUserRepository(db);

  return {
    async createSchool(data, options) {
      const now = firestore.Timestamp.now();
      const normalizedName = data.name.toLowerCase().trim();
      const ref = options?.id ? col.doc(options.id) : col.doc();

      const baseSchool: School = {
        id: ref.id,
        name: data.name.trim(),
        adminId: data.adminId,
        contactEmail: data.contactEmail || data.adminEmail,
        seats: {
          total: data.seats?.total ?? data.teacherLimit,
          used: data.seats?.used ?? 0,
        },
        teacherLimit: data.teacherLimit,
        status: data.status ?? 'pending',
        verificationStatus: data.verificationStatus ?? 'pending',
        admins:
          data.admins && data.admins.length > 0 ? data.admins : [data.adminId],
        nameLower: normalizedName,
        createdAt: now,
        updatedAt: now,
      };

      const optionalFields: Partial<School> = {
        contactPhone: data.contactPhone,
        address: data.address,
        establishedYear: data.establishedYear,
        principalName: data.principalName,
        totalTeachers: data.totalTeachers,
        totalStudents: data.totalStudents,
        logo: data.logo,
      };

      const schoolDoc = omitUndefinedFields({
        ...baseSchool,
        ...optionalFields,
      });

      if (options?.transaction) {
        options.transaction.set(ref, schoolDoc);
        return schoolDoc;
      }

      await ref.set(schoolDoc);
      return schoolDoc;
    },

    async getSchoolById(id, options) {
      const ref = col.doc(id);
      const snap = options?.transaction
        ? await options.transaction.get(ref)
        : await ref.get();
      if (!snap.exists) return null;

      const school = snap.data() as School;
      if (school.status === 'deleted') return null;

      return { ...school, id: snap.id };
    },

    async getSchoolByName(name, options) {
      const normalized = name.toLowerCase().trim();
      let query = col.where('nameLower', '==', normalized).limit(1);
      const snap = options?.transaction
        ? await options.transaction.get(query)
        : await query.get();

      if (snap.empty) return null;

      const doc = snap.docs[0];
      const school = doc.data() as School;
      if (school.status === 'deleted') return null;

      return { ...school, id: doc.id };
    },

    async getAllSchools() {
      // Get all schools and filter out deleted ones in-memory
      // This handles schools that may not have a status field set
      const snap = await col.get();
      return snap.docs
        .map((doc) => ({ ...(doc.data() as School), id: doc.id }))
        .filter((school) => school.status !== 'deleted');
    },

    async updateSchool(id, data, options) {
      const ref = col.doc(id);
      const runner = options?.transaction ?? null;
      const snap = runner ? await runner.get(ref) : await ref.get();

      if (!snap.exists) {
        throw new NotFoundError('School not found');
      }

      const now = firestore.Timestamp.now();
      const payload: Partial<School> = {
        ...data,
        updatedAt: now,
      } as Partial<School>;

      if (data.name) {
        payload.nameLower = data.name.toLowerCase().trim();
      }

      if (data.teacherLimit !== undefined) {
        payload.seats = {
          ...(snap.data() as School).seats,
          total: data.teacherLimit,
        };
      }

      const sanitizedPayload = omitUndefinedFields(payload);

      if (runner) {
        runner.set(ref, sanitizedPayload, { merge: true });
        return {
          ...(snap.data() as School),
          ...sanitizedPayload,
          id,
        };
      }

      await ref.set(sanitizedPayload, { merge: true });
      const updated = await ref.get();
      return { ...(updated.data() as School), id: updated.id };
    },

    async deleteSchool(id) {
      // Soft delete by setting status to 'deleted'
      await this.updateSchool(id, { status: 'deleted' });
    },

    async getSchoolTeachers(schoolId) {
      return await userRepo.getUsersBySchool(schoolId);
    },

    async updateSchoolSeats(schoolId, used, options) {
      const runner = options?.transaction;
      const exec = async (tx: FirebaseFirestore.Transaction) => {
        const ref = col.doc(schoolId);
        const snap = await tx.get(ref);

        if (!snap.exists) {
          throw new NotFoundError('School not found');
        }

        const school = snap.data() as School;

        if (used > school.teacherLimit) {
          throw new Error(
            `Cannot allocate ${used} seats. Only ${school.teacherLimit} seats available.`
          );
        }

        if (used < 0) {
          throw new Error('Used seats cannot be negative');
        }

        const now = firestore.Timestamp.now();
        const updates: Partial<School> = {
          seats: {
            ...school.seats,
            used,
            total: school.teacherLimit,
          },
          updatedAt: now,
        };

        tx.set(ref, updates, { merge: true });

        return {
          ...school,
          seats: {
            ...school.seats,
            used,
            total: school.teacherLimit,
          },
          updatedAt: now,
        } as School;
      };

      if (runner) {
        return await exec(runner);
      }

      return await db.runTransaction(async (tx) => exec(tx));
    },
  };
}
