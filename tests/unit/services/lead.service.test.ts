import { createLeadService } from '../../../src/services/lead.service';
import {
  LeadRepository,
  LeadListResult,
} from '../../../src/repositories/lead.repository';
import { UpgradeRequest } from '../../../src/types/school.types';
import { AppError } from '../../../src/utils/error';

const mockRepository = (): jest.Mocked<LeadRepository> => ({
  createUpgradeRequest: jest.fn(),
  getUpgradeRequests: jest.fn(),
  updateRequestStatus: jest.fn(),
  findByDuplicateKey: jest.fn(),
  getById: jest.fn(),
});

describe('LeadService', () => {
  let repo: jest.Mocked<LeadRepository>;

  beforeEach(() => {
    repo = mockRepository();
    jest.clearAllMocks();
  });

  it('rejects invalid email', async () => {
    const service = createLeadService(repo);

    await expect(
      service.submitUpgradeRequest({
        email: 'invalid-email',
        school: 'Test School',
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('detects duplicate leads', async () => {
    repo.findByDuplicateKey.mockResolvedValue({
      id: 'lead-1',
    } as UpgradeRequest);

    const service = createLeadService(repo);

    await expect(
      service.submitUpgradeRequest({
        email: 'principal@school.edu',
        school: 'Test School',
      })
    ).rejects.toThrow('Lead already exists');
  });

  it('validates status transitions', async () => {
    repo.getById.mockResolvedValue({
      id: 'lead-1',
      status: 'new',
    } as UpgradeRequest);

    const service = createLeadService(repo);

    await expect(
      service.updateLeadStatus('lead-1', 'closed' as any)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('lists upgrade requests with repository result', async () => {
    const list: LeadListResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    };
    repo.getUpgradeRequests.mockResolvedValue(list);

    const service = createLeadService(repo);

    const result = await service.listUpgradeRequests({});
    expect(result).toEqual(list);
  });
});
