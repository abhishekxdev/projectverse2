/**
 * AI Tutor Prompt Templates
 * Provides system prompts and context for AI tutor conversations
 */

import { TeacherCompetencyResult } from '../types/competency.types';
import { LearningPath } from '../types/tutor.types';

/**
 * System prompt for AI Tutor
 */
export const TUTOR_SYSTEM_PROMPT = `You are an expert AI teaching assistant specialized in helping teachers improve their teaching skills. Your role is to:

1. Provide guidance and support for professional development
2. Answer questions about teaching methodologies and best practices
3. Help teachers understand and address their competency gaps
4. Offer practical strategies for classroom improvement
5. Be encouraging and supportive while providing constructive feedback

Guidelines:
- Keep responses concise but helpful (under 200 words when possible)
- Use practical examples when explaining concepts
- Reference the teacher's specific areas for improvement when relevant
- Suggest actionable steps they can take
- Be positive and encouraging
- When discussing assessment results, focus on growth opportunities, not deficiencies

Remember: You are here to help teachers grow and become more effective educators.`;

/**
 * Build context prompt based on teacher's competency result and learning path
 */
export const getTutorContextPrompt = (
  competencyResult: TeacherCompetencyResult | null,
  learningPath: LearningPath | null
): string => {
  let contextParts: string[] = [];

  if (competencyResult) {
    contextParts.push(`
TEACHER CONTEXT:
- Overall Proficiency Level: ${competencyResult.proficiencyLevel}
- Overall Score: ${competencyResult.overallScore}%
- Strength Areas: ${competencyResult.strengthDomains.join(', ') || 'None identified yet'}
- Areas for Improvement: ${competencyResult.gapDomains.join(', ') || 'None identified yet'}
`);

    if (competencyResult.domainScores && competencyResult.domainScores.length > 0) {
      const domainDetails = competencyResult.domainScores
        .map((d) => `  - ${d.domainKey}: ${d.scorePercent.toFixed(0)}%`)
        .join('\n');
      contextParts.push(`Domain Scores:\n${domainDetails}`);
    }
  }

  if (learningPath && learningPath.modules.length > 0) {
    const currentModule = learningPath.modules[learningPath.currentModuleIndex];
    const completedCount = learningPath.modules.filter(
      (m) => m.status === 'completed'
    ).length;

    contextParts.push(`
LEARNING PATH:
- Total Modules: ${learningPath.modules.length}
- Completed: ${completedCount}
- Current Module: ${currentModule?.title || 'None'}
- Progress: ${((completedCount / learningPath.modules.length) * 100).toFixed(0)}%
`);
  }

  if (contextParts.length === 0) {
    return 'This teacher has not yet completed their competency assessment.';
  }

  return contextParts.join('\n');
};

/**
 * Prompt for generating module-specific guidance
 */
export const getModuleGuidancePrompt = (
  moduleName: string,
  domainKey: string,
  teacherQuestion: string
): string => {
  return `
The teacher is currently working on the "${moduleName}" module in the ${domainKey} domain.

They asked: "${teacherQuestion}"

Provide specific, practical guidance related to this module and their question. Include:
1. A direct answer to their question
2. One or two practical strategies they can implement
3. An encouraging note about their progress
`;
};

/**
 * Prompt for session summary
 */
export const getSessionSummaryPrompt = (
  messageCount: number,
  topics: string[]
): string => {
  return `
Summarize this tutoring session briefly:
- Number of exchanges: ${messageCount}
- Topics discussed: ${topics.join(', ')}

Provide:
1. Key takeaways (2-3 bullet points)
2. Suggested next steps for the teacher
3. Encouraging closing message
`;
};
