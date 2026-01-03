import { db } from '../config/firebase';
import { firestore } from 'firebase-admin';
import {
  CompetencyAssessment,
  CompetencyQuestion,
  TeacherCompetencyAttempt,
  TeacherCompetencyResult,
  QuestionAnswer,
  AttemptStatus,
  CompetencyEvent,
  CompetencyEventType,
  SelectedQuestion,
} from '../types/competency.types';
import { ATTEMPT_STATUS } from '../config/constants';
import { logger } from '../utils/logger';
import { ConflictError, NotFoundError } from '../utils/error';

const COLLECTIONS = {
  ASSESSMENTS: 'competencyAssessments',
  QUESTIONS: 'competencyQuestions',
  ATTEMPTS: 'teacherCompetencyAttempts',
  RESULTS: 'teacherCompetencyResults',
  EVENTS: 'competencyEvents',
};

export const createCompetencyRepository = () => {
  // ============ Assessment Methods ============
  const getAssessment = async (): Promise<CompetencyAssessment | null> => {
    // Get the first active assessment
    const snapshot = await db
      .collection(COLLECTIONS.ASSESSMENTS)
      .where('active', '==', true)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as CompetencyAssessment;
  };

  const getAssessmentById = async (
    assessmentId: string
  ): Promise<CompetencyAssessment | null> => {
    const doc = await db
      .collection(COLLECTIONS.ASSESSMENTS)
      .doc(assessmentId)
      .get();
    return doc.exists
      ? ({ id: doc.id, ...doc.data() } as CompetencyAssessment)
      : null;
  };

  const createAssessment = async (
    assessment: Omit<CompetencyAssessment, 'id'> & { id?: string }
  ): Promise<CompetencyAssessment> => {
    const docRef = assessment.id
      ? db.collection(COLLECTIONS.ASSESSMENTS).doc(assessment.id)
      : db.collection(COLLECTIONS.ASSESSMENTS).doc();

    const data = {
      title: assessment.title,
      description: assessment.description,
      active: assessment.active,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(data);
    return { id: docRef.id, ...assessment };
  };

  // ============ Question Methods ============
  const getQuestions = async (
    assessmentId: string
  ): Promise<CompetencyQuestion[]> => {
    const snapshot = await db
      .collection(COLLECTIONS.QUESTIONS)
      .where('assessmentId', '==', assessmentId)
      .orderBy('order')
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as CompetencyQuestion)
    );
  };

  const getQuestionsByDomain = async (
    assessmentId: string,
    domainKey: string
  ): Promise<CompetencyQuestion[]> => {
    const snapshot = await db
      .collection(COLLECTIONS.QUESTIONS)
      .where('assessmentId', '==', assessmentId)
      .where('domainKey', '==', domainKey)
      .orderBy('order')
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as CompetencyQuestion)
    );
  };

  const getQuestionById = async (
    questionId: string
  ): Promise<CompetencyQuestion | null> => {
    const doc = await db
      .collection(COLLECTIONS.QUESTIONS)
      .doc(questionId)
      .get();
    return doc.exists
      ? ({ id: doc.id, ...doc.data() } as CompetencyQuestion)
      : null;
  };

  const importQuestions = async (questions: CompetencyQuestion[]) => {
    const batch = db.batch();
    questions.forEach((q) => {
      const ref = db.collection(COLLECTIONS.QUESTIONS).doc(q.id);
      batch.set(ref, {
        ...q,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    logger.info(`Imported ${questions.length} competency questions.`);
  };

  // ============ Attempt Methods ============
  const createAttempt = async (
    teacherId: string,
    assessmentId: string,
    answers: QuestionAnswer[] = [],
    selectedQuestions?: SelectedQuestion[]
  ): Promise<TeacherCompetencyAttempt> => {
    // Check for ANY existing attempt (only one attempt per teacher allowed)
    const existingAttempt = await getAnyAttemptByTeacher(
      teacherId,
      assessmentId
    );
    if (existingAttempt) {
      throw new ConflictError(
        'An attempt already exists for this assessment. Reattempts are not allowed.'
      );
    }

    const docRef = db.collection(COLLECTIONS.ATTEMPTS).doc();
    const now = firestore.Timestamp.now();

    const attempt: Omit<TeacherCompetencyAttempt, 'id'> = {
      teacherId,
      assessmentId,
      answers,
      status: ATTEMPT_STATUS.IN_PROGRESS as AttemptStatus,
      selectedQuestions,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    };

    await docRef.set(attempt);
    return { id: docRef.id, ...attempt };
  };

  const getAttemptById = async (
    attemptId: string
  ): Promise<TeacherCompetencyAttempt | null> => {
    const doc = await db.collection(COLLECTIONS.ATTEMPTS).doc(attemptId).get();
    return doc.exists
      ? ({ id: doc.id, ...doc.data() } as TeacherCompetencyAttempt)
      : null;
  };

  const getActiveAttemptByTeacher = async (
    teacherId: string,
    assessmentId: string
  ): Promise<TeacherCompetencyAttempt | null> => {
    const snapshot = await db
      .collection(COLLECTIONS.ATTEMPTS)
      .where('teacherId', '==', teacherId)
      .where('assessmentId', '==', assessmentId)
      .where('status', 'in', [
        ATTEMPT_STATUS.IN_PROGRESS,
        ATTEMPT_STATUS.SUBMITTED,
      ])
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TeacherCompetencyAttempt;
  };

  /**
   * Get any existing attempt by teacher (regardless of status)
   * Used to enforce single attempt per teacher rule
   */
  const getAnyAttemptByTeacher = async (
    teacherId: string,
    assessmentId: string
  ): Promise<TeacherCompetencyAttempt | null> => {
    const snapshot = await db
      .collection(COLLECTIONS.ATTEMPTS)
      .where('teacherId', '==', teacherId)
      .where('assessmentId', '==', assessmentId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TeacherCompetencyAttempt;
  };

  const getAttemptsByTeacher = async (
    teacherId: string
  ): Promise<TeacherCompetencyAttempt[]> => {
    const snapshot = await db
      .collection(COLLECTIONS.ATTEMPTS)
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as TeacherCompetencyAttempt)
    );
  };

  const getAttemptsByStatus = async (
    status: AttemptStatus,
    limit: number = 10
  ): Promise<TeacherCompetencyAttempt[]> => {
    const snapshot = await db
      .collection(COLLECTIONS.ATTEMPTS)
      .where('status', '==', status)
      .orderBy('submittedAt', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as TeacherCompetencyAttempt)
    );
  };

  const updateAttempt = async (
    attemptId: string,
    updates: Partial<
      Pick<TeacherCompetencyAttempt, 'answers' | 'status' | 'retryCount'>
    >
  ): Promise<void> => {
    const docRef = db.collection(COLLECTIONS.ATTEMPTS).doc(attemptId);
    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: firestore.Timestamp.now(),
    };

    if (updates.status === ATTEMPT_STATUS.SUBMITTED) {
      updateData.submittedAt = firestore.Timestamp.now();
    }
    if (updates.status === ATTEMPT_STATUS.EVALUATED) {
      updateData.evaluatedAt = firestore.Timestamp.now();
    }

    await docRef.update(updateData);
  };

  const submitAttempt = async (
    attemptId: string,
    answers: QuestionAnswer[]
  ): Promise<void> => {
    await updateAttempt(attemptId, {
      answers,
      status: ATTEMPT_STATUS.SUBMITTED as AttemptStatus,
    });
  };

  // ============ Result Methods ============
  const createResult = async (
    result: Omit<TeacherCompetencyResult, 'id' | 'createdAt'>
  ): Promise<TeacherCompetencyResult> => {
    // Check for existing result for this attempt (idempotency)
    const existingResult = await getResultByAttemptId(result.attemptId);
    if (existingResult) {
      logger.warn(
        `Result already exists for attempt ${result.attemptId}, returning existing`
      );
      return existingResult;
    }

    const docRef = db.collection(COLLECTIONS.RESULTS).doc();
    const now = firestore.Timestamp.now();

    const data = {
      ...result,
      createdAt: now,
    };

    await docRef.set(data);
    return { id: docRef.id, ...data } as TeacherCompetencyResult;
  };

  const getResultByTeacherId = async (
    teacherId: string
  ): Promise<TeacherCompetencyResult | null> => {
    const snapshot = await db
      .collection(COLLECTIONS.RESULTS)
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TeacherCompetencyResult;
  };

  const getResultByAttemptId = async (
    attemptId: string
  ): Promise<TeacherCompetencyResult | null> => {
    const snapshot = await db
      .collection(COLLECTIONS.RESULTS)
      .where('attemptId', '==', attemptId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TeacherCompetencyResult;
  };

  const getAllResultsByTeacher = async (
    teacherId: string
  ): Promise<TeacherCompetencyResult[]> => {
    const snapshot = await db
      .collection(COLLECTIONS.RESULTS)
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as TeacherCompetencyResult)
    );
  };

  // ============ Competency Events Methods (Task 5: Audit Trail) ============
  const createEvent = async (
    teacherId: string,
    attemptId: string,
    eventType: CompetencyEventType,
    metadata?: Record<string, unknown>
  ): Promise<CompetencyEvent> => {
    // Check for existing event (idempotency)
    const existingEvent = await getEventByAttemptAndType(attemptId, eventType);
    if (existingEvent) {
      logger.warn(
        `Event ${eventType} already exists for attempt ${attemptId}, returning existing`
      );
      return existingEvent;
    }

    const docRef = db.collection(COLLECTIONS.EVENTS).doc();
    const now = firestore.Timestamp.now();

    const event: Omit<CompetencyEvent, 'id'> = {
      teacherId,
      attemptId,
      eventType,
      createdAt: now,
      ...(metadata !== undefined && { metadata }),
    };

    await docRef.set(event);
    logger.info(
      `Competency event ${eventType} logged for attempt ${attemptId}`
    );
    return { id: docRef.id, ...event };
  };

  const getEventByAttemptAndType = async (
    attemptId: string,
    eventType: CompetencyEventType
  ): Promise<CompetencyEvent | null> => {
    const snapshot = await db
      .collection(COLLECTIONS.EVENTS)
      .where('attemptId', '==', attemptId)
      .where('eventType', '==', eventType)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as CompetencyEvent;
  };

  const getEventsByTeacher = async (
    teacherId: string
  ): Promise<CompetencyEvent[]> => {
    const snapshot = await db
      .collection(COLLECTIONS.EVENTS)
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as CompetencyEvent)
    );
  };

  const getEventsByAttempt = async (
    attemptId: string
  ): Promise<CompetencyEvent[]> => {
    const snapshot = await db
      .collection(COLLECTIONS.EVENTS)
      .where('attemptId', '==', attemptId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as CompetencyEvent)
    );
  };

  // ============ Question Selection Helper ============
  const getQuestionsGroupedByDomain = async (
    assessmentId: string
  ): Promise<Map<string, CompetencyQuestion[]>> => {
    const questions = await getQuestions(assessmentId);
    const domainMap = new Map<string, CompetencyQuestion[]>();

    for (const question of questions) {
      const existing = domainMap.get(question.domainKey) || [];
      existing.push(question);
      domainMap.set(question.domainKey, existing);
    }

    return domainMap;
  };

  return {
    // Assessment
    getAssessment,
    getAssessmentById,
    createAssessment,
    // Questions
    getQuestions,
    getQuestionsByDomain,
    getQuestionById,
    importQuestions,
    getQuestionsGroupedByDomain,
    // Attempts
    createAttempt,
    getAttemptById,
    getActiveAttemptByTeacher,
    getAnyAttemptByTeacher,
    getAttemptsByTeacher,
    getAttemptsByStatus,
    updateAttempt,
    submitAttempt,
    // Results
    createResult,
    getResultByTeacherId,
    getResultByAttemptId,
    getAllResultsByTeacher,
    // Events (Audit Trail)
    createEvent,
    getEventByAttemptAndType,
    getEventsByTeacher,
    getEventsByAttempt,
  };
};

export type CompetencyRepository = ReturnType<
  typeof createCompetencyRepository
>;
