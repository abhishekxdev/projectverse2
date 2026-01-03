import 'dotenv/config';
import http from 'http';
import app from './app';
import { env } from './config';

const server = http.createServer(app);

server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(
    `Health check available at: http://localhost:${env.PORT}/api/health`
  );
});
