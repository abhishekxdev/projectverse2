import {
  enforceAssessmentLimit,
  enforceTutorMessageLimit,
  enforceModuleAccess,
  requireTutorAccess,
} from '../../../src/middlewares/tier.guard';
import { TierLimitError, ForbiddenError } from '../../../src/utils/error';
import { ApiRequest } from '../../../src/types/api.types';
import { USER_STATUS } from '../../../src/config/constants';

const baseReq = (): ApiRequest =>
  ({
    user: { status: USER_STATUS.ACTIVE },
    tier: {
      tier: 'free',
      limits: {
        assessmentsPerMonth: 1,
        tutorMessagesPerMonth: 10,
        modulesAccessible: ['basic'],
      },
    },
    usage: { assessmentsTakenMonth: 0, tutorMessagesMonth: 0 },
  } as any);

const run = async (mw: any, req: ApiRequest) => {
  const res: any = {};
  let error: any;
  await mw(req, res, (err?: any) => {
    if (err) error = err;
  });
  return { error };
};

describe('tier guards', () => {
  it('assessment limit within quota passes', async () => {
    const req = baseReq();
    (req.usage as any).assessmentsTakenMonth = 0;
    const { error } = await run(enforceAssessmentLimit, req);
    expect(error).toBeUndefined();
  });
  it('assessment limit exceeded rejects', async () => {
    const req = baseReq();
    (req.usage as any).assessmentsTakenMonth = 1;
    const { error } = await run(enforceAssessmentLimit, req);
    expect(error).toBeInstanceOf(TierLimitError);
    expect((error as any).details.code).toBe('TIER_LIMIT_ASSESSMENT');
  });
  it('tutor message limit exceeded rejects', async () => {
    const req = baseReq();
    (req.usage as any).tutorMessagesMonth = 10;
    const { error } = await run(enforceTutorMessageLimit, req);
    expect(error).toBeInstanceOf(TierLimitError);
    expect((error as any).details.code).toBe('TIER_LIMIT_TUTOR_MESSAGES');
  });
  it('module access allowed passes', async () => {
    const req = baseReq();
    const { error } = await run(enforceModuleAccess('basic'), req);
    expect(error).toBeUndefined();
  });
  it('module access forbidden rejects', async () => {
    const req = baseReq();
    const { error } = await run(enforceModuleAccess('premium'), req);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as any).code).toBe('TIER_MODULE_UPGRADE_REQUIRED');
  });

  it('tutor access blocked for unapproved teacher', async () => {
    const req = baseReq();
    (req.user as any).status = USER_STATUS.PENDING;
    const { error } = await run(requireTutorAccess, req);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as any).code).toBe('AI_TUTOR_NOT_AVAILABLE');
  });

  it('tutor access allowed for approved teacher', async () => {
    const req = baseReq();
    (req.user as any).status = USER_STATUS.ACTIVE;
    const { error } = await run(requireTutorAccess, req);
    expect(error).toBeUndefined();
  });
});
