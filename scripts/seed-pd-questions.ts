/**
 * Seed default PD questions for each module
 * Usage: ALLOW_PRODUCTION_SEED=true npx ts-node scripts/seed-pd-questions.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { firestore } from 'firebase-admin';
import { db } from '../src/config/firebase';
import { PD_TRACKS } from '../src/config/constants';

const QUESTIONS_COLLECTION = 'pdQuestions';
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

// Default questions for each track
const DEFAULT_QUESTIONS: Record<string, Array<{
  type: 'MCQ' | 'SHORT_ANSWER';
  prompt: string;
  options?: string[];
  correctOption?: string;
  maxScore: number;
}>> = {
  pedagogical_mastery: [
    {
      type: 'MCQ',
      prompt: 'What is the primary purpose of a lesson plan?',
      options: [
        'To satisfy administrative requirements',
        'To provide a structured roadmap for teaching and learning',
        'To limit student creativity',
        'To reduce teacher preparation time'
      ],
      correctOption: 'To provide a structured roadmap for teaching and learning',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Which instructional strategy promotes higher-order thinking?',
      options: [
        'Rote memorization',
        'Direct lecturing only',
        'Problem-based learning',
        'Reading aloud from textbooks'
      ],
      correctOption: 'Problem-based learning',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Effective classroom management primarily focuses on:',
      options: [
        'Punishing misbehavior',
        'Creating a positive learning environment',
        'Maintaining silence at all times',
        'Following rigid schedules'
      ],
      correctOption: 'Creating a positive learning environment',
      maxScore: 1,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Describe how you would differentiate instruction for students with varying learning abilities in your classroom.',
      maxScore: 5,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Explain the importance of formative assessment and provide an example of how you would use it in your teaching.',
      maxScore: 5,
    },
  ],
  tech_ai_fluency: [
    {
      type: 'MCQ',
      prompt: 'What is a key benefit of integrating technology in the classroom?',
      options: [
        'It replaces the need for teachers',
        'It enhances student engagement and learning outcomes',
        'It eliminates the need for textbooks',
        'It reduces teacher workload completely'
      ],
      correctOption: 'It enhances student engagement and learning outcomes',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'AI literacy for teachers primarily involves:',
      options: [
        'Programming AI systems from scratch',
        'Understanding how AI works and its ethical implications',
        'Avoiding all AI tools in education',
        'Using only AI for grading'
      ],
      correctOption: 'Understanding how AI works and its ethical implications',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Digital citizenship education should include:',
      options: [
        'Only technical skills',
        'Online safety, privacy, and responsible use',
        'Avoiding internet use entirely',
        'Gaming skills only'
      ],
      correctOption: 'Online safety, privacy, and responsible use',
      maxScore: 1,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'How would you use AI tools to personalize learning for your students while maintaining academic integrity?',
      maxScore: 5,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Describe a blended learning approach you would implement in your classroom and explain its benefits.',
      maxScore: 5,
    },
  ],
  inclusive_practice: [
    {
      type: 'MCQ',
      prompt: 'Universal Design for Learning (UDL) emphasizes:',
      options: [
        'One-size-fits-all approach',
        'Multiple means of engagement, representation, and expression',
        'Separate classrooms for different learners',
        'Standardized testing only'
      ],
      correctOption: 'Multiple means of engagement, representation, and expression',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Cultural competence in teaching involves:',
      options: [
        'Ignoring cultural differences',
        'Teaching only mainstream culture',
        'Respecting and integrating diverse cultural perspectives',
        'Avoiding cultural topics entirely'
      ],
      correctOption: 'Respecting and integrating diverse cultural perspectives',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Social-emotional learning (SEL) helps students:',
      options: [
        'Focus only on academics',
        'Develop self-awareness, empathy, and relationship skills',
        'Avoid emotional expression',
        'Compete against each other'
      ],
      correctOption: 'Develop self-awareness, empathy, and relationship skills',
      maxScore: 1,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'How would you create an inclusive classroom environment for students with diverse learning needs?',
      maxScore: 5,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Describe strategies you would use to integrate social-emotional learning into your daily teaching.',
      maxScore: 5,
    },
  ],
  professional_identity: [
    {
      type: 'MCQ',
      prompt: 'Reflective practice in teaching involves:',
      options: [
        'Avoiding self-evaluation',
        'Analyzing and improving one\'s teaching methods',
        'Following instructions without questioning',
        'Focusing only on student grades'
      ],
      correctOption: 'Analyzing and improving one\'s teaching methods',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Professional development for teachers should be:',
      options: [
        'A one-time event',
        'Ongoing and continuous throughout career',
        'Focused only on content knowledge',
        'Mandatory but not useful'
      ],
      correctOption: 'Ongoing and continuous throughout career',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Ethical teaching practices include:',
      options: [
        'Maintaining confidentiality and fairness',
        'Sharing student information freely',
        'Favoritism toward certain students',
        'Avoiding parent communication'
      ],
      correctOption: 'Maintaining confidentiality and fairness',
      maxScore: 1,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'How do you engage in reflective practice and what impact has it had on your teaching?',
      maxScore: 5,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Describe your approach to building collaborative relationships with colleagues and parents.',
      maxScore: 5,
    },
  ],
  global_citizenship: [
    {
      type: 'MCQ',
      prompt: '21st century skills include:',
      options: [
        'Only reading and writing',
        'Critical thinking, creativity, collaboration, and communication',
        'Memorization only',
        'Following instructions without questioning'
      ],
      correctOption: 'Critical thinking, creativity, collaboration, and communication',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Global citizenship education aims to:',
      options: [
        'Focus only on local issues',
        'Develop awareness of global issues and interconnectedness',
        'Promote nationalism exclusively',
        'Avoid discussing world events'
      ],
      correctOption: 'Develop awareness of global issues and interconnectedness',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Sustainable development education teaches students to:',
      options: [
        'Ignore environmental issues',
        'Understand the impact of actions on future generations',
        'Focus only on economic growth',
        'Avoid discussing climate change'
      ],
      correctOption: 'Understand the impact of actions on future generations',
      maxScore: 1,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'How would you integrate global citizenship themes into your subject area?',
      maxScore: 5,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Describe how you would teach 21st century skills while covering curriculum requirements.',
      maxScore: 5,
    },
  ],
  foundations_policy: [
    {
      type: 'MCQ',
      prompt: 'Understanding education policy is important for teachers because:',
      options: [
        'It\'s not relevant to classroom teaching',
        'It shapes curriculum, assessment, and teaching practices',
        'It only affects administrators',
        'It has no practical application'
      ],
      correctOption: 'It shapes curriculum, assessment, and teaching practices',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Educational foundations include:',
      options: [
        'Only teaching methods',
        'Philosophy, psychology, sociology, and history of education',
        'Only classroom management',
        'Only assessment techniques'
      ],
      correctOption: 'Philosophy, psychology, sociology, and history of education',
      maxScore: 1,
    },
    {
      type: 'MCQ',
      prompt: 'Child development theories help teachers:',
      options: [
        'Ignore individual differences',
        'Understand how students learn at different stages',
        'Apply the same methods to all ages',
        'Focus only on academic content'
      ],
      correctOption: 'Understand how students learn at different stages',
      maxScore: 1,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'How does understanding educational policy influence your teaching practice?',
      maxScore: 5,
    },
    {
      type: 'SHORT_ANSWER',
      prompt: 'Explain how you apply child development principles in your classroom.',
      maxScore: 5,
    },
  ],
};

const seedPdQuestions = async (): Promise<void> => {
  console.log('Seeding PD Module Questions...\n');
  console.log(`Collection: ${QUESTIONS_COLLECTION}`);
  console.log(`Environment: ${isProductionSeed ? 'PRODUCTION' : 'EMULATOR'}\n`);

  const now = firestore.Timestamp.now();
  let totalQuestions = 0;

  for (const [trackKey, trackData] of Object.entries(PD_TRACKS)) {
    const moduleId = `pd-module-${trackData.id}`;
    const questions = DEFAULT_QUESTIONS[trackData.id];

    if (!questions) {
      console.log(`  ⚠ No questions defined for ${trackData.name}`);
      continue;
    }

    console.log(`\nSeeding questions for: ${trackData.name}`);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionId = `${moduleId}-q${i + 1}`;

      await db.collection(QUESTIONS_COLLECTION).doc(questionId).set({
        id: questionId,
        moduleId,
        attemptId: null, // Cached/template question
        type: q.type,
        prompt: q.prompt,
        options: q.options || null,
        correctOption: q.correctOption || null,
        maxScore: q.maxScore,
        order: i + 1,
        generatedByAi: false,
        createdAt: now,
      }, { merge: true });

      totalQuestions++;
    }

    console.log(`  ✓ Added ${questions.length} questions for ${trackData.name}`);
  }

  console.log(`\n✅ Seeded ${totalQuestions} PD questions successfully!`);
};

const main = async (): Promise<void> => {
  assertEnvironment();
  await seedPdQuestions();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
