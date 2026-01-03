/**
 * PD Module Repository
 * Data access layer for PD modules, questions, and attempts
 */

import { db } from '../config/firebase';
import {
  PdModule,
  PdQuestion,
  PdAttempt,
  PdEvent,
  PdAttemptStatus,
  PdQuestionAnswer,
  PdQuestionResult,
  PdEventType,
} from '../types/pdModule.types';
import { Timestamp } from 'firebase-admin/firestore';

// Collection names
const MODULES_COLLECTION = 'pdModules';
const QUESTIONS_COLLECTION = 'pdQuestions';
const ATTEMPTS_COLLECTION = 'pdAttempts';
const EVENTS_COLLECTION = 'pdEvents';

export interface PdModuleRepository {
  // Module methods
  getModuleById(moduleId: string): Promise<PdModule | null>;
  getActiveModules(): Promise<PdModule[]>;
  getModulesByDomain(domainKey: string): Promise<PdModule[]>;

  // Question methods
  getQuestionsByModule(moduleId: string): Promise<PdQuestion[]>;
  getQuestionsByAttempt(attemptId: string): Promise<PdQuestion[]>;
  createQuestion(question: Omit<PdQuestion, 'id' | 'createdAt'>): Promise<PdQuestion>;
  createQuestions(questions: Array<Omit<PdQuestion, 'id' | 'createdAt'>>): Promise<PdQuestion[]>;

  // Attempt methods
  createAttempt(
    teacherId: string,
    moduleId: string,
    attemptNumber: number
  ): Promise<PdAttempt>;
  getAttemptById(attemptId: string): Promise<PdAttempt | null>;
  getActiveAttempt(teacherId: string, moduleId: string): Promise<PdAttempt | null>;
  getAttemptsByTeacherAndModule(
    teacherId: string,
    moduleId: string
  ): Promise<PdAttempt[]>;
  getAttemptsByTeacher(teacherId: string): Promise<PdAttempt[]>;
  updateAttempt(attemptId: string, updates: Partial<PdAttempt>): Promise<void>;
  saveResponses(attemptId: string, responses: PdQuestionAnswer[]): Promise<void>;
  submitAttempt(attemptId: string, responses: PdQuestionAnswer[]): Promise<void>;
  evaluateAttempt(
    attemptId: string,
    questionResults: PdQuestionResult[],
    score: number,
    passed: boolean
  ): Promise<void>;
  getAttemptsByStatus(status: PdAttemptStatus, limit: number): Promise<PdAttempt[]>;

  // Event methods
  createEvent(
    teacherId: string,
    moduleId: string,
    eventType: PdEventType,
    attemptId?: string,
    metadata?: Record<string, unknown>
  ): Promise<PdEvent>;
}

