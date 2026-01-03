import { generateText } from 'ai';
import { client } from '../config/openai';
import {
  createPdModuleRepository,
  PdModuleRepository,
} from '../repositories/pdModuleRepository';
import { PdModule, PdQuestion, PdQuestionType } from '../types/pdModule.types';
import { NotFoundError } from '../utils/error';
import { logger } from '../utils/logger';

const getModel = () => client('gpt-4o-mini');
const DEFAULT_QUESTIONS_COUNT = 5;

export interface GenerateQuestionsOptions {
  moduleId: string;
  attemptId?: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionTypes?: PdQuestionType[];
}

export class AiQuestionGeneratorService {
  private repo: PdModuleRepository;

  constructor(repo?: PdModuleRepository) {
    this.repo = repo || createPdModuleRepository();
  }

  async generateQuestions(
    options: GenerateQuestionsOptions
  ): Promise<PdQuestion[]> {
    const {
      moduleId,
      attemptId,
      count = DEFAULT_QUESTIONS_COUNT,
      difficulty,
      questionTypes,
    } = options;

    const module = await this.repo.getModuleById(moduleId);
    if (!module) {
      throw new NotFoundError('Module not found');
    }

    try {
      const prompt = this.buildQuestionGenerationPrompt(
        module,
        count,
        difficulty,
        questionTypes
      );
      const { text } = await generateText({
        model: getModel() as unknown as Parameters<
          typeof generateText
        >[0]['model'],
        system:
          'You are an expert educator creating assessment questions for professional development modules.',
        prompt,
        temperature: 0.7,
        maxTokens: 2000,
      });

      const questions = this.parseGeneratedQuestions(
        text,
        moduleId,
        attemptId
      );

      const savedQuestions = await this.repo.createQuestions(questions);
      return savedQuestions;
    } catch (err) {
      logger.error(
        'Failed to generate AI questions, using fallback',
        err instanceof Error ? err : undefined,
        { moduleId }
      );

      const cached = await this.repo.getQuestionsByModule(moduleId);
      if (cached.length > 0) {
        const attemptQuestions = cached.slice(0, count).map((q, idx) => ({
          moduleId: q.moduleId,
          attemptId,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctOption: q.correctOption,
          maxScore: q.maxScore,
          order: idx + 1,
          generatedByAi: false,
        }));
        return this.repo.createQuestions(attemptQuestions);
      }

      throw new Error('Failed to generate questions and no fallback available');
    }
  }

  private buildQuestionGenerationPrompt(
    module: PdModule,
    count: number,
    difficulty?: string,
    questionTypes?: PdQuestionType[]
  ): string {
    const difficultyText = difficulty ? `Difficulty level: ${difficulty}\n` : '';
    const typesText = questionTypes?.length
      ? `Focus on question types: ${questionTypes.join(', ')}\n`
      : '';

    return `
Generate ${count} assessment questions for a professional development module:

Module: ${module.title}
Domain: ${module.domainKey}
Description: ${module.description}
${difficultyText}${typesText}
Create a mix of question types:
- 3 multiple choice questions (MCQ) with 4 options
- 2 short answer questions

Format as JSON array:
[
  {
    "type": "MCQ",
    "prompt": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctOption": "A",
    "maxScore": 1
  },
  {
    "type": "SHORT_ANSWER",
    "prompt": "Question text",
    "maxScore": 5
  }
]

Questions should assess practical understanding of the module content.
`;
  }

  private parseGeneratedQuestions(
    text: string,
    moduleId: string,
    attemptId?: string
  ): Array<Omit<PdQuestion, 'id' | 'createdAt'>> {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((q: Record<string, unknown>, idx: number) => ({
        moduleId,
        attemptId,
        type: q.type as PdQuestionType,
        prompt: String(q.prompt),
        options: Array.isArray(q.options) ? q.options : undefined,
        correctOption: q.correctOption ? String(q.correctOption) : undefined,
        maxScore: Number(q.maxScore) || 1,
        order: idx + 1,
        generatedByAi: true,
      }));
    } catch (err) {
      logger.error(
        'Failed to parse generated questions',
        err instanceof Error ? err : undefined
      );
      throw new Error('Failed to parse AI-generated questions');
    }
  }
}

export const aiQuestionGeneratorService = new AiQuestionGeneratorService();
