export enum EventType {
  COMPETENCY_ASSESSMENT_EVALUATED = 'competency.assessment.evaluated',
}

export interface CompetencyAssessmentEvaluatedEvent {
  teacherId: string;
  attemptId: string;
  resultId: string;
  assessmentId: string;
  overallScore: number;
  proficiencyLevel: string;
  gapDomains: string[];
  strengthDomains: string[];
  timestamp: Date;
}

export type EventPayload = {
  [EventType.COMPETENCY_ASSESSMENT_EVALUATED]: CompetencyAssessmentEvaluatedEvent;
};
