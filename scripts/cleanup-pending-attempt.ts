import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '../src/config/firebase';

const TEACHER_ID = 'TR2bowbBkjhYAHzDcSh9Vzg1P893';

async function cleanup() {
  // Find and delete pending/in-progress attempts for this teacher
  const attemptsSnap = await db.collection('teacherCompetencyAttempts')
    .where('teacherId', '==', TEACHER_ID)
    .where('status', 'in', ['IN_PROGRESS', 'SUBMITTED'])
    .get();

  if (attemptsSnap.empty) {
    console.log('No pending attempts found');
    return;
  }

  const batch = db.batch();
  attemptsSnap.docs.forEach(doc => {
    console.log(`Deleting attempt: ${doc.id} (status: ${doc.data().status})`);
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Deleted ${attemptsSnap.size} pending attempt(s)`);
}

cleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
