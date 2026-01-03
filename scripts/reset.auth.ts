import * as dotenv from 'dotenv';
dotenv.config();

import { auth, db } from '../src/config/firebase';

/**
 * Reset Auth Script
 * Deletes all Firebase Auth users and their corresponding Firestore documents.
 * Only works in emulator environment unless ALLOW_PRODUCTION_RESET=true.
 */

const assertEmulatorEnvironment = (): void => {
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST
  );

  if (!isEmulator && process.env.ALLOW_PRODUCTION_RESET !== 'true') {
    throw new Error(
      'Reset is restricted to Firebase emulators. Set ALLOW_PRODUCTION_RESET=true if you really intend to reset a live project.'
    );
  }
};

const deleteAuthUsers = async (): Promise<number> => {
  let deletedCount = 0;
  let nextPageToken: string | undefined;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    const uids = listResult.users.map((user) => user.uid);

    if (uids.length > 0) {
      await auth.deleteUsers(uids);
      deletedCount += uids.length;
      console.log(`Deleted ${uids.length} auth users...`);
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  return deletedCount;
};

const deleteUserDocuments = async (): Promise<number> => {
  let deletedCount = 0;
  const batchSize = 500;

  let snapshot = await db.collection('users').limit(batchSize).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += snapshot.docs.length;
    console.log(`Deleted ${snapshot.docs.length} user documents...`);

    // Get next batch
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    snapshot = await db
      .collection('users')
      .startAfter(lastDoc)
      .limit(batchSize)
      .get();
  }

  return deletedCount;
};

const deleteSchoolDocuments = async (): Promise<number> => {
  let deletedCount = 0;
  const batchSize = 500;

  let snapshot = await db.collection('schools').limit(batchSize).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += snapshot.docs.length;
    console.log(`Deleted ${snapshot.docs.length} school documents...`);

    // Get next batch
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    snapshot = await db
      .collection('schools')
      .startAfter(lastDoc)
      .limit(batchSize)
      .get();
  }

  return deletedCount;
};

const deleteNotificationDocuments = async (): Promise<number> => {
  let deletedCount = 0;
  const batchSize = 500;

  let snapshot = await db.collection('notifications').limit(batchSize).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += snapshot.docs.length;
    console.log(`Deleted ${snapshot.docs.length} notification documents...`);

    // Get next batch
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    snapshot = await db
      .collection('notifications')
      .startAfter(lastDoc)
      .limit(batchSize)
      .get();
  }

  return deletedCount;
};

const main = async (): Promise<void> => {
  assertEmulatorEnvironment();

  console.log('Resetting Firebase Auth and related Firestore data...\n');

  const authCount = await deleteAuthUsers();
  console.log(`\nTotal auth users deleted: ${authCount}`);

  const userDocsCount = await deleteUserDocuments();
  console.log(`Total user documents deleted: ${userDocsCount}`);

  const schoolDocsCount = await deleteSchoolDocuments();
  console.log(`Total school documents deleted: ${schoolDocsCount}`);

  const notificationDocsCount = await deleteNotificationDocuments();
  console.log(`Total notification documents deleted: ${notificationDocsCount}`);

  console.log('\nReset complete. Run seed script to repopulate data.');
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Reset failed:', error);
    process.exit(1);
  });
