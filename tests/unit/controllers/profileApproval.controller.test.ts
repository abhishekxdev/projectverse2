const successResponse = jest.fn();
const errorResponse = jest.fn();

jest.mock('../../../src/utils/response', () => ({
  successResponse: jest.fn((...args) => successResponse(...args)),
  errorResponse: jest.fn((...args) => errorResponse(...args)),
  createdResponse: jest.fn(),
  paginatedResponse: jest.fn(),
}));

jest.mock('../../../src/services/profileApproval.service', () => ({
  __esModule: true,
  createProfileApprovalService: jest.fn(),
  __mockService: {
    submitProfileForApproval: jest.fn(),
  },
}));

const { __mockService: mockService, createProfileApprovalService } =
  jest.requireMock('../../../src/services/profileApproval.service');

createProfileApprovalService.mockImplementation(() => mockService);

import { submitProfileApproval } from '../../../src/controllers/profileApproval.controller';

describe('profileApproval.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    successResponse.mockReset();
    errorResponse.mockReset();
  });

  it('invokes service and responds with pending status on submit', async () => {
    mockService.submitProfileForApproval.mockResolvedValue({
      status: 'pending',
    });

    await submitProfileApproval(
      {
        user: { id: 'user-1' },
      } as any,
      {} as any
    );

    expect(mockService.submitProfileForApproval).toHaveBeenCalledWith({
      userId: 'user-1',
      actorId: 'user-1',
    });
    expect(successResponse).toHaveBeenCalledWith(expect.anything(), {
      status: 'pending',
    });
  });

  it('delegates to errorResponse when user missing', async () => {
    await submitProfileApproval({} as any, {} as any);

    expect(mockService.submitProfileForApproval).not.toHaveBeenCalled();
    expect(errorResponse).toHaveBeenCalled();
  });
});
