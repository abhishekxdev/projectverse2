import { createUserRepository } from '../../../src/repositories/user.repository';
import { NotFoundError } from '../../../src/utils/error';
import { USER_ROLES } from '../../../src/config/constants';

// Minimal Firestore mock
function createMockDB() {
  const store: Record<string, any> = {};

  const createWhereChain = (
    field: string,
    op: FirebaseFirestore.WhereFilterOp,
    value: any
  ) => {
    const getMatchingDocs = () => {
      return Object.entries(store)
        .filter(([, d]) => d?.[field] === value)
        .map(([id, data]) => ({ id, data: () => data }));
    };

    return {
      limit: (n: number) => ({
        get: async () => {
          const docs = getMatchingDocs().slice(0, n);
          return {
            empty: docs.length === 0,
            docs,
          } as any;
        },
      }),
      orderBy: () => ({
        limit: (n: number) => ({
          get: async () => ({
            docs: getMatchingDocs().slice(0, n),
          }),
        }),
        get: async () => ({
          docs: getMatchingDocs(),
        }),
      }),
      count: () => ({
        get: async () => ({
          data: () => ({ count: getMatchingDocs().length }),
        }),
      }),
    };
  };

  const collection = (name: string) => ({
    doc: (id: string) => ({
      id,
      get: async () => ({ exists: !!store[id], data: () => store[id] }),
      set: async (data: any, options?: any) => {
        store[id] = options?.merge ? { ...(store[id] || {}), ...data } : data;
      },
    }),
    where: createWhereChain,
    orderBy: () => ({
      limit: (n: number) => ({
        get: async () => ({
          docs: Object.keys(store).map((id) => ({ id, data: () => store[id] })),
        }),
      }),
      get: async () => ({
        docs: Object.keys(store).map((id) => ({ id, data: () => store[id] })),
      }),
    }),
  });
  return {
    collection,
    runTransaction: async (fn: any) =>
      fn({
        get: async (ref: any) => ({
          exists: !!store[ref.id],
          data: () => store[ref.id],
        }),
        set: async (ref: any, data: any, options?: any) => {
          store[ref.id] = options?.merge
            ? { ...(store[ref.id] || {}), ...data }
            : data;
        },
      }),
    __store: store,
  } as any;
}

describe('UserRepository', () => {
  test('createUser and getUserById', async () => {
    const db = createMockDB();
    const repo = createUserRepository(db);
    const user = await repo.createUser({
      uid: 'u1',
      email: 'a@b.com',
      displayName: 'A',
    });
    expect(user.email).toBe('a@b.com');
    const fetched = await repo.getUserById('u1');
    expect(fetched?.email).toBe('a@b.com');
  });

  test('getUserByEmail returns null when not found', async () => {
    const db = createMockDB();
    const repo = createUserRepository(db);
    const res = await repo.getUserByEmail('none@b.com');
    expect(res).toBeNull();
  });

  test('updateUser throws NotFoundError for missing user', async () => {
    const db = createMockDB();
    const repo = createUserRepository(db);
    await expect(
      repo.updateUser('missing', { displayName: 'X' })
    ).rejects.toThrow(NotFoundError);
  });

  describe('getAllTeachers', () => {
    test('returns teachers with pagination defaults', async () => {
      const db = createMockDB();
      db.__store['t1'] = { email: 'teacher1@test.com', role: USER_ROLES.SCHOOL_TEACHER };
      db.__store['t2'] = { email: 'teacher2@test.com', role: USER_ROLES.SCHOOL_TEACHER };
      db.__store['a1'] = { email: 'admin@test.com', role: USER_ROLES.SCHOOL_ADMIN };

      const repo = createUserRepository(db);
      const teachers = await repo.getAllTeachers();

      expect(teachers).toHaveLength(2);
      expect(teachers.every((t) => t.role === USER_ROLES.SCHOOL_TEACHER)).toBe(true);
    });

    test('returns empty array when no teachers exist', async () => {
      const db = createMockDB();
      db.__store['a1'] = { email: 'admin@test.com', role: USER_ROLES.SCHOOL_ADMIN };

      const repo = createUserRepository(db);
      const teachers = await repo.getAllTeachers();

      expect(teachers).toHaveLength(0);
    });

    test('respects page and limit parameters', async () => {
      const db = createMockDB();
      for (let i = 1; i <= 5; i++) {
        db.__store[`t${i}`] = { email: `teacher${i}@test.com`, role: USER_ROLES.SCHOOL_TEACHER };
      }

      const repo = createUserRepository(db);
      const page1 = await repo.getAllTeachers({ page: 1, limit: 2 });
      const page2 = await repo.getAllTeachers({ page: 2, limit: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });
  });

  describe('countTeachers', () => {
    test('returns count of teachers only', async () => {
      const db = createMockDB();
      db.__store['t1'] = { email: 'teacher1@test.com', role: USER_ROLES.SCHOOL_TEACHER };
      db.__store['t2'] = { email: 'teacher2@test.com', role: USER_ROLES.SCHOOL_TEACHER };
      db.__store['a1'] = { email: 'admin@test.com', role: USER_ROLES.SCHOOL_ADMIN };

      const repo = createUserRepository(db);
      const count = await repo.countTeachers();

      expect(count).toBe(2);
    });

    test('returns 0 when no teachers exist', async () => {
      const db = createMockDB();
      db.__store['a1'] = { email: 'admin@test.com', role: USER_ROLES.SCHOOL_ADMIN };

      const repo = createUserRepository(db);
      const count = await repo.countTeachers();

      expect(count).toBe(0);
    });
  });
});
