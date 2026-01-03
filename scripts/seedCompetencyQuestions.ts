/**
 * Competency Question Bank Seed Script
 * Imports all 250 questions from data/sample-competency-questions.json
 *
 * Based on TCDT_multisheet_with_rubric.md documentation:
 * - A. Scenario MCQs (50 questions)
 * - B. Short Answers (50 questions)
 * - C. Audio Roleplays (50 questions)
 * - D. Self-Perception (50 questions)
 * - E. Teaching Dilemmas (50 questions)
 *
 * Run: npx ts-node scripts/seedCompetencyQuestions.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { firestore } from 'firebase-admin';
import { db } from '../src/config/firebase';
import { PD_TRACKS } from '../src/config/constants';

// Types matching the JSON structure
interface JsonQuestion {
  id: string;
  category: string;
  type: string;
  track: string;
  domainKey: string;
  prompt: string;
  options?: string[];
  correctOption?: string;
  bloomLevel?: string;
  competencyTag?: string;
  scoringCriteria?: string;
  bestResponse?: string;
  maxScore: number;
  order: number;
}

interface JsonData {
  assessmentId: string;
  title: string;
  description: string;
  version: string;
  totalQuestions: number;
  categories: Record<string, number>;
  rubric: Record<string, unknown>;
  tracks: Array<{ id: string; name: string }>;
  questions: JsonQuestion[];
}

// Track name to ID mapping
const trackNameToId: Record<string, string> = {
  'Pedagogical Mastery': 'pedagogical_mastery',
  'AI & Tech': 'tech_ai_fluency',
  'Inclusive Practice': 'inclusive_practice',
  'Professional Identity': 'professional_identity',
  'Global Citizenship': 'global_citizenship',
  'Educational Foundations': 'foundations_policy',
};

// ============ MAIN SEED FUNCTION ============
const seedCompetencyQuestions = async (): Promise<void> => {
  console.log('Starting competency question bank seed...\n');

  // Read JSON file
  const jsonPath = path.join(__dirname, '..', 'data', 'sample-competency-questions.json');

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON file not found at ${jsonPath}. Run generateCompetencyQuestionsJson.ts first.`);
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const data: JsonData = JSON.parse(jsonContent);

  console.log(`Loaded ${data.questions.length} questions from JSON file\n`);

  const now = firestore.Timestamp.now();
  const assessmentId = data.assessmentId;

  // Create or update assessment document
  await db.collection('competencyAssessments').doc(assessmentId).set({
    id: assessmentId,
    title: data.title,
    description: data.description,
    version: data.version,
    active: true,
    totalQuestions: data.totalQuestions,
    questionsPerDomain: 5,
    categories: data.categories,
    rubric: data.rubric,
    tracks: data.tracks,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  console.log('Created/Updated assessment document\n');

  // Count questions by category
  const categoryCounts: Record<string, number> = {};
  data.questions.forEach(q => {
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
  });

  console.log('Question breakdown:');
  Object.entries(categoryCounts).forEach(([category, count]) => {
    console.log(`  - ${category}: ${count}`);
  });
  console.log('');

  // Delete existing questions for this assessment (clean slate)
  console.log('Clearing existing questions...');
  const existingQuestions = await db.collection('competencyQuestions')
    .where('assessmentId', '==', assessmentId)
    .get();

  if (!existingQuestions.empty) {
    const deleteBatch = db.batch();
    existingQuestions.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log(`  Deleted ${existingQuestions.size} existing questions\n`);
  } else {
    console.log('  No existing questions to delete\n');
  }

  // Batch write all questions (Firestore limit: 500 per batch)
  console.log('Seeding questions to Firestore...');
  const BATCH_SIZE = 450; // Stay under 500 limit
  let batchCount = 0;
  let totalWritten = 0;

  for (let i = 0; i < data.questions.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = data.questions.slice(i, i + BATCH_SIZE);

    for (const question of chunk) {
      const questionId = `q-${question.id.toLowerCase()}`;
      const ref = db.collection('competencyQuestions').doc(questionId);

      // Map track name to track ID
      const trackId = trackNameToId[question.track] || question.track.toLowerCase().replace(/\s+/g, '_');

      const questionDoc: Record<string, unknown> = {
        id: questionId,
        assessmentId,
        domainKey: question.domainKey,
        trackId,
        track: question.track,
        type: question.type,
        category: question.category,
        prompt: question.prompt,
        maxScore: question.maxScore,
        order: question.order,
        active: true,
        createdAt: now,
      };

      // Add optional fields if present
      if (question.options) {
        questionDoc.options = question.options;
      }
      if (question.correctOption) {
        questionDoc.correctOption = question.correctOption;
      }
      if (question.bloomLevel) {
        questionDoc.bloomLevel = question.bloomLevel;
      }
      if (question.competencyTag) {
        questionDoc.competencyTag = question.competencyTag;
      }
      if (question.scoringCriteria) {
        questionDoc.scoringCriteria = question.scoringCriteria;
      }
      if (question.bestResponse) {
        questionDoc.bestResponse = question.bestResponse;
      }

      // Add rubric criteria based on category
      if (question.category === 'B_SHORT_ANSWER') {
        questionDoc.rubricCriteria = ['Depth of Reflection', 'Growth Orientation', 'Clarity of Thought'];
      } else if (question.category === 'C_AUDIO_ROLEPLAY') {
        questionDoc.rubricCriteria = ['Empathy & Tone', 'Instructional Language', 'Logical Structure'];
      } else if (question.category === 'E_TEACHING_DILEMMA') {
        questionDoc.rubricCriteria = ['Ethical Reasoning', 'Professional Judgment', 'Clarity of Action'];
      }

      batch.set(ref, questionDoc);
    }

    await batch.commit();
    batchCount++;
    totalWritten += chunk.length;
    console.log(`  Batch ${batchCount}: Wrote ${chunk.length} questions (Total: ${totalWritten}/${data.questions.length})`);
  }

  console.log(`\nSeeded ${totalWritten} questions to Firestore\n`);

  // Create PD Modules for each track
  console.log('Creating/Updating PD Modules...\n');

  let moduleOrder = 1;
  for (const [trackKey, trackData] of Object.entries(PD_TRACKS)) {
    const moduleId = `pd-module-${trackData.id}`;
    await db.collection('pdModules').doc(moduleId).set({
      id: moduleId,
      trackId: trackData.id,
      title: trackData.name,
      description: `Professional development track for ${trackData.name}`,
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

    console.log(`  Created PD Module: ${trackData.name}`);
  }

  // Summary
  console.log('\n============ SEED SUMMARY ============');
  console.log(`Assessment ID: ${assessmentId}`);
  console.log(`Total Questions: ${totalWritten}`);
  console.log('Categories:');
  Object.entries(categoryCounts).forEach(([category, count]) => {
    console.log(`  - ${category}: ${count}`);
  });
  console.log(`PD Modules: ${Object.keys(PD_TRACKS).length}`);
  console.log('======================================\n');

  console.log('Competency question bank seed completed successfully!');
};

// Run the seed
seedCompetencyQuestions()
  .then(() => {
    console.log('\nSeed script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });
