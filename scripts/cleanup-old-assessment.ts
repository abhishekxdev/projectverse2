import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '../src/config/firebase';

async function cleanup() {
  // Delete the old assessment
  const oldAssessmentId = 'competency-assessment-v1';
  await db.collection('competencyAssessments').doc(oldAssessmentId).delete();
  console.log('Deleted old assessment:', oldAssessmentId);

  // Delete old questions with that assessment ID
  const oldQuestionsSnap = await db.collection('competencyQuestions')
    .where('assessmentId', '==', oldAssessmentId)
    .get();

  if (oldQuestionsSnap.empty) {
    console.log('No old questions found');
  } else {
    const batch = db.batch();
    oldQuestionsSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('Deleted', oldQuestionsSnap.size, 'old questions');
  }
}

cleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
