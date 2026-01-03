import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import router from './routes';
import { env } from './config';
import {
  errorHandler,
  notFoundHandler,
  setupErrorHandlers,
} from './middlewares/error.handler';
import { requestIdMiddleware, logger } from './utils/logger';
import { tierBasedRateLimiter } from './middlewares/rate.limiter';
import { optionalAuthMiddleware } from './middlewares/auth';

const app: Application = express();

setupErrorHandlers();
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

app.use(requestIdMiddleware());
app.use(express.json({ limit: '10mb' }));
app.use(optionalAuthMiddleware);
app.use('/api', tierBasedRateLimiter());

// Request logging middleware
app.use((req, res, next) => {
  logger.logRequest(req);
  next();
});

app.use('/api', router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
