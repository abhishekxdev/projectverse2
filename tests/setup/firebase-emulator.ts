import admin from 'firebase-admin';

export const TEST_PROJECT_ID = 'demo-gurucool-test'; //! for consistency with namiing in firebase config

/**
 * Configure Firebase Admin SDK to use emulators
 * Must be called BEFORE importing any modules that use Firebase
 */
export const setupEmulators = () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.GCLOUD_PROJECT = TEST_PROJECT_ID;
  process.env.FIREBASE_PROJECT_ID = TEST_PROJECT_ID;

  // Disable SSL for emulator connections
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
};

/**
 * Get Firebase Admin instances (uses the app already initialized by src/config/firebase.ts)
 */
export const getTestFirebase = () => {
  return {
    auth: admin.auth(),
    db: admin.firestore(),
  };
};

/**
 * Initialize Firebase Admin for testing - only if not already initialized
 * @deprecated Use getTestFirebase() instead after importing app
 */
export const initializeTestFirebase = () => {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: TEST_PROJECT_ID,
    });
  }
  return {
    auth: admin.auth(),
    db: admin.firestore(),
  };
};

/**
 * Clean up all test data from emulators
 */
export const clearEmulatorData = async () => {
  try {
    // Clear Firestore
    await fetch(
      `http://localhost:8080/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' }
    );

    // Clear Auth users
    await fetch(
      `http://localhost:9099/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`,
      { method: 'DELETE' }
    );
  } catch (error) {
    console.warn('Failed to clear emulator data:', error);
  }
};

/**
 * Create a test user and get their ID token
 */
export const createTestUser = async (
  auth: admin.auth.Auth,
  db: FirebaseFirestore.Firestore,
  userData: {
    email: string;
    password?: string;
    role?: string;
    tier?: string;
    displayName?: string;
    schoolId?: string | null;
    status?: string;
  }
) => {
  const {
    email,
    password = 'testPassword123',
    role = 'individual',
    tier = 'free',
    displayName = 'Test User',
    schoolId = null,
    status = 'active',
  } = userData;

  // Create user in Auth Emulator
  const userRecord = await auth.createUser({
    email,
    password,
    emailVerified: true,
    displayName,
  });

  // Create user document in Firestore
  await db
    .collection('users')
    .doc(userRecord.uid)
    .set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      tier,
      schoolId,
      status,
      usage: {
        assessmentsTakenMonth: 0,
        tutorMessagesMonth: 0,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  await auth.setCustomUserClaims(userRecord.uid, {
    role,
    schoolId,
    status,
  });

  // Generate ID token via custom token exchange
  const customToken = await auth.createCustomToken(userRecord.uid);
  const idToken = await exchangeCustomTokenForIdToken(customToken);

  return {
    uid: userRecord.uid,
    email,
    schoolId,
    status,
    idToken,
    customToken,
  };
};

/**
 * Exchange custom token for ID token using emulator REST API
 */
export const exchangeCustomTokenForIdToken = async (
  customToken: string
): Promise<string> => {
  const response = await fetch(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange token: ${error}`);
  }

  const data = await response.json();
  return data.idToken;
};
