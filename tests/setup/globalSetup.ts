import { setupEmulators } from './firebase-emulator';

export default async () => {
  console.log('\n🔥 Setting up Firebase Emulators for testing...');
  setupEmulators();

  // Wait for emulators to be ready
  const maxRetries = 30;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const authCheck = await fetch('http://localhost:9099/');
      const firestoreCheck = await fetch('http://localhost:8080/');

      if (authCheck.ok || firestoreCheck.status === 400) {
        console.log(' Firebase Emulators are ready!\n');
        return;
      }
    } catch {
      // Emulators not ready yet
    }

    retries++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    'Firebase Emulators not running! Start them with: pnpm test:emulators'
  );
};
