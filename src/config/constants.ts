/**
 * Application Constants
 * Defines tier limits, competency areas, and other system-wide values
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
} as const;

// User roles
export const USER_ROLES = {
  SCHOOL_TEACHER: 'school_teacher',
  SCHOOL_ADMIN: 'school_admin',
  PLATFORM_ADMIN: 'platform_admin',
} as const;

// User account statuses
export const USER_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

// User tiers
export const USER_TIERS = {
  FREE: 'free',
  SCHOOL: 'school',
} as const;

// Tier limits
export const TIER_LIMITS = {
  [USER_TIERS.FREE]: {
    assessmentsPerMonth: 1,
    tutorMessagesPerMonth: 10,
    modulesAccessible: ['basic'], // Basic modules only
  },
  [USER_TIERS.SCHOOL]: {
    assessmentsPerMonth: -1, // Unlimited
    tutorMessagesPerMonth: -1, // Unlimited
    modulesAccessible: ['basic', 'advanced', 'premium'], // All modules
  },
} as const;

// Competency areas for assessments
export const COMPETENCY_AREAS = [
  'classroom_management',
  'instructional_strategies',
  'student_engagement',
  'assessment_techniques',
  'differentiated_instruction',
  'technology_integration',
  'communication_skills',
  'professional_development',
] as const;

// Grade levels
export const GRADE_LEVELS = [
  'KG',
  'Grade 1-5',
  'Grade 6-8',
  'Grade 9-10',
  'Grade 11-12',
  'College',
  'Other',
] as const;

// Subjects
export const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'History',
  'Geography',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Art',
  'Music',
  'Physical Education',
] as const;

// School Admin Roles
export const SCHOOL_ADMIN_ROLES = [
  'Principal',
  'Vice Principal',
  'Head of Department',
  'HR / PD Coordinator',
  'Other Admin',
] as const;

// Assessment question types
export const QUESTION_TYPES = {
  MCQ: 'mcq',
  SHORT_ANSWER: 'short_answer',
  VIDEO_ROLEPLAY: 'video_roleplay',
} as const;

// Module types
export const MODULE_TYPES = {
  VIDEO: 'video',
  TEXT: 'text',
  QUIZ: 'quiz',
} as const;

// File upload limits
export const FILE_LIMITS = {
  VIDEO_MAX_SIZE_MB: 100,
  VIDEO_MAX_DURATION_SECONDS: 120, // 2 minutes
  SUPPORTED_VIDEO_FORMATS: ['mp4', 'mov', 'avi'],
} as const;

// API configuration
export const API_CONFIG = {
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100, // Per window
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Badge criteria types
export const BADGE_CRITERIA_TYPES = {
  ASSESSMENT_COMPLETE: 'assessment_complete',
  MODULE_COMPLETE: 'module_complete',
  STREAK: 'streak',
} as const;

// Certificate types
export const CERTIFICATE_TYPES = {
  MODULE: 'module',
  PATHWAY: 'pathway',
  ASSESSMENT: 'assessment',
} as const;

// Competency assessment attempt statuses
export const ATTEMPT_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  EVALUATED: 'EVALUATED',
  FAILED: 'FAILED',
} as const;

// Proficiency levels based on overall score (from AI_Tutor_Routing_Logic.md)
export const PROFICIENCY_LEVELS = {
  BEGINNER: 'Beginner', // 0-39%
  DEVELOPING: 'Developing', // 40-59%
  PROFICIENT: 'Proficient', // 60-79%
  ADVANCED: 'Advanced', // 80-100%
} as const;

// Proficiency level thresholds (percentages)
export const PROFICIENCY_THRESHOLDS = {
  BEGINNER_MAX: 39,
  DEVELOPING_MAX: 59,
  PROFICIENT_MAX: 79,
  // ADVANCED is 80-100%
} as const;

// Competency domains for assessment (25 Core Competencies from Master List)
export const COMPETENCY_DOMAINS = {
  // Track 1: Mastering the Art of Teaching (Pedagogical Mastery)
  LESSON_PLANNING: 'lesson_planning',
  INSTRUCTIONAL_STRATEGIES: 'instructional_strategies',
  CLASSROOM_MANAGEMENT: 'classroom_management',
  ASSESSMENT_FEEDBACK: 'assessment_feedback',
  FACILITATION_PRESENTATION: 'facilitation_presentation',

  // Track 2: Teaching in AI & Tech Era (Tech & AI Fluency)
  EDTECH_FLUENCY: 'edtech_fluency',
  AI_LITERACY: 'ai_literacy',
  BLENDED_ONLINE_INSTRUCTION: 'blended_online_instruction',
  CYBERSECURITY_DIGITAL_CITIZENSHIP: 'cybersecurity_digital_citizenship',

  // Track 3: Inclusive & Student-Centered Teaching (Inclusive Practice)
  DIFFERENTIATED_INSTRUCTION: 'differentiated_instruction',
  INCLUSIVE_EDUCATION: 'inclusive_education',
  CULTURAL_COMPETENCE_DEI: 'cultural_competence_dei',
  SOCIAL_EMOTIONAL_LEARNING: 'social_emotional_learning',

  // Track 4: The Professional Educator (Professional Identity)
  REFLECTIVE_PRACTICE: 'reflective_practice',
  LIFELONG_LEARNING: 'lifelong_learning',
  CAREER_PORTFOLIO: 'career_portfolio',
  PARENT_STAKEHOLDER_COMMUNICATION: 'parent_stakeholder_communication',
  PROFESSIONAL_COLLABORATION: 'professional_collaboration',
  ETHICS_PROFESSIONALISM: 'ethics_professionalism',

  // Track 5: 21st Century & Global Educator (Global Citizenship)
  INNOVATION_CHANGE_MANAGEMENT: 'innovation_change_management',
  CRITICAL_THINKING_CREATIVITY: 'critical_thinking_creativity',
  GLOBAL_CITIZENSHIP_SUSTAINABILITY: 'global_citizenship_sustainability',
  MEDIA_INFORMATION_LITERACY: 'media_information_literacy',

  // Track 6: Educational Foundations & Policy (Foundations & Policy)
  CHILD_DEVELOPMENT_PSYCHOLOGY: 'child_development_psychology',
  EDUCATION_POLICY_GOVERNANCE: 'education_policy_governance',
} as const;

// PD Tracks (6 Core Tracks from Structured Competency Framework)
export const PD_TRACKS = {
  PEDAGOGICAL_MASTERY: {
    id: 'pedagogical_mastery',
    name: 'Pedagogical Mastery',
    badge: 'Pedagogical Architect',
    microBadges: ['Planning Pro', 'Engagement Expert', 'Assessment Strategist'],
    competencies: [
      'lesson_planning',
      'instructional_strategies',
      'classroom_management',
      'assessment_feedback',
      'facilitation_presentation',
    ],
  },
  TECH_AI_FLUENCY: {
    id: 'tech_ai_fluency',
    name: 'AI & Tech',
    badge: 'AI-Enhanced Educator',
    microBadges: ['EdTech Integrator', 'AI Thinker', 'Digital Safety Advocate'],
    competencies: [
      'edtech_fluency',
      'ai_literacy',
      'blended_online_instruction',
      'cybersecurity_digital_citizenship',
    ],
  },
  INCLUSIVE_PRACTICE: {
    id: 'inclusive_practice',
    name: 'Inclusive Practice',
    badge: 'Inclusive Classroom Champion',
    microBadges: ['UDL Ally', 'SEL Mentor', 'Equity Builder'],
    competencies: [
      'differentiated_instruction',
      'inclusive_education',
      'cultural_competence_dei',
      'social_emotional_learning',
    ],
  },
  PROFESSIONAL_IDENTITY: {
    id: 'professional_identity',
    name: 'Professional Identity',
    badge: 'Professional Teacher Identity',
    microBadges: ['Reflective Practitioner', 'Communicator', 'Ethical Educator'],
    competencies: [
      'reflective_practice',
      'lifelong_learning',
      'career_portfolio',
      'parent_stakeholder_communication',
      'professional_collaboration',
      'ethics_professionalism',
    ],
  },
  GLOBAL_CITIZENSHIP: {
    id: 'global_citizenship',
    name: 'Global Citizenship',
    badge: 'Global & Future-Ready Educator',
    microBadges: ['Innovation Facilitator', 'Creative Thinker', 'Digital Literate'],
    competencies: [
      'innovation_change_management',
      'critical_thinking_creativity',
      'global_citizenship_sustainability',
      'media_information_literacy',
    ],
  },
  EDUCATIONAL_FOUNDATIONS: {
    id: 'educational_foundations',
    name: 'Educational Foundations',
    badge: 'Certified Education Theorist',
    microBadges: ['Psychology Aligned', 'Policy-Aware Teacher'],
    competencies: [
      'child_development_psychology',
      'education_policy_governance',
    ],
  },
} as const;

// Score interpretation bands (from AI_Tutor_Routing_Logic.md)
export const SCORE_BANDS = {
  BEGINNER: { min: 0, max: 39, label: 'Beginner', aiLabel: 'High-Priority Gap', urgency: 'High' },
  DEVELOPING: { min: 40, max: 59, label: 'Developing', aiLabel: 'Core Skill Builder', urgency: 'Medium' },
  PROFICIENT: { min: 60, max: 79, label: 'Proficient', aiLabel: 'Enhancement Track', urgency: 'Medium' },
  ADVANCED: { min: 80, max: 100, label: 'Advanced', aiLabel: 'PD Ambassador Pipeline', urgency: 'Low' },
} as const;


// Track-level module type mapping (replaces domain-specific micro-PDs)
export const TRACK_MODULE_TYPES: Record<string, string[]> = {
  pedagogical_mastery: ['Lesson Planning', 'Engagement Strategies', 'Assessment Design'],
  tech_ai_fluency: ['AI Literacy', 'EdTech Tools', 'Digital Safety'],
  inclusive_practice: ['UDL Design', 'SEL Activities', 'Differentiation'],
  professional_identity: ['Reflection Journals', 'Parent Communication', 'Ethics'],
  global_citizenship: ['PBL', 'Creativity Frameworks', 'Media Literacy'],
  educational_foundations: ['Learning Theories', 'Child Psychology', 'Policy Awareness'],
} as const;

// Domain to Track mapping (extracted from PD_TRACKS competencies)
export const DOMAIN_TO_TRACK_MAP: Record<string, string> = {
  lesson_planning: 'pedagogical_mastery',
  instructional_strategies: 'pedagogical_mastery',
  classroom_management: 'pedagogical_mastery',
  assessment_feedback: 'pedagogical_mastery',
  facilitation_presentation: 'pedagogical_mastery',

  edtech_fluency: 'tech_ai_fluency',
  ai_literacy: 'tech_ai_fluency',
  blended_online_instruction: 'tech_ai_fluency',
  cybersecurity_digital_citizenship: 'tech_ai_fluency',

  differentiated_instruction: 'inclusive_practice',
  inclusive_education: 'inclusive_practice',
  cultural_competence_dei: 'inclusive_practice',
  social_emotional_learning: 'inclusive_practice',

  reflective_practice: 'professional_identity',
  lifelong_learning: 'professional_identity',
  career_portfolio: 'professional_identity',
  parent_stakeholder_communication: 'professional_identity',
  professional_collaboration: 'professional_identity',
  ethics_professionalism: 'professional_identity',

  innovation_change_management: 'global_citizenship',
  critical_thinking_creativity: 'global_citizenship',
  global_citizenship_sustainability: 'global_citizenship',
  media_information_literacy: 'global_citizenship',

  child_development_psychology: 'educational_foundations',
  education_policy_governance: 'educational_foundations',
} as const;

// Strength threshold for 90% rule
export const STRENGTH_THRESHOLD_PERCENT = 90;

// Questions per domain for randomization (Task 4)
// Note: Current question bank has 1-3 questions per domain. Increase when more questions are added.
export const QUESTIONS_PER_DOMAIN = 1;

export const QUESTIONS_BY_TYPE = {
  MCQ: 10,
  SHORT_ANSWER: 5,
  AUDIO: 2,
  VIDEO: 1,
} as const;

export const TOTAL_COMPETENCY_QUESTIONS = 
  QUESTIONS_BY_TYPE.MCQ + 
  QUESTIONS_BY_TYPE.SHORT_ANSWER + 
  QUESTIONS_BY_TYPE.AUDIO + 
  QUESTIONS_BY_TYPE.VIDEO;

// Competency question types (used in assessment)
export const COMPETENCY_QUESTION_TYPES = {
  MCQ: 'MCQ',
  SHORT_ANSWER: 'SHORT_ANSWER',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
} as const;


// ============ BADGE SYSTEM ============
// From AI_Tutor_Routing_Logic.md - Badge Triggers

export const BADGE_TYPES = {
  TRACK_BADGE: 'track_badge', // Main badge for completing a track
  MICRO_BADGE: 'micro_badge', // Smaller achievement badges
  AMBASSADOR_BADGE: 'ambassador_badge', // Leadership recognition
} as const;

export const BADGE_TRIGGER_CRITERIA = {
  // Standard badge: 70% score + reflection + peer interaction
  STANDARD_BADGE: {
    minScore: 70,
    requiresReflection: true,
    requiresPeerInteraction: true,
  },
  // Ambassador nomination: 85% score
  AMBASSADOR_NOMINATION: {
    minScore: 85,
    requiresReflection: true,
    requiresPeerInteraction: true,
    requiresLeadershipActivity: true,
  },
} as const;

export const BADGE_STATUS = {
  LOCKED: 'locked',
  IN_PROGRESS: 'in_progress',
  EARNED: 'earned',
  EXPIRED: 'expired',
} as const;

// ============ PEER COHORT SYSTEM ============
// From AI_Tutor_Routing_Logic.md - Peer Cohort Placement

export const COHORT_ROLES = {
  LEARNER: 'learner', // Beginner & Developing
  MENTOR: 'mentor', // Proficient
  LEADER: 'leader', // Advanced
} as const;

export const COHORT_PLACEMENT_RULES = {
  // Groups Beginners and Developers together
  BEGINNER: { cohortRole: 'learner', canMentor: false, canLead: false },
  DEVELOPING: { cohortRole: 'learner', canMentor: false, canLead: false },
  // Proficient users become mentors
  PROFICIENT: { cohortRole: 'mentor', canMentor: true, canLead: false },
  // Advanced get leadership roles
  ADVANCED: { cohortRole: 'leader', canMentor: true, canLead: true },
} as const;

export const COHORT_SIZE_LIMITS = {
  MIN_COHORT_SIZE: 3,
  MAX_COHORT_SIZE: 10,
  MENTORS_PER_COHORT: 2,
  LEADERS_PER_COHORT: 1,
} as const;

// ============ REFLECTION SYSTEM ============
// From AI_Tutor_Routing_Logic.md - Reflection Tasks

export const REFLECTION_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  EVALUATED: 'evaluated',
  RETRY_REQUIRED: 'retry_required',
} as const;

export const REFLECTION_QUALITY_THRESHOLDS = {
  POOR: { min: 0, max: 39, action: 'retry_or_coach' },
  ACCEPTABLE: { min: 40, max: 69, action: 'accepted_with_feedback' },
  GOOD: { min: 70, max: 89, action: 'accepted' },
  EXCELLENT: { min: 90, max: 100, action: 'featured' },
} as const;

export const REFLECTION_RUBRIC = {
  DEPTH_OF_INSIGHT: {
    weight: 0.3,
    levels: {
      0: 'No meaningful reflection',
      1: 'Surface-level observations',
      2: 'Some analysis of experience',
      3: 'Deep, actionable insights',
    },
  },
  CONNECTION_TO_PRACTICE: {
    weight: 0.3,
    levels: {
      0: 'No connection to teaching',
      1: 'Vague connection',
      2: 'Clear connection with examples',
      3: 'Strong integration with practice',
    },
  },
  GROWTH_MINDSET: {
    weight: 0.2,
    levels: {
      0: 'Fixed mindset language',
      1: 'Acknowledges room for growth',
      2: 'Identifies specific growth areas',
      3: 'Sets concrete improvement goals',
    },
  },
  CLARITY_EXPRESSION: {
    weight: 0.2,
    levels: {
      0: 'Incoherent or incomplete',
      1: 'Understandable but vague',
      2: 'Clear and organized',
      3: 'Articulate and compelling',
    },
  },
} as const;

// ============ URGENCY ALERTS SYSTEM ============
// From AI_Tutor_Routing_Logic.md - Urgency Alerts

export const URGENCY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const URGENCY_TRIGGERS = {
  // Multiple Beginner tracks = high-risk flag
  MULTIPLE_BEGINNER_TRACKS: {
    condition: 'beginner_track_count >= 3',
    urgency: 'high',
    alertType: 'high_risk_teacher',
  },
  // Inactive for extended period
  INACTIVE_7_DAYS: {
    condition: 'days_inactive >= 7',
    urgency: 'medium',
    alertType: 'inactivity_nudge',
  },
  INACTIVE_14_DAYS: {
    condition: 'days_inactive >= 14',
    urgency: 'high',
    alertType: 'inactivity_warning',
  },
  INACTIVE_30_DAYS: {
    condition: 'days_inactive >= 30',
    urgency: 'critical',
    alertType: 'inactivity_critical',
  },
  // Failed attempts
  MULTIPLE_FAILED_ATTEMPTS: {
    condition: 'failed_attempts >= 3',
    urgency: 'medium',
    alertType: 'struggling_teacher',
  },
  // No progress after PD assignment
  NO_PD_PROGRESS: {
    condition: 'assigned_pd_incomplete_days >= 14',
    urgency: 'medium',
    alertType: 'pd_stalled',
  },
} as const;

export const ALERT_ACTIONS = {
  SEND_NUDGE: 'send_nudge', // Automated reminder
  NOTIFY_ADMIN: 'notify_admin', // Flag for admin dashboard
  ASSIGN_COACH: 'assign_coach', // Pair with AI coach
  ESCALATE: 'escalate', // Escalate to school admin
} as const;

// ============ SMART CREDENTIALS SYSTEM ============
// From Structured_Competency_Framework.md - Issue Smart Credentials

export const CREDENTIAL_TYPES = {
  SKILL_BADGE: 'skill_badge', // Skill-specific (not course-based)
  TRACK_CERTIFICATE: 'track_certificate', // Track completion
  MICRO_CREDENTIAL: 'micro_credential', // Individual competency
  AMBASSADOR_CREDENTIAL: 'ambassador_credential', // Leadership recognition
} as const;

export const CREDENTIAL_STATUS = {
  PENDING: 'pending',
  ISSUED: 'issued',
  VERIFIED: 'verified',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
} as const;

export const CREDENTIAL_VISIBILITY = {
  PRIVATE: 'private',
  SCHOOL_ONLY: 'school_only',
  PUBLIC: 'public', // Shareable on LinkedIn, resume
} as const;

// ============ GROWTH JOURNEY SNAPSHOT ============
// From Structured_Competency_Framework.md - Track Growth

export const GROWTH_SNAPSHOT_METRICS = {
  OVERALL_PROGRESS: 'overall_progress',
  TRACK_PROGRESS: 'track_progress',
  BADGE_COUNT: 'badge_count',
  REFLECTION_QUALITY: 'reflection_quality',
  PEER_INTERACTIONS: 'peer_interactions',
  MODULES_COMPLETED: 'modules_completed',
  STREAK_DAYS: 'streak_days',
  MENTOR_SESSIONS: 'mentor_sessions',
} as const;

export const GROWTH_SNAPSHOT_FREQUENCY = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
} as const;
