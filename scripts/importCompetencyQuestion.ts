/**
 * Import Competency Questions Script
 *
 * Usage:
 *   pnpm ts-node scripts/importCompetencyQuestion.ts [path/to/questions.json]
 *
 * If no path is provided, sample questions will be imported.
 */

import { createCompetencyRepository } from '../src/repositories/competencyRepository';
import {
  importCompetencyQuestionsSchema,
  competencyAssessmentSchema,
} from '../src/schemas/competency.schema';
import {
  CompetencyQuestion,
  CompetencyAssessment,
} from '../src/types/competency.types';
import { logger } from '../src/utils/logger';
import { COMPETENCY_DOMAINS } from '../src/config/constants';
import { db } from '../src/config/firebase';
import fs from 'fs';

const repo = createCompetencyRepository();

/**
 * Sample assessment data
 */
const sampleAssessment: Omit<CompetencyAssessment, 'id'> & { id: string } = {
  id: 'comp-assess-1',
  title: 'Teaching Competency Benchmark',
  description:
    'Global competency assessment for teachers to evaluate their skills across key domains.',
  active: true,
};

/**
 * Sample questions covering all domains and question types
 */
const sampleQuestions: CompetencyQuestion[] = [
  // Planning Domain - MCQ
  {
    id: 'q1',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.PLANNING,
    type: 'MCQ',
    prompt: 'What is the first step in effective lesson planning?',
    options: [
      'Set clear learning objectives',
      'Choose teaching resources',
      'Create assessments',
      'Design activities',
    ],
    correctOption: 'Set clear learning objectives',
    maxScore: 1,
    order: 1,
  },
  {
    id: 'q2',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.PLANNING,
    type: 'SHORT_ANSWER',
    prompt:
      'Describe how you would plan a lesson that accommodates students with different learning styles. Include specific strategies for visual, auditory, and kinesthetic learners.',
    maxScore: 5,
    order: 2,
  },
  // Pedagogy Domain
  {
    id: 'q3',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.PEDAGOGY,
    type: 'MCQ',
    prompt:
      'Which teaching approach is most effective for developing critical thinking skills?',
    options: [
      'Inquiry-based learning',
      'Direct instruction only',
      'Rote memorization',
      'Lecture-based teaching',
    ],
    correctOption: 'Inquiry-based learning',
    maxScore: 1,
    order: 3,
  },
  {
    id: 'q4',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.PEDAGOGY,
    type: 'SHORT_ANSWER',
    prompt:
      'Explain a situation where you would use differentiated instruction and describe the specific strategies you would employ.',
    maxScore: 5,
    order: 4,
  },
  // Assessment Domain
  {
    id: 'q5',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.ASSESSMENT,
    type: 'MCQ',
    prompt:
      'What is the primary purpose of formative assessment in the classroom?',
    options: [
      'To guide instruction and provide feedback during learning',
      'To assign final grades',
      'To compare students with national standards',
      'To fulfill administrative requirements',
    ],
    correctOption: 'To guide instruction and provide feedback during learning',
    maxScore: 1,
    order: 5,
  },
  {
    id: 'q6',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.ASSESSMENT,
    type: 'AUDIO',
    prompt:
      'Record a brief explanation of how you would use formative assessment data to adjust your teaching strategies.',
    maxScore: 10,
    order: 6,
  },
  // Classroom Management Domain
  {
    id: 'q7',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.CLASSROOM_MANAGEMENT,
    type: 'MCQ',
    prompt:
      'Which strategy is most effective for establishing classroom routines?',
    options: [
      'Teach, model, and practice routines consistently',
      'Post rules and expect compliance',
      'Address issues as they arise',
      'Let students develop their own rules',
    ],
    correctOption: 'Teach, model, and practice routines consistently',
    maxScore: 1,
    order: 7,
  },
  {
    id: 'q8',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.CLASSROOM_MANAGEMENT,
    type: 'SHORT_ANSWER',
    prompt:
      'Describe your approach to handling a disruptive student while maintaining a positive learning environment for all students.',
    maxScore: 5,
    order: 8,
  },
  // Technology Domain
  {
    id: 'q9',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.TECHNOLOGY,
    type: 'MCQ',
    prompt:
      'Which factor is most important when selecting educational technology tools?',
    options: [
      'Alignment with learning objectives',
      'Popularity among students',
      'Low cost',
      'Easy administration',
    ],
    correctOption: 'Alignment with learning objectives',
    maxScore: 1,
    order: 9,
  },
  {
    id: 'q10',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.TECHNOLOGY,
    type: 'SHORT_ANSWER',
    prompt:
      'Explain how you would integrate technology to enhance student engagement and learning outcomes in a specific subject area.',
    maxScore: 5,
    order: 10,
  },
  // Communication Domain
  {
    id: 'q11',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.COMMUNICATION,
    type: 'MCQ',
    prompt:
      'What is the most effective way to communicate with parents about student progress?',
    options: [
      'Regular, specific, and balanced feedback',
      'Only report cards at the end of term',
      'Contact only when there are problems',
      'Annual parent-teacher conferences only',
    ],
    correctOption: 'Regular, specific, and balanced feedback',
    maxScore: 1,
    order: 11,
  },
  {
    id: 'q12',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.COMMUNICATION,
    type: 'VIDEO',
    prompt:
      'Record a 1-minute video demonstrating how you would explain a complex concept to students, using clear language and checking for understanding.',
    maxScore: 10,
    order: 12,
  },
  // Differentiation Domain
  {
    id: 'q13',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.DIFFERENTIATION,
    type: 'MCQ',
    prompt: 'Which approach best supports differentiated instruction?',
    options: [
      'Flexible grouping based on student needs',
      'Same content and pace for all students',
      'Tracking students by ability permanently',
      'Teaching to the middle',
    ],
    correctOption: 'Flexible grouping based on student needs',
    maxScore: 1,
    order: 13,
  },
  {
    id: 'q14',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.DIFFERENTIATION,
    type: 'SHORT_ANSWER',
    prompt:
      'Describe how you would modify a lesson to meet the needs of both struggling learners and advanced students in the same classroom.',
    maxScore: 5,
    order: 14,
  },
  // Professional Development Domain
  {
    id: 'q15',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.PROFESSIONAL_DEVELOPMENT,
    type: 'MCQ',
    prompt: 'What is the most effective approach to professional development?',
    options: [
      'Continuous learning with reflection and application',
      'One-time workshop attendance',
      'Reading professional journals only',
      'Observing other teachers occasionally',
    ],
    correctOption: 'Continuous learning with reflection and application',
    maxScore: 1,
    order: 15,
  },
  {
    id: 'q16',
    assessmentId: 'comp-assess-1',
    domainKey: COMPETENCY_DOMAINS.PROFESSIONAL_DEVELOPMENT,
    type: 'SHORT_ANSWER',
    prompt:
      'Reflect on a recent professional development experience and explain how you applied what you learned to improve your teaching practice.',
    maxScore: 5,
    order: 16,
  },
];

