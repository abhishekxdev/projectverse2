import {
  requireRoles,
  requireTeacher,
  requireSchoolAdmin,
  requirePlatformAdmin,
  requireAnyAdmin,
} from '../../../src/middlewares/role.guard';
import {
  RoleForbiddenError,
  AuthRequiredError,
} from '../../../src/utils/error';
import { ApiRequest } from '../../../src/types/api.types';

const buildReq = (role?: string): ApiRequest => {
  return {
    user: role
      ? ({
          id: 'user-1',
          uid: 'user-1',
          role,
        } as any)
      : undefined,
  } as any;
};

const run = async (mw: any, req: ApiRequest) => {
  const res: any = {};
  let error: any;
  await mw(req, res, (err?: any) => {
    if (err) error = err;
  });
  return { error };
};

describe('requireRoles', () => {
  it('allows permitted role', async () => {
    const mw = requireRoles(['platform_admin']);
    const { error } = await run(mw, buildReq('platform_admin'));
    expect(error).toBeUndefined();
  });
  it('allows one of multiple roles', async () => {
    const mw = requireRoles(['school_admin', 'platform_admin']);
    const { error } = await run(mw, buildReq('school_admin'));
    expect(error).toBeUndefined();
  });
  it('rejects forbidden role', async () => {
    const mw = requireRoles(['platform_admin']);
    const { error } = await run(mw, buildReq('individual'));
    expect(error).toBeInstanceOf(RoleForbiddenError);
    expect((error as RoleForbiddenError).allowedRoles).toContain(
      'platform_admin'
    );
  });
  it('fails on missing user context', async () => {
    const mw = requireRoles(['platform_admin']);
    const { error } = await run(mw, buildReq());
    expect(error).toBeInstanceOf(AuthRequiredError);
  });
  it('propagates matched role onto request', async () => {
    const req = buildReq('school_admin');
    const mw = requireRoles(['school_admin']);
    const { error } = await run(mw, req);
    expect(error).toBeUndefined();
    expect(req.role).toBe('school_admin');
  });
});

describe('role-specific helpers', () => {
  it('requireTeacher allows school_teacher only', async () => {
    const req = buildReq('school_teacher');
    const { error } = await run(requireTeacher(), req);
    expect(error).toBeUndefined();

    const forbidden = await run(requireTeacher(), buildReq('individual'));
    expect(forbidden.error).toBeInstanceOf(RoleForbiddenError);
  });

  it('requireSchoolAdmin blocks teachers', async () => {
    const req = buildReq('school_admin');
    expect((await run(requireSchoolAdmin(), req)).error).toBeUndefined();

    const forbidden = await run(
      requireSchoolAdmin(),
      buildReq('school_teacher')
    );
    expect(forbidden.error).toBeInstanceOf(RoleForbiddenError);
  });

  it('requirePlatformAdmin enforces platform role', async () => {
    const req = buildReq('platform_admin');
    expect((await run(requirePlatformAdmin(), req)).error).toBeUndefined();

    const forbidden = await run(
      requirePlatformAdmin(),
      buildReq('school_admin')
    );
    expect(forbidden.error).toBeInstanceOf(RoleForbiddenError);
  });

  it('requireAnyAdmin accepts school or platform admins', async () => {
    const school = await run(requireAnyAdmin(), buildReq('school_admin'));
    expect(school.error).toBeUndefined();

    const platform = await run(requireAnyAdmin(), buildReq('platform_admin'));
    expect(platform.error).toBeUndefined();

    const teacher = await run(requireAnyAdmin(), buildReq('school_teacher'));
    expect(teacher.error).toBeInstanceOf(RoleForbiddenError);
  });
});
