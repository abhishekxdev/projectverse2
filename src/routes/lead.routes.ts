import { Router } from 'express';
import {
  submitUpgradeLead,
  listUpgradeLeads,
  updateLeadStatus,
} from '../controllers/lead.controller';
import { authMiddleware } from '../middlewares/auth';
import { requirePlatformAdmin } from '../middlewares/role.guard';

const publicLeadRouter = Router();
const adminLeadRouter = Router();

publicLeadRouter.post('/upgrade-request', submitUpgradeLead);

adminLeadRouter.get(
  '/',
  authMiddleware,
  requirePlatformAdmin(),
  listUpgradeLeads
);
adminLeadRouter.put(
  '/:id/status',
  authMiddleware,
  requirePlatformAdmin(),
  updateLeadStatus
);

export { publicLeadRouter, adminLeadRouter };
