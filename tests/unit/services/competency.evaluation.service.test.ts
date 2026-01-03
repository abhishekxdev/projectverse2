/**
 * Unit tests for competency evaluation service
 */

import { competencyEvaluationEngine } from '../../../src/services/competency.evaluation.service';
import {
  CompetencyQuestion,
  QuestionAnswer,
} from '../../../src/types/competency.types';
import {
  COMPETENCY_DOMAINS,
  COMPETENCY_QUESTION_TYPES,
} from '../../../src/config/constants';

// Mock the OpenAI client
jest.mock('../../../src/config/openai', () => ({
  client: jest.fn(() => ({})),
}));

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: JSON.stringify({ score: 4, feedback: 'Good response.' }),
  }),
}));

describe('competencyEvaluationEngine', () => {
  describe('evaluateMCQ', () => {
    const mcqQuestion: CompetencyQuestion = {
      id: 'q1',
      assessmentId: 'test-assessment',
      domainKey: COMPETENCY_DOMAINS.PLANNING,
      type: 'MCQ',
      prompt: 'What is the first step in lesson planning?',
      options: [
        'Set objectives',
        'Choose resources',
        'Assess students',
        'Design activities',
      ],
      correctOption: 'Set objectives',
      maxScore: 1,
      order: 1,
    };

    it('should score correct MCQ answer with full marks', () => {
      const answer: QuestionAnswer = {
        questionId: 'q1',
        answer: 'Set objectives',
      };

      const result = competencyEvaluationEngine.evaluateMCQ(
        mcqQuestion,
        answer
      );

      expect(result.score).toBe(1);
      expect(result.maxScore).toBe(1);
      expect(result.feedback).toContain('Correct');
    });

    it('should score incorrect MCQ answer with zero', () => {
      const answer: QuestionAnswer = {
        questionId: 'q1',
        answer: 'Choose resources',
      };

      const result = competencyEvaluationEngine.evaluateMCQ(
        mcqQuestion,
        answer
      );

      expect(result.score).toBe(0);
      expect(result.maxScore).toBe(1);
      expect(result.feedback).toContain('Incorrect');
    });

    it('should handle case-insensitive matching', () => {
      const answer: QuestionAnswer = {
        questionId: 'q1',
        answer: 'set objectives',
      };

      const result = competencyEvaluationEngine.evaluateMCQ(
        mcqQuestion,
        answer
      );

      expect(result.score).toBe(1);
    });
  });

  describe('calculateDomainScores', () => {
    it('should aggregate scores by domain correctly', () => {
      const questionResults = [
        {
          questionId: 'q1',
          domainKey: 'planning',
          type: 'MCQ' as const,
          score: 1,
          maxScore: 1,
        },
        {
          questionId: 'q2',
          domainKey: 'planning',
          type: 'SHORT_ANSWER' as const,
          score: 3,
          maxScore: 5,
        },
        {
          questionId: 'q3',
          domainKey: 'pedagogy',
          type: 'MCQ' as const,
          score: 1,
          maxScore: 1,
        },
      ];

      const domainScores =
        competencyEvaluationEngine.calculateDomainScores(questionResults);

      expect(domainScores).toHaveLength(2);

      const planningDomain = domainScores.find(
        (d) => d.domainKey === 'planning'
      );
      expect(planningDomain).toBeDefined();
      expect(planningDomain!.rawScore).toBe(4);
      expect(planningDomain!.maxScore).toBe(6);
      expect(planningDomain!.scorePercent).toBeCloseTo(66.67, 1);

      const pedagogyDomain = domainScores.find(
        (d) => d.domainKey === 'pedagogy'
      );
      expect(pedagogyDomain).toBeDefined();
      expect(pedagogyDomain!.scorePercent).toBe(100);
    });
  });

  describe('determineProficiencyLevel', () => {
    it('should return Expert for 90% and above', () => {
      expect(competencyEvaluationEngine.determineProficiencyLevel(95)).toBe(
        'Expert'
      );
      expect(competencyEvaluationEngine.determineProficiencyLevel(90)).toBe(
        'Expert'
      );
    });

    it('should return Proficient for 70-89%', () => {
      expect(competencyEvaluationEngine.determineProficiencyLevel(85)).toBe(
        'Proficient'
      );
      expect(competencyEvaluationEngine.determineProficiencyLevel(70)).toBe(
        'Proficient'
      );
    });

    it('should return Developing for 50-69%', () => {
      expect(competencyEvaluationEngine.determineProficiencyLevel(60)).toBe(
        'Developing'
      );
      expect(competencyEvaluationEngine.determineProficiencyLevel(50)).toBe(
        'Developing'
      );
    });

    it('should return Beginner for below 50%', () => {
      expect(competencyEvaluationEngine.determineProficiencyLevel(40)).toBe(
        'Beginner'
      );
      expect(competencyEvaluationEngine.determineProficiencyLevel(0)).toBe(
        'Beginner'
      );
    });
  });

  describe('categorizeDomainsBy90Rule', () => {
    it('should categorize domains as strength when >= 90%', () => {
      const domainScores = [
        { domainKey: 'planning', rawScore: 9, maxScore: 10, scorePercent: 90 },
        { domainKey: 'pedagogy', rawScore: 8, maxScore: 10, scorePercent: 80 },
        {
          domainKey: 'assessment',
          rawScore: 10,
          maxScore: 10,
          scorePercent: 100,
        },
      ];

      const { strengthDomains, gapDomains } =
        competencyEvaluationEngine.categorizeDomainsBy90Rule(domainScores);

      expect(strengthDomains).toContain('planning');
      expect(strengthDomains).toContain('assessment');
      expect(strengthDomains).not.toContain('pedagogy');

      expect(gapDomains).toContain('pedagogy');
      expect(gapDomains).not.toContain('planning');
    });

    it('should handle all strengths', () => {
      const domainScores = [
        { domainKey: 'planning', rawScore: 9, maxScore: 10, scorePercent: 90 },
        {
          domainKey: 'pedagogy',
          rawScore: 10,
          maxScore: 10,
          scorePercent: 100,
        },
      ];

      const { strengthDomains, gapDomains } =
        competencyEvaluationEngine.categorizeDomainsBy90Rule(domainScores);

      expect(strengthDomains).toHaveLength(2);
      expect(gapDomains).toHaveLength(0);
    });

    it('should handle all gaps', () => {
      const domainScores = [
        { domainKey: 'planning', rawScore: 5, maxScore: 10, scorePercent: 50 },
        { domainKey: 'pedagogy', rawScore: 6, maxScore: 10, scorePercent: 60 },
      ];

      const { strengthDomains, gapDomains } =
        competencyEvaluationEngine.categorizeDomainsBy90Rule(domainScores);

      expect(strengthDomains).toHaveLength(0);
      expect(gapDomains).toHaveLength(2);
    });
  });

  describe('getRecommendedMicroPDs', () => {
    it('should return recommended Micro PDs for gap domains', () => {
      const gapDomains = ['planning', 'pedagogy'];

      const recommendations =
        competencyEvaluationEngine.getRecommendedMicroPDs(gapDomains);

      expect(recommendations).toContain('micro-pd-planning-1');
      expect(recommendations).toContain('micro-pd-planning-2');
      expect(recommendations).toContain('micro-pd-pedagogy-1');
      expect(recommendations).toContain('micro-pd-pedagogy-2');
    });

    it('should return empty array for no gaps', () => {
      const gapDomains: string[] = [];

      const recommendations =
        competencyEvaluationEngine.getRecommendedMicroPDs(gapDomains);

      expect(recommendations).toHaveLength(0);
    });

    it('should handle unknown domains gracefully', () => {
      const gapDomains = ['unknown_domain'];

      const recommendations =
        competencyEvaluationEngine.getRecommendedMicroPDs(gapDomains);

      expect(recommendations).toHaveLength(0);
    });

    it('should deduplicate recommendations', () => {
      const gapDomains = ['planning', 'planning'];

      const recommendations =
        competencyEvaluationEngine.getRecommendedMicroPDs(gapDomains);

      // Should only have unique recommendations
      const uniqueRecommendations = [...new Set(recommendations)];
      expect(recommendations.length).toBe(uniqueRecommendations.length);
    });
  });
});
