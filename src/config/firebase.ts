import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

/**
 * Firebase Admin SDK initialization
 * Supports both production and emulator environments
 */

const isEmulatorMode = (): boolean => {
  return !!(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST
  );
};

if (!admin.apps.length) {
  try {
    if (isEmulatorMode()) {
      // Emulator mode - use demo project (no credentials needed)
      admin.initializeApp({
        projectId: 'gurukul-ai-bdf19',
      });
      console.log('Firebase Admin SDK initialized in EMULATOR mode');
    } else {
      // Production mode - use real credentials
      const serviceAccount: ServiceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        privateKey:
          process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.projectId,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      });
      console.log('Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw new Error(
      'Firebase initialization failed. Please check your credentials.'
    );
  }
}

// Export Firebase services
export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export const firebase = admin;

// Helper function to get Firestore instance
export const getFirestore = (): FirebaseFirestore.Firestore => db;

export default admin;