/**
 * Validate questions data
 */
const validateQuestions = (questions: unknown[]): CompetencyQuestion[] => {
  // Validate using Zod schema
  const result = importCompetencyQuestionsSchema.safeParse(questions);
  if (!result.success) {
    const errors = result.error.errors;
    logger.error('Validation failed', { errors });
    throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
  }
  return result.data as CompetencyQuestion[];
};

/**
 * Create or update the assessment document
 */
const ensureAssessment = async () => {
  const validatedAssessment =
    competencyAssessmentSchema.parse(sampleAssessment);
  const docRef = db
    .collection('competencyAssessments')
    .doc(sampleAssessment.id);
  await docRef.set({
    ...validatedAssessment,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  logger.info(`Assessment '${sampleAssessment.title}' created/updated`);
};

/**
 * Main import function
 */
const main = async () => {
  const filePath = process.argv[2];

  try {
    let questions: CompetencyQuestion[];

    if (filePath) {
      // Load from file
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      questions = validateQuestions(data);
      logger.info(`Loaded ${questions.length} questions from ${filePath}`);
    } else {
      // Use sample questions
      questions = validateQuestions(sampleQuestions);
      logger.info(`Using ${questions.length} sample questions`);
    }

    // Ensure assessment exists
    await ensureAssessment();

    // Import questions
    await repo.importQuestions(questions);

    logger.info('Import successful!');
    logger.info(`Total questions imported: ${questions.length}`);
    logger.info(
      `Domains covered: ${[...new Set(questions.map((q) => q.domainKey))].join(
        ', '
      )}`
    );
    logger.info(
      `Question types: ${[...new Set(questions.map((q) => q.type))].join(', ')}`
    );

    process.exit(0);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Import failed', err);
    process.exit(1); // Fail fast
  }
};

main();
