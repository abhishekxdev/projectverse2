import { logger } from '../../utils/logger';
import { tutorService } from '../../services/tutor.service';
import { CompetencyAssessmentEvaluatedEvent } from '../types';

export async function handleCompetencyAssessmentEvaluated(
  event: CompetencyAssessmentEvaluatedEvent
): Promise<void> {
  const { teacherId, resultId, gapDomains, attemptId } = event;

  if (!gapDomains || gapDomains.length === 0) {
    logger.info(
      'No gap domains found, skipping learning path generation',
      {
        teacherId,
        resultId,
        attemptId,
      }
    );
    return;
  }

  try {
    logger.info('Auto-generating learning path from competency result', {
      teacherId,
      resultId,
      gapDomains,
      attemptId,
    });

    await tutorService.generateLearningPath(teacherId, resultId);

    logger.info('Learning path auto-generated successfully', {
      teacherId,
      resultId,
      attemptId,
    });
  } catch (err) {
    logger.error(
      'Failed to auto-generate learning path',
      err instanceof Error ? err : undefined,
      {
        teacherId,
        resultId,
        attemptId,
        error: err instanceof Error ? err.message : String(err),
      }
    );
  }
}
