/**
 * PD Module Assessment Types
 * Implements Task 9: PD Module Assessment Backend
 */

/**
 * PD Module attempt status
 */
export type PdAttemptStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'PASSED'
  | 'FAILED';

/**
 * PD Question type
 */
export type PdQuestionType = 'MCQ' | 'SHORT_ANSWER' | 'AUDIO' | 'VIDEO';

/**
 * Represents a PD Module
 */
export interface PdModule {
  id: string;
  title: string;
  description: string;
  domainKey: string;
  order: number;
  passingScore: number; // Percentage required to pass
  maxAttempts: number;
  cooldownHours: number; // Hours before retry after max attempts
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Represents a question in a PD module assessment
 */
export interface PdQuestion {
  id: string;
  moduleId: string;
  attemptId?: string; // For AI-generated questions per attempt
  type: PdQuestionType;
  prompt: string;
  options?: string[]; // For MCQ
  correctOption?: string; // For MCQ
  maxScore: number;
  order: number;
  generatedByAi: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * Represents a teacher's answer to a PD question
 */
export interface PdQuestionAnswer {
  questionId: string;
  answer: string;
}

/**
 * Represents an evaluation result for a PD question
 */
export interface PdQuestionResult {
  questionId: string;
  type: PdQuestionType;
  score: number;
  maxScore: number;
  feedback?: string;
}

/**
 * Represents a teacher's attempt at a PD module assessment
 */
export interface PdAttempt {
  id: string;
  teacherId: string;
  moduleId: string;
  attemptNumber: number;
  status: PdAttemptStatus;
  responses: PdQuestionAnswer[];
  questionResults?: PdQuestionResult[];
  score?: number;
  passed?: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  submittedAt?: FirebaseFirestore.Timestamp;
  evaluatedAt?: FirebaseFirestore.Timestamp;
}

/**
 * PD event types for audit trail
 */
export type PdEventType =
  | 'ATTEMPT_STARTED'
  | 'RESPONSE_SAVED'
  | 'ATTEMPT_SUBMITTED'
  | 'ATTEMPT_EVALUATED'
  | 'MODULE_PASSED'
  | 'MODULE_FAILED'
  | 'MODULE_LOCKED';

/**
 * Represents a PD module event for audit trail
 */
export interface PdEvent {
  id: string;
  teacherId: string;
  moduleId: string;
  attemptId?: string;
  eventType: PdEventType;
  timestamp: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * API request for starting a PD attempt
 */
export interface StartPdAttemptRequest {
  moduleId: string;
}

/**
 * API request for saving responses
 */
export interface SaveResponsesRequest {
  responses: PdQuestionAnswer[];
}

/**
 * API response for PD module
 */
export interface PdModuleResponse {
  id: string;
  title: string;
  description: string;
  domainKey: string;
  passingScore: number;
  maxAttempts: number;
}

/**
 * API response for PD question
 */
export interface PdQuestionResponse {
  id: string;
  type: PdQuestionType;
  prompt: string;
  options?: string[];
  maxScore: number;
  order: number;
}

/**
 * API response for PD attempt
 */
export interface PdAttemptResponse {
  id: string;
  moduleId: string;
  attemptNumber: number;
  status: PdAttemptStatus;
  score?: number;
  passed?: boolean;
  createdAt: string;
  submittedAt?: string;
  evaluatedAt?: string;
}

/**
 * API response for PD attempt result
 */
export interface PdAttemptResultResponse {
  attemptId: string;
  moduleId: string;
  score: number;
  passed: boolean;
  questionResults: Array<{
    questionId: string;
    score: number;
    maxScore: number;
    feedback?: string;
  }>;
  evaluatedAt: string;
}
