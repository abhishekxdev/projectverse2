import {
  createTutorRepository,
  TutorRepository,
} from '../repositories/tutorRepository';
import { createCompetencyRepository } from '../repositories/competencyRepository';
import { notificationService } from './notification.service';
import {
  AiTutorSession,
  AiTutorMessage,
  LearningPath,
  LearningPathModule,
  SessionResponse,
  MessageResponse,
  LearningPathResponse,
} from '../types/tutor.types';
import { TeacherCompetencyResult } from '../types/competency.types';
import { DOMAIN_TO_TRACK_MAP, TRACK_MODULE_TYPES, PD_TRACKS } from '../config/constants';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/error';
import { logger } from '../utils/logger';
import {
  TUTOR_SYSTEM_PROMPT,
  getTutorContextPrompt,
} from '../prompts/tutor.prompt';
import { openai, AI_CONFIG } from '../config/openai-client';
import OpenAI from 'openai';

export class TutorService {
  private repo: TutorRepository;
  private competencyRepo: ReturnType<typeof createCompetencyRepository>;

  constructor(repo?: TutorRepository) {
    this.repo = repo || createTutorRepository();
    this.competencyRepo = createCompetencyRepository();
  }

  // ============ Session Management ============

  /**
   * Start a new AI tutor session
   */
  async startSession(teacherId: string): Promise<SessionResponse> {
    // Check for existing active session
    const existingSession = await this.repo.getActiveSession(teacherId);
    if (existingSession) {
      return this.formatSessionResponse(existingSession);
    }

    // Create new session
    const session = await this.repo.createSession(teacherId);

    // Log event
    await this.repo.createEvent(teacherId, 'SESSION_STARTED', {
      sessionId: session.id,
    });

    // Send notification
    try {
      await notificationService.createNotification({
        userId: teacherId,
        type: 'tutor_session_started',
        title: 'AI Tutor Session Started',
        message:
          'Your AI tutor session has started. Ask any questions about teaching!',
        metadata: { sessionId: session.id },
      });
    } catch (err) {
      logger.error(
        'Failed to send session started notification',
        err instanceof Error ? err : undefined,
        { teacherId, sessionId: session.id }
      );
    }

    return this.formatSessionResponse(session);
  }

  /**
   * End an AI tutor session
   */
  async endSession(teacherId: string, sessionId: string): Promise<void> {
    const session = await this.repo.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    if (session.teacherId !== teacherId) {
      throw new ForbiddenError('You can only end your own sessions');
    }
    if (session.status !== 'active') {
      throw new ConflictError('Session is already ended');
    }

    await this.repo.endSession(sessionId);

    // Log event
    await this.repo.createEvent(teacherId, 'SESSION_ENDED', {
      sessionId,
    });
  }

  /**
   * Get session by ID
   */
  async getSession(
    teacherId: string,
    sessionId: string
  ): Promise<SessionResponse> {
    const session = await this.repo.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    if (session.teacherId !== teacherId) {
      throw new ForbiddenError('You can only access your own sessions');
    }
    return this.formatSessionResponse(session);
  }

  /**
   * Get all sessions for a teacher
   */
  async getSessions(teacherId: string): Promise<SessionResponse[]> {
    const sessions = await this.repo.getSessionsByTeacher(teacherId);
    return sessions.map((s) => this.formatSessionResponse(s));
  }

  // ============ Chat Integration ============

