/**
 * AI Tutor Repository
 * Data access layer for tutor sessions, messages, and learning paths
 */

import { db } from '../config/firebase';
import {
  AiTutorSession,
  AiTutorMessage,
  LearningPath,
  TutorEvent,
  TutorSessionStatus,
  LearningPathStatus,
  TutorEventType,
  LearningPathModule,
} from '../types/tutor.types';
import { Timestamp } from 'firebase-admin/firestore';

// Collection names
const SESSIONS_COLLECTION = 'aiTutorSessions';
const MESSAGES_COLLECTION = 'aiTutorMessages';
const LEARNING_PATHS_COLLECTION = 'learningPaths';
const TUTOR_EVENTS_COLLECTION = 'tutorEvents';

export interface TutorRepository {
  // Session methods
  createSession(teacherId: string): Promise<AiTutorSession>;
  getSessionById(sessionId: string): Promise<AiTutorSession | null>;
  getActiveSession(teacherId: string): Promise<AiTutorSession | null>;
  endSession(sessionId: string): Promise<void>;
  getSessionsByTeacher(teacherId: string): Promise<AiTutorSession[]>;

  // Message methods
  createMessage(
    sessionId: string,
    sender: 'teacher' | 'ai',
    message: string
  ): Promise<AiTutorMessage>;
  getMessagesBySession(sessionId: string): Promise<AiTutorMessage[]>;

  // Learning path methods
  createLearningPath(
    teacherId: string,
    modules: LearningPathModule[],
    resultId?: string
  ): Promise<LearningPath>;
  getLearningPathByTeacher(teacherId: string): Promise<LearningPath | null>;
  updateLearningPath(
    pathId: string,
    updates: Partial<LearningPath>
  ): Promise<void>;
  unlockNextModule(pathId: string): Promise<LearningPath | null>;
  completeModule(pathId: string, moduleId: string): Promise<void>;

  // Event methods
  createEvent(
    teacherId: string,
    eventType: TutorEventType,
    metadata?: Record<string, unknown>
  ): Promise<TutorEvent>;
}

export const createTutorRepository = (): TutorRepository => {
  return {
    // ============ Session Methods ============

    async createSession(teacherId: string): Promise<AiTutorSession> {
      const now = Timestamp.now();
      const docRef = db.collection(SESSIONS_COLLECTION).doc();

      const session: Omit<AiTutorSession, 'id'> = {
        teacherId,
        status: 'active' as TutorSessionStatus,
        startedAt: now,
      };

      await docRef.set(session);

      return {
        id: docRef.id,
        ...session,
      };
    },

    async getSessionById(sessionId: string): Promise<AiTutorSession | null> {
      const doc = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as AiTutorSession;
    },

    async getActiveSession(teacherId: string): Promise<AiTutorSession | null> {
      const snapshot = await db
        .collection(SESSIONS_COLLECTION)
        .where('teacherId', '==', teacherId)
        .where('status', '==', 'active')
        .orderBy('startedAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as AiTutorSession;
    },

    async endSession(sessionId: string): Promise<void> {
      await db.collection(SESSIONS_COLLECTION).doc(sessionId).update({
        status: 'ended' as TutorSessionStatus,
        endedAt: Timestamp.now(),
      });
    },

    async getSessionsByTeacher(teacherId: string): Promise<AiTutorSession[]> {
      const snapshot = await db
        .collection(SESSIONS_COLLECTION)
        .where('teacherId', '==', teacherId)
        .orderBy('startedAt', 'desc')
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as AiTutorSession)
      );
    },

    // ============ Message Methods ============

    async createMessage(
      sessionId: string,
      sender: 'teacher' | 'ai',
      message: string
    ): Promise<AiTutorMessage> {
      const now = Timestamp.now();
      const docRef = db.collection(MESSAGES_COLLECTION).doc();

      const msg: Omit<AiTutorMessage, 'id'> = {
        sessionId,
        sender,
        message,
        timestamp: now,
      };

      await docRef.set(msg);

      return {
        id: docRef.id,
        ...msg,
      };
    },

    async getMessagesBySession(sessionId: string): Promise<AiTutorMessage[]> {
      const snapshot = await db
        .collection(MESSAGES_COLLECTION)
        .where('sessionId', '==', sessionId)
        .orderBy('timestamp', 'asc')
        .get();

      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as AiTutorMessage)
      );
    },

    // ============ Learning Path Methods ============

    async createLearningPath(
      teacherId: string,
      modules: LearningPathModule[],
      resultId?: string
    ): Promise<LearningPath> {
      const now = Timestamp.now();
      const docRef = db.collection(LEARNING_PATHS_COLLECTION).doc();

      const path: Omit<LearningPath, 'id'> = {
        teacherId,
        modules,
        currentModuleIndex: 0,
        status: 'active' as LearningPathStatus,
        resultId,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(path);

      return {
        id: docRef.id,
        ...path,
      };
    },

    async getLearningPathByTeacher(
      teacherId: string
    ): Promise<LearningPath | null> {
      const snapshot = await db
        .collection(LEARNING_PATHS_COLLECTION)
        .where('teacherId', '==', teacherId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as LearningPath;
    },

    async updateLearningPath(
      pathId: string,
      updates: Partial<LearningPath>
    ): Promise<void> {
      await db
        .collection(LEARNING_PATHS_COLLECTION)
        .doc(pathId)
        .update({
          ...updates,
          updatedAt: Timestamp.now(),
        });
    },

    async unlockNextModule(pathId: string): Promise<LearningPath | null> {
      const pathDoc = await db
        .collection(LEARNING_PATHS_COLLECTION)
        .doc(pathId)
        .get();
      if (!pathDoc.exists) return null;

      const path = { id: pathDoc.id, ...pathDoc.data() } as LearningPath;
      const nextIndex = path.currentModuleIndex + 1;

      if (nextIndex >= path.modules.length) {
        // All modules completed
        await db.collection(LEARNING_PATHS_COLLECTION).doc(pathId).update({
          status: 'completed' as LearningPathStatus,
          updatedAt: Timestamp.now(),
        });
        path.status = 'completed';
        return path;
      }

      // Unlock next module
      const updatedModules = [...path.modules];
      updatedModules[nextIndex].status = 'unlocked';

      await db.collection(LEARNING_PATHS_COLLECTION).doc(pathId).update({
        modules: updatedModules,
        currentModuleIndex: nextIndex,
        updatedAt: Timestamp.now(),
      });

      path.modules = updatedModules;
      path.currentModuleIndex = nextIndex;
      return path;
    },

    async completeModule(pathId: string, moduleId: string): Promise<void> {
      const pathDoc = await db
        .collection(LEARNING_PATHS_COLLECTION)
        .doc(pathId)
        .get();
      if (!pathDoc.exists) return;

      const path = pathDoc.data() as LearningPath;
      const updatedModules = path.modules.map((m) =>
        m.moduleId === moduleId
          ? { ...m, status: 'completed' as const, completedAt: Timestamp.now() }
          : m
      );

      await db.collection(LEARNING_PATHS_COLLECTION).doc(pathId).update({
        modules: updatedModules,
        updatedAt: Timestamp.now(),
      });
    },

    // ============ Event Methods ============

    async createEvent(
      teacherId: string,
      eventType: TutorEventType,
      metadata?: Record<string, unknown>
    ): Promise<TutorEvent> {
      const now = Timestamp.now();
      const docRef = db.collection(TUTOR_EVENTS_COLLECTION).doc();

      const event: Omit<TutorEvent, 'id'> = {
        teacherId,
        eventType,
        timestamp: now,
        metadata,
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
export const tutorRepository = createTutorRepository();
