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
import { registerEventHandlers } from './events';

const app: Application = express();

setupErrorHandlers();
registerEventHandlers();
app.use(helmet());

const allowedOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
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