  /**
   * Send a message in a session and get AI response
   */
  async sendMessage(
    teacherId: string,
    sessionId: string,
    message: string
  ): Promise<{ userMessage: MessageResponse; aiMessage: MessageResponse }> {
    const session = await this.repo.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    if (session.teacherId !== teacherId) {
      throw new ForbiddenError(
        'You can only send messages in your own sessions'
      );
    }
    if (session.status !== 'active') {
      throw new ConflictError('Cannot send messages to an ended session');
    }

    // Save user message
    const userMsg = await this.repo.createMessage(
      sessionId,
      'teacher',
      message
    );

    const history = await this.repo.getMessagesBySession(sessionId);

    // Check if this is the first message (no previous AI messages)
    const hasPreviousAIMessages = history.some(
      (m) => m.sender === 'ai' && m.id !== userMsg.id
    );
    const isFirstMessage = !hasPreviousAIMessages;

    // Get teacher's learning context
    const learningPath = await this.repo.getLearningPathByTeacher(teacherId);
    const competencyResult = await this.competencyRepo.getResultByTeacherId(
      teacherId
    );

    // Build context prompt
    const contextPrompt = getTutorContextPrompt(competencyResult, learningPath);

    // Build conversation history for AI, filtering out fallback error messages and current user message
    const FALLBACK_MESSAGE =
      "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
    const filteredHistory = history.filter(
      (m) => m.message !== FALLBACK_MESSAGE && m.id !== userMsg.id
    );

    const conversationHistory = filteredHistory
      .slice(-10) // Last 10 messages for context
      .map(
        (m) =>
          `${m.sender === 'teacher' ? 'Teacher' : 'AI Tutor'}: ${m.message}`
      )
      .join('\n');

    // Build the user prompt - don't end with "AI Tutor:" as it can confuse the model
    const userPrompt = conversationHistory
      ? `${contextPrompt}\n\nConversation History:\n${conversationHistory}\n\nTeacher: ${message}`
      : `${contextPrompt}\n\nTeacher: ${message}`;

    // Generate AI response
    let aiResponseText: string;
    try {
      logger.info('Generating AI tutor response (direct OpenAI)', {
        sessionId,
        teacherId,
      });

      const response = await openai.responses.create({
        model: AI_CONFIG.model,
        input: [
          {
            role: 'system',
            content: TUTOR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_output_tokens: AI_CONFIG.maxTutorTokens,
      });

      aiResponseText =
        response.output_text ??
        (response as any).output?.[0]?.content?.[0]?.text ??
        '';

      // Log if response is empty
      if (!aiResponseText || aiResponseText.trim() === '') {
        logger.warn('AI returned empty response', {
          sessionId,
          teacherId,
          finishReason: this.extractFinishReason(response),
          usage: response.usage,
        });

        if (isFirstMessage) {
          aiResponseText =
            "Welcome To Gurucool AI\n\nI apologize, but I couldn't generate a response. Please try rephrasing your question.";
        } else {
          aiResponseText =
            "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
        }
      } else {
        logger.info('AI response generated successfully', {
          sessionId,
          responseLength: aiResponseText.length,
        });

        // Add welcome message for first interaction
        if (isFirstMessage) {
          const welcomeMessage = 'Welcome To Gurucool AI\n\n';
          // Only add if not already present (case-insensitive check)
          if (
            !aiResponseText.toLowerCase().includes('welcome to gurucool ai')
          ) {
            aiResponseText = welcomeMessage + aiResponseText;
          }
        }
      }
    } catch (err) {
      logger.error(
        'AI tutor response generation failed',
        err instanceof Error ? err : undefined,
        {
          sessionId,
          teacherId,
          errorMessage: err instanceof Error ? err.message : String(err),
        }
      );

      if (isFirstMessage) {
        aiResponseText =
          "Welcome To Gurucool AI\n\nI apologize, but I'm having trouble responding right now. Please try again in a moment.";
      } else {
        aiResponseText =
          "I apologize, but I'm having trouble responding right now. Please try again in a moment.";
      }
    }

    // Save AI message
    const aiMsg = await this.repo.createMessage(
      sessionId,
      'ai',
      aiResponseText
    );

    // Log event
    await this.repo.createEvent(teacherId, 'MESSAGE_SENT', {
      sessionId,
      messageId: userMsg.id,
    });

    return {
      userMessage: this.formatMessageResponse(userMsg),
      aiMessage: this.formatMessageResponse(aiMsg),
    };
  }

  /**
   * Get message history for a session
   */
  async getMessageHistory(
    teacherId: string,
    sessionId: string
  ): Promise<MessageResponse[]> {
    const session = await this.repo.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    if (session.teacherId !== teacherId) {
      throw new ForbiddenError('You can only access your own message history');
    }

    const messages = await this.repo.getMessagesBySession(sessionId);
    return messages.map((m) => this.formatMessageResponse(m));
  }

  // ============ Learning Path ============

  /**
   * Generate learning path from competency result
   */
  async generateLearningPath(
    teacherId: string,
    resultId?: string
  ): Promise<LearningPathResponse> {
    // Get competency result
    let result: TeacherCompetencyResult | null;
    if (resultId) {
      result = await this.competencyRepo.getResultByAttemptId(resultId);
    } else {
      result = await this.competencyRepo.getResultByTeacherId(teacherId);
    }

    if (!result) {
      throw new NotFoundError(
        'No competency result found. Please complete the assessment first.'
      );
    }

    // Check for existing learning path
    const existingPath = await this.repo.getLearningPathByTeacher(teacherId);
    if (existingPath) {
      return this.formatLearningPathResponse(existingPath);
    }

    // Group gap domains by their parent track
    const trackGaps = new Map<string, { domains: string[], scores: number[] }>();

    for (const domain of result.gapDomains) {
      const trackId = DOMAIN_TO_TRACK_MAP[domain];
      if (trackId) {
        if (!trackGaps.has(trackId)) {
          trackGaps.set(trackId, { domains: [], scores: [] });
        }
        const trackData = trackGaps.get(trackId)!;
        trackData.domains.push(domain);

        const domainScore = result.domainScores.find(d => d.domainKey === domain);
        if (domainScore) {
          trackData.scores.push(domainScore.scorePercent);
        }
      }
    }

    if (trackGaps.size === 0) {
      throw new ConflictError(
        'Congratulations! You have no gap areas. No learning path needed.'
      );
    }

    // Calculate average score for each track and sort by lowest first
    const tracksWithAvgScores = Array.from(trackGaps.entries()).map(([trackId, data]) => {
      const avgScore = data.scores.length > 0
        ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length
        : 0;
      return { trackId, domains: data.domains, avgScore };
    });

    tracksWithAvgScores.sort((a, b) => a.avgScore - b.avgScore);

    // Generate modules from tracks (prioritize lowest scoring tracks)
    const modules: LearningPathModule[] = [];
    let order = 1;

    for (const { trackId, domains } of tracksWithAvgScores) {
      const moduleTypes = TRACK_MODULE_TYPES[trackId] || [];

      for (const moduleType of moduleTypes) {
        modules.push({
          moduleId: `${trackId}_${moduleType.toLowerCase().replace(/\s+/g, '_')}`,
          title: this.getModuleTitle(trackId, moduleType),
          domainKey: domains[0],
          status: order === 1 ? 'unlocked' : 'locked',
          order: order++,
        });
      }
    }

    if (modules.length === 0) {
      throw new ConflictError(
        'Congratulations! You have no gap areas. No learning path needed.'
      );
    }

    // Create learning path
    const path = await this.repo.createLearningPath(
      teacherId,
      modules,
      result.id
    );

    // Log event
    await this.repo.createEvent(teacherId, 'LEARNING_PATH_CREATED', {
      pathId: path.id,
      moduleCount: modules.length,
    });

    // Send notification
    try {
      await notificationService.createNotification({
        userId: teacherId,
        type: 'learning_path_created',
        title: 'Learning Path Created',
        message: `Your personalized learning path with ${modules.length} modules is ready!`,
        metadata: { pathId: path.id, moduleCount: modules.length },
      });
    } catch (err) {
      logger.error(
        'Failed to send learning path notification',
        err instanceof Error ? err : undefined,
        { teacherId, pathId: path.id }
      );
    }

    return this.formatLearningPathResponse(path);
  }

  /**
   * Get learning path for a teacher
   */
  async getLearningPath(
    teacherId: string
  ): Promise<LearningPathResponse | null> {
    const path = await this.repo.getLearningPathByTeacher(teacherId);
    if (!path) {
      return null;
    }
    return this.formatLearningPathResponse(path);
  }

  /**
   * Get learning path preview (for limited access teachers)
   */
  async getLearningPathPreview(
    teacherId: string
  ): Promise<LearningPathResponse | null> {
    // First try to get existing path
    const existingPath = await this.repo.getLearningPathByTeacher(teacherId);
    if (existingPath) {
      const response = this.formatLearningPathResponse(existingPath);
      response.status = 'preview';
      return response;
    }

    // Generate preview from competency result without saving
    const result = await this.competencyRepo.getResultByTeacherId(teacherId);
    if (!result) {
      return null;
    }

    // Group gap domains by their parent track
    const trackGaps = new Map<string, { domains: string[], scores: number[] }>();

    for (const domain of result.gapDomains) {
      const trackId = DOMAIN_TO_TRACK_MAP[domain];
      if (trackId) {
        if (!trackGaps.has(trackId)) {
          trackGaps.set(trackId, { domains: [], scores: [] });
        }
        const trackData = trackGaps.get(trackId)!;
        trackData.domains.push(domain);

        const domainScore = result.domainScores.find(d => d.domainKey === domain);
        if (domainScore) {
          trackData.scores.push(domainScore.scorePercent);
        }
      }
    }

    // Calculate average score for each track and sort by lowest first
    const tracksWithAvgScores = Array.from(trackGaps.entries()).map(([trackId, data]) => {
      const avgScore = data.scores.length > 0
        ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length
        : 0;
      return { trackId, domains: data.domains, avgScore };
    });

    tracksWithAvgScores.sort((a, b) => a.avgScore - b.avgScore);

    const modules: LearningPathModule[] = [];
    let order = 1;

    for (const { trackId, domains } of tracksWithAvgScores) {
      const moduleTypes = TRACK_MODULE_TYPES[trackId] || [];

      for (const moduleType of moduleTypes) {
        modules.push({
          moduleId: `${trackId}_${moduleType.toLowerCase().replace(/\s+/g, '_')}`,
          title: this.getModuleTitle(trackId, moduleType),
          domainKey: domains[0],
          status: order === 1 ? 'unlocked' : 'locked',
          order: order++,
        });
      }
    }

    return {
      id: 'preview',
      teacherId,
      modules: modules.map((m) => ({
        moduleId: m.moduleId,
        title: m.title,
        domainKey: m.domainKey,
        status: m.status,
        order: m.order,
      })),
      currentModuleIndex: 0,
      status: 'preview',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Unlock next module in learning path
   */
  async unlockNextModule(
    teacherId: string
  ): Promise<LearningPathResponse | null> {
    const path = await this.repo.getLearningPathByTeacher(teacherId);
    if (!path) {
      throw new NotFoundError('No learning path found');
    }

    const updatedPath = await this.repo.unlockNextModule(path.id);
    if (!updatedPath) {
      throw new NotFoundError('Failed to unlock next module');
    }

    // Log event
    await this.repo.createEvent(teacherId, 'MODULE_UNLOCKED', {
      pathId: path.id,
      moduleIndex: updatedPath.currentModuleIndex,
    });

    // Send notification
    try {
      const currentModule = updatedPath.modules[updatedPath.currentModuleIndex];
      if (currentModule) {
        await notificationService.createNotification({
          userId: teacherId,
          type: 'module_unlocked',
          title: 'New Module Unlocked',
          message: `Module "${currentModule.title}" is now available!`,
          metadata: {
            moduleId: currentModule.moduleId,
            moduleName: currentModule.title,
          },
        });
      }
    } catch (err) {
      logger.error(
        'Failed to send module unlocked notification',
        err instanceof Error ? err : undefined,
        { teacherId, pathId: path.id }
      );
    }

    return this.formatLearningPathResponse(updatedPath);
  }

  // ============ Private Helpers ============

  private getModuleTitle(trackId: string, moduleType: string): string {
    const trackNames: Record<string, string> = {
      pedagogical_mastery: 'Pedagogical Mastery',
      tech_ai_fluency: 'AI & Tech',
      inclusive_practice: 'Inclusive Practice',
      professional_identity: 'Professional Identity',
      global_citizenship: 'Global Citizenship',
      educational_foundations: 'Educational Foundations',
    };
    const trackName = trackNames[trackId] || trackId;
    return `${trackName}: ${moduleType}`;
  }

  private formatSessionResponse(session: AiTutorSession): SessionResponse {
    return {
      id: session.id,
      teacherId: session.teacherId,
      status: session.status,
      startedAt: session.startedAt.toDate().toISOString(),
      endedAt: session.endedAt?.toDate().toISOString(),
    };
  }

  private formatMessageResponse(message: AiTutorMessage): MessageResponse {
    return {
      id: message.id,
      sessionId: message.sessionId,
      sender: message.sender,
      message: message.message,
      timestamp: message.timestamp.toDate().toISOString(),
    };
  }

  private formatLearningPathResponse(path: LearningPath): LearningPathResponse {
    return {
      id: path.id,
      teacherId: path.teacherId,
      modules: path.modules.map((m) => ({
        moduleId: m.moduleId,
        title: m.title,
        domainKey: m.domainKey,
        status: m.status,
        order: m.order,
        completedAt: m.completedAt?.toDate().toISOString(),
      })),
      currentModuleIndex: path.currentModuleIndex,
      status: path.status,
      createdAt: path.createdAt.toDate().toISOString(),
    };
  }

  private extractFinishReason(response: OpenAI.Responses.Response): string {
    if (response.status === 'completed') return 'stop';
    if (response.status === 'incomplete') 
      return response.incomplete_details?.reason ?? 'incomplete';

    return response.status ?? 'unknown';
  }
}


// Export singleton instance
export const tutorService = new TutorService();
