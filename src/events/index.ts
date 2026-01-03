import { appEventEmitter } from './emitter';
import { EventType } from './types';
import { handleCompetencyAssessmentEvaluated } from './handlers/competency.handlers';
import { logger } from '../utils/logger';

export function registerEventHandlers(): void {
  logger.info('Registering application event handlers');

  appEventEmitter.on(
    EventType.COMPETENCY_ASSESSMENT_EVALUATED,
    handleCompetencyAssessmentEvaluated
  );

  logger.info('All event handlers registered successfully');
}

export { appEventEmitter, EventType };
export type { CompetencyAssessmentEvaluatedEvent } from './types';
