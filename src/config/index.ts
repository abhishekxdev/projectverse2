/**
 * Central Configuration Exports
 * Exports all configuration modules and validation utilities
 */

export { default as firebase, db, auth, storage } from './firebase';
export * from './openai-client';
export { default as openai, client } from './openai';
export * from './constants';

// Environment validation
export function validateEnvironment(): void {
  const requiredVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'OPENAI_API_KEY',
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }

  console.log('Environment validation passed');
}

// Optional environment variables with defaults
export const OPTIONAL_ENV_VARS = {
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

export const env = {
  ...process.env,
  ...OPTIONAL_ENV_VARS,
};

try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error);
  // In production, we might want to exit the process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}
