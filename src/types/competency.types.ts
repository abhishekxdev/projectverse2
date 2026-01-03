/**
 * Supported question types for competency assessment.
 */
export type QuestionType = 'MCQ' | 'SHORT_ANSWER' | 'AUDIO' | 'VIDEO';

export interface GroupedCompetencyQuestions {
  MCQ: CompetencyQuestion[];
  SHORT_ANSWER: CompetencyQuestion[];
  AUDIO: CompetencyQuestion[];
  VIDEO: CompetencyQuestion[];
}

/**
 * Attempt status for competency assessment.
 */
export type AttemptStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'FAILED';

/**
 * Competency event types for audit trail.
 */
export type CompetencyEventType = 'SUBMIT' | 'EVALUATED';

/**
 * Represents a competency event for audit trail.
 */
export interface CompetencyEvent {
  id: string;
  teacherId: string;
  attemptId: string;
  eventType: CompetencyEventType;
  createdAt: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * Selected question for a teacher's attempt (for randomization).
 */
export interface SelectedQuestion {
  questionId: string;
  order: number;
}

/**
 * Proficiency level based on overall score.
 * Bands: 0-39% Beginner, 40-59% Developing, 60-79% Proficient, 80-100% Advanced
 */
export type ProficiencyLevel =
  | 'Beginner'
  | 'Developing'
  | 'Proficient'
  | 'Advanced';

/**
 * Represents the competency assessment metadata (single Firestore document).
 */
export interface CompetencyAssessment {
  id: string;
  title: string;
  description: string;
  active: boolean;
}

/**
 * Represents a question in the competency assessment (Firestore collection item).
 */
export interface CompetencyQuestion {
  id: string;
  assessmentId: string;
  domainKey: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // Only for MCQ
  correctOption?: string; // Only for MCQ
  maxScore: number;
  order: number;
}

/**
 * Represents a teacher's answer to a single question.
 */
export interface QuestionAnswer {
  questionId: string;
  answer: string; // Selected option for MCQ, text for SHORT_ANSWER, URL for AUDIO/VIDEO
}

/**
 * Represents a teacher's attempt at the competency assessment.
 */
export interface TeacherCompetencyAttempt {
  id: string;
  teacherId: string;
  assessmentId: string;
  answers: QuestionAnswer[];
  status: AttemptStatus;
  /** Selected/randomized questions for this attempt */
  selectedQuestions?: SelectedQuestion[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  submittedAt?: FirebaseFirestore.Timestamp;
  evaluatedAt?: FirebaseFirestore.Timestamp;
  retryCount?: number;
}

/**
 * Represents a domain score within the evaluation result.
 */
export interface DomainScore {
  domainKey: string;
  rawScore: number;
  maxScore: number;
  scorePercent: number;
}

/**
 * Per-question evaluation result.
 */
export interface QuestionEvaluationResult {
  questionId: string;
  domainKey: string;
  type: QuestionType;
  score: number;
  maxScore: number;
  feedback?: string;
}

/**
 * Represents the evaluation result for a teacher's competency assessment.
 */
export interface TeacherCompetencyResult {
  id: string;
  teacherId: string;
  attemptId: string;
  assessmentId: string;
  overallScore: number;
  proficiencyLevel: ProficiencyLevel;
  domainScores: DomainScore[];
  strengthDomains: string[];
  gapDomains: string[];
  recommendedMicroPDs: string[];
  questionResults: QuestionEvaluationResult[];
  rawFeedback: string;
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * Mapping of domain keys to recommended Micro PD IDs.
 */
export interface DomainMicroPDMapping {
  [domainKey: string]: string[];
}

/**
 * API response structure for fetching competency questions.
 */
export interface CompetencyQuestionsResponse {
  assessment: CompetencyAssessment;
  questions: CompetencyQuestion[];
}

/**
 * API response structure for competency result.
 */
export interface CompetencyResultResponse {
  teacherId: string;
  overallScore: number;
  proficiencyLevel: ProficiencyLevel;
  domainScores: Array<{
    domainKey: string;
    scorePercent: number;
  }>;
  strengthDomains: string[];
  gapDomains: string[];
  recommendedMicroPDs: string[];
  rawFeedback: string;
  createdAt: string;
}
