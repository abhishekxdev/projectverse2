/**
 * AI Tutor Types
 * Implements Task 8: AI Tutor Backend
 */

/**
 * AI Tutor session status
 */
export type TutorSessionStatus = 'active' | 'ended';

/**
 * Message sender type
 */
export type MessageSender = 'teacher' | 'ai';

/**
 * Learning path status
 */
export type LearningPathStatus = 'preview' | 'active' | 'completed';

/**
 * Module status within a learning path
 */
export type ModuleStatus = 'locked' | 'unlocked' | 'completed';

/**
 * Represents an AI Tutor session
 */
export interface AiTutorSession {
  id: string;
  teacherId: string;
  status: TutorSessionStatus;
  startedAt: FirebaseFirestore.Timestamp;
  endedAt?: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * Represents a message in an AI Tutor session
 */
export interface AiTutorMessage {
  id: string;
  sessionId: string;
  sender: MessageSender;
  message: string;
  timestamp: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * Represents a module within a learning path
 */
export interface LearningPathModule {
  moduleId: string;
  title: string;
  domainKey: string;
  status: ModuleStatus;
  order: number;
  completedAt?: FirebaseFirestore.Timestamp;
}

/**
 * Represents a teacher's personalized learning path
 */
export interface LearningPath {
  id: string;
  teacherId: string;
  modules: LearningPathModule[];
  currentModuleIndex: number;
  status: LearningPathStatus;
  resultId?: string; // Link to competency result
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Tutor event types for audit trail
 */
export type TutorEventType =
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'MESSAGE_SENT'
  | 'LEARNING_PATH_CREATED'
  | 'LEARNING_PATH_UPDATED'
  | 'MODULE_UNLOCKED'
  | 'MODULE_COMPLETED';

/**
 * Represents a tutor event for audit trail
 */
export interface TutorEvent {
  id: string;
  teacherId: string;
  eventType: TutorEventType;
  timestamp: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * API request for starting a session
 */
export interface StartSessionRequest {
  competencyResultId?: string;
}

/**
 * API request for sending a message
 */
export interface SendMessageRequest {
  message: string;
}

/**
 * API response for session
 */
export interface SessionResponse {
  id: string;
  teacherId: string;
  status: TutorSessionStatus;
  startedAt: string;
  endedAt?: string;
}

/**
 * API response for message
 */
export interface MessageResponse {
  id: string;
  sessionId: string;
  sender: MessageSender;
  message: string;
  timestamp: string;
}

/**
 * API response for learning path
 */
export interface LearningPathResponse {
  id: string;
  teacherId: string;
  modules: Array<{
    moduleId: string;
    title: string;
    domainKey: string;
    status: ModuleStatus;
    order: number;
    completedAt?: string;
  }>;
  currentModuleIndex: number;
  status: LearningPathStatus;
  createdAt: string;
}
