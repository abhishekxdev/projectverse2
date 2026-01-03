/**
 * Quick script to seed PD modules to production
 * Usage: ALLOW_PRODUCTION_SEED=true npx ts-node scripts/seed-pd-modules.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { firestore } from 'firebase-admin';
import { db } from '../src/config/firebase';
import { PD_TRACKS, TRACK_MODULE_TYPES } from '../src/config/constants';

const MODULES_COLLECTION = 'pdModules';

const isProductionSeed = process.env.ALLOW_PRODUCTION_SEED === 'true';

const assertEnvironment = (): void => {
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST
  );

  if (!isEmulator && !isProductionSeed) {
    throw new Error(
      'Seeding is restricted to Firebase emulators. Set ALLOW_PRODUCTION_SEED=true if you really intend to seed a live project.'
    );
  }
};

const seedPdModules = async (): Promise<void> => {
  console.log('Seeding PD Modules...\n');
  console.log(`Collection: ${MODULES_COLLECTION}`);
  console.log(`Environment: ${isProductionSeed ? 'PRODUCTION' : 'EMULATOR'}\n`);

  const now = firestore.Timestamp.now();
  let moduleOrder = 1;
  let totalModules = 0;

  for (const [trackKey, trackData] of Object.entries(PD_TRACKS)) {
    const moduleTypes = TRACK_MODULE_TYPES[trackData.id] || [];

    console.log(`\n📚 Track: ${trackData.name} (${moduleTypes.length} modules)`);

    for (const moduleType of moduleTypes) {
      const moduleId = `${trackData.id}_${moduleType.toLowerCase().replace(/\s+/g, '_')}`;

      await db.collection(MODULES_COLLECTION).doc(moduleId).set({
        id: moduleId,
        trackId: trackData.id,
        title: `${trackData.name}: ${moduleType}`,
        description: `Professional development module focusing on ${moduleType} within ${trackData.name}`,
        domainKey: trackData.competencies[0],
        badge: trackData.badge,
        microBadges: trackData.microBadges,
        competencies: trackData.competencies,
        passingScore: 80,
        maxAttempts: 3,
        cooldownHours: 24,
        order: moduleOrder++,
        active: true,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });

      console.log(`  ✓ ${moduleType} (order: ${moduleOrder - 1})`);
      totalModules++;
    }
  }

  console.log(`\n✅ Seeded ${totalModules} PD modules across ${Object.keys(PD_TRACKS).length} tracks successfully!`);
};

const main = async (): Promise<void> => {
  assertEnvironment();
  await seedPdModules();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
