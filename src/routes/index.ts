import { Router, Request, Response } from 'express';
import { HTTP_STATUS } from '../config/constants';
import authRouter from './auth.routes';
import userRouter from './user.routes';
import schoolRouter from './school.routes';
import schoolAdminRouter from './schoolAdmin.routes';
import notificationRouter from './notification.routes';
import profileRouter, { adminProfileRouter } from './profile.routes';
import platformAdminRouter from './platformAdmin.routes';
import { publicLeadRouter, adminLeadRouter } from './lead.routes';
import {
  schoolJoinRequestRouter,
  schoolJoinAdminRouter,
} from './schoolJoinRequest.routes';
import competencyRouter from './competency.routes';
import uploadRouter from './upload.routes';
import tutorRouter from './tutor.routes';
import learningRouter from './learning.routes';
import pdModuleRouter from './pdModule.routes';
import growthRouter from './growth.routes';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(HTTP_STATUS.OK).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRouter);
router.use('/user', userRouter);
router.use('/users', userRouter);
router.use('/schools', schoolRouter);
router.use('/schools', schoolJoinRequestRouter);
router.use('/admin/school', schoolAdminRouter);
router.use('/admin/school', schoolJoinAdminRouter);
router.use('/notifications', notificationRouter);
router.use('/profile', profileRouter);
router.use('/admin/approvals', adminProfileRouter);
router.use('/platform-admin/leads', adminLeadRouter);
router.use('/platform-admin', platformAdminRouter);
router.use('/leads', publicLeadRouter);
router.use('/competency', competencyRouter);
router.use('/upload', uploadRouter);
router.use('/tutor', tutorRouter);
router.use('/learning-path', learningRouter);
router.use('/pd', pdModuleRouter);
router.use('/growth', growthRouter);

export default router;