export const createPdModuleRepository = (): PdModuleRepository => {
  return {
    // ============ Module Methods ============

    async getModuleById(moduleId: string): Promise<PdModule | null> {
      const doc = await db.collection(MODULES_COLLECTION).doc(moduleId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as PdModule;
    },

    async getActiveModules(): Promise<PdModule[]> {
      const snapshot = await db
        .collection(MODULES_COLLECTION)
        .where('active', '==', true)
        .orderBy('order', 'asc')
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PdModule)
      );
    },

    async getModulesByDomain(domainKey: string): Promise<PdModule[]> {
      const snapshot = await db
        .collection(MODULES_COLLECTION)
        .where('domainKey', '==', domainKey)
        .where('active', '==', true)
        .orderBy('order', 'asc')
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PdModule)
      );
    },

    // ============ Question Methods ============

    async getQuestionsByModule(moduleId: string): Promise<PdQuestion[]> {
      // Try cached questions (attemptId is null or 'cached')
      // Firestore doesn't handle null queries well, so we query without attemptId filter
      // and filter in memory
      const snapshot = await db
        .collection(QUESTIONS_COLLECTION)
        .where('moduleId', '==', moduleId)
        .orderBy('order', 'asc')
        .get();

      // Filter to only cached/template questions (no attemptId or null)
      return snapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return !data.attemptId || data.attemptId === null || data.attemptId === 'cached';
        })
        .map((doc) => ({ id: doc.id, ...doc.data() } as PdQuestion));
    },

    async getQuestionsByAttempt(attemptId: string): Promise<PdQuestion[]> {
      const snapshot = await db
        .collection(QUESTIONS_COLLECTION)
        .where('attemptId', '==', attemptId)
        .orderBy('order', 'asc')
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PdQuestion)
      );
    },

    async createQuestion(
      question: Omit<PdQuestion, 'id' | 'createdAt'>
    ): Promise<PdQuestion> {
      const now = Timestamp.now();
      const docRef = db.collection(QUESTIONS_COLLECTION).doc();

      const questionData = {
        ...question,
        createdAt: now,
      };

      await docRef.set(questionData);

      return {
        id: docRef.id,
        ...questionData,
      };
    },

    async createQuestions(
      questions: Array<Omit<PdQuestion, 'id' | 'createdAt'>>
    ): Promise<PdQuestion[]> {
      const now = Timestamp.now();
      const batch = db.batch();
      const createdQuestions: PdQuestion[] = [];

      for (const question of questions) {
        const docRef = db.collection(QUESTIONS_COLLECTION).doc();
        const questionData = {
          ...question,
          createdAt: now,
        };
        batch.set(docRef, questionData);
        createdQuestions.push({
          id: docRef.id,
          ...questionData,
        });
      }

      await batch.commit();
      return createdQuestions;
    },

    // ============ Attempt Methods ============

    async createAttempt(
      teacherId: string,
      moduleId: string,
      attemptNumber: number
    ): Promise<PdAttempt> {
      const now = Timestamp.now();
      const docRef = db.collection(ATTEMPTS_COLLECTION).doc();

      const attempt: Omit<PdAttempt, 'id'> = {
        teacherId,
        moduleId,
        attemptNumber,
        status: 'IN_PROGRESS' as PdAttemptStatus,
        responses: [],
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(attempt);

      return {
        id: docRef.id,
        ...attempt,
      };
    },

    async getAttemptById(attemptId: string): Promise<PdAttempt | null> {
      const doc = await db.collection(ATTEMPTS_COLLECTION).doc(attemptId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as PdAttempt;
    },

    async getActiveAttempt(
      teacherId: string,
      moduleId: string
    ): Promise<PdAttempt | null> {
      // Only return IN_PROGRESS attempts - SUBMITTED attempts should not be resumed
      const snapshot = await db
        .collection(ATTEMPTS_COLLECTION)
        .where('teacherId', '==', teacherId)
        .where('moduleId', '==', moduleId)
        .where('status', '==', 'IN_PROGRESS')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as PdAttempt;
    },

    async getAttemptsByTeacherAndModule(
      teacherId: string,
      moduleId: string
    ): Promise<PdAttempt[]> {
      const snapshot = await db
        .collection(ATTEMPTS_COLLECTION)
        .where('teacherId', '==', teacherId)
        .where('moduleId', '==', moduleId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PdAttempt)
      );
    },

    async getAttemptsByTeacher(teacherId: string): Promise<PdAttempt[]> {
      const snapshot = await db
        .collection(ATTEMPTS_COLLECTION)
        .where('teacherId', '==', teacherId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PdAttempt)
      );
    },

    async updateAttempt(
      attemptId: string,
      updates: Partial<PdAttempt>
    ): Promise<void> {
      await db
        .collection(ATTEMPTS_COLLECTION)
        .doc(attemptId)
        .update({
          ...updates,
          updatedAt: Timestamp.now(),
        });
    },

    async saveResponses(
      attemptId: string,
      responses: PdQuestionAnswer[]
    ): Promise<void> {
      await db.collection(ATTEMPTS_COLLECTION).doc(attemptId).update({
        responses,
        updatedAt: Timestamp.now(),
      });
    },

    async submitAttempt(
      attemptId: string,
      responses: PdQuestionAnswer[]
    ): Promise<void> {
      await db.collection(ATTEMPTS_COLLECTION).doc(attemptId).update({
        responses,
        status: 'SUBMITTED' as PdAttemptStatus,
        submittedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    },

    async evaluateAttempt(
      attemptId: string,
      questionResults: PdQuestionResult[],
      score: number,
      passed: boolean
    ): Promise<void> {
      await db.collection(ATTEMPTS_COLLECTION).doc(attemptId).update({
        questionResults,
        score,
        passed,
        status: (passed ? 'PASSED' : 'FAILED') as PdAttemptStatus,
        evaluatedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    },

    async getAttemptsByStatus(
      status: PdAttemptStatus,
      limit: number
    ): Promise<PdAttempt[]> {
      const snapshot = await db
        .collection(ATTEMPTS_COLLECTION)
        .where('status', '==', status)
        .orderBy('submittedAt', 'asc')
        .limit(limit)
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PdAttempt)
      );
    },

    // ============ Event Methods ============

    async createEvent(
      teacherId: string,
      moduleId: string,
      eventType: PdEventType,
      attemptId?: string,
      metadata?: Record<string, unknown>
    ): Promise<PdEvent> {
      const now = Timestamp.now();
      const docRef = db.collection(EVENTS_COLLECTION).doc();

      // Build event object, excluding undefined values (Firestore doesn't accept undefined)
      const event: Omit<PdEvent, 'id'> = {
        teacherId,
        moduleId,
        eventType,
        timestamp: now,
        ...(attemptId !== undefined && { attemptId }),
        ...(metadata !== undefined && { metadata }),
      };

      await docRef.set(event);

      return {
        id: docRef.id,
        ...event,
      };
    },
  };
};

// Export singleton instance
export const pdModuleRepository = createPdModuleRepository();
