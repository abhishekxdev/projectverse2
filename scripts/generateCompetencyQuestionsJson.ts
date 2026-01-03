/**
 * Script to generate sample-competency-questions.json from TCDT document
 * Run: npx ts-node scripts/generateCompetencyQuestionsJson.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Question {
  id: string;
  category: string;
  type: string;
  track: string;
  domainKey: string;
  prompt: string;
  options?: string[];
  correctOption?: string;
  bloomLevel?: string;
  competencyTag?: string;
  scoringCriteria?: string;
  bestResponse?: string;
  maxScore: number;
  order: number;
}

// Track to domainKey mapping
const trackToDomain: Record<string, string> = {
  'Pedagogical Mastery': 'pedagogical_mastery',
  'AI & Tech': 'ai_tech_fluency',
  'Inclusive Practice': 'inclusive_practice',
  'Professional Identity': 'professional_identity',
  'Global Citizenship': 'global_citizenship',
  'Educational Foundations': 'educational_foundations',
};

// Base questions from TCDT
const baseMCQs = [
  { track: 'Pedagogical Mastery', domainKey: 'lesson_planning', prompt: "You've designed a science project that's exciting, but students are missing key concepts. What should you do?", options: ['Reduce project scope and reteach basics', 'Grade on effort', 'Ignore the gaps', 'Cancel the project'], correctOption: 'A', bloomLevel: 'Apply', competencyTag: 'Lesson Planning' },
  { track: 'Pedagogical Mastery', domainKey: 'classroom_management', prompt: "A student keeps interrupting during your explanation. What's the best first step?", options: ['Ignore and continue', 'Send them out', 'Use humor to redirect', 'Call their parents'], correctOption: 'C', bloomLevel: 'Apply', competencyTag: 'Classroom Management' },
  { track: 'AI & Tech', domainKey: 'ai_literacy', prompt: "You're using an AI chatbot for student feedback. What's the biggest risk?", options: ['Bias in AI suggestions', 'Tool formatting', 'Privacy and transparency', 'Too creative'], correctOption: 'C', bloomLevel: 'Understand', competencyTag: 'AI Risk Awareness' },
  { track: 'AI & Tech', domainKey: 'ai_literacy', prompt: "What's a responsible way to use generative AI in class?", options: ['Let AI grade everything', 'Use it to replace your slides', 'Explain how it works to students', 'Let students play with it unmonitored'], correctOption: 'C', bloomLevel: 'Analyze', competencyTag: 'AI Integration' },
  { track: 'Inclusive Practice', domainKey: 'inclusive_education', prompt: 'A student avoids group work due to social anxiety. Your best response?', options: ['Force participation', 'Let them opt out permanently', 'Offer alternative participation', 'Punish the student'], correctOption: 'C', bloomLevel: 'Apply', competencyTag: 'Inclusive Practice' },
  { track: 'Inclusive Practice', domainKey: 'cultural_competence_dei', prompt: 'You notice your lesson materials lack cultural diversity. What should you do?', options: ['Ignore it for now', 'Use only diverse examples going forward', 'Reflect and revise materials', 'Let students decide'], correctOption: 'C', bloomLevel: 'Evaluate', competencyTag: 'DEI' },
  { track: 'Professional Identity', domainKey: 'ethics_professionalism', prompt: 'You made an error in grading. A student points it out. You should...', options: ['Defend your grading', 'Admit the error', 'Blame the student', 'Do nothing'], correctOption: 'B', bloomLevel: 'Apply', competencyTag: 'Ethics' },
  { track: 'Professional Identity', domainKey: 'lifelong_learning', prompt: "You're struggling to meet your school's PD hours. What should you do?", options: ['Skip PD for now', "Copy others' PD records", 'Log a plan and attend PDs later', 'Complain about lack of time'], correctOption: 'C', bloomLevel: 'Understand', competencyTag: 'Lifelong Learning' },
  { track: 'Global Citizenship', domainKey: 'global_citizenship_sustainability', prompt: 'How would you integrate SDGs into a primary lesson?', options: ['Lecture on SDG goals', 'Add group work with token roles', 'Design a student-led sustainability project', 'Skip it—too complex'], correctOption: 'C', bloomLevel: 'Create', competencyTag: 'Global Literacy' },
  { track: 'Educational Foundations', domainKey: 'child_development_psychology', prompt: "Which of the following reflects Piaget's theory of cognitive development?", options: ['Children are passive learners', 'Learning is continuous and based on experience', 'Learning occurs in stages with active exploration', 'Development is unrelated to teaching methods'], correctOption: 'C', bloomLevel: 'Understand', competencyTag: 'Child Development' },
];

const baseShortAnswers = [
  { track: 'Pedagogical Mastery', domainKey: 'lesson_planning', prompt: 'Describe a time when your lesson failed. What did you learn?', scoringCriteria: 'Clarity, reflection, lesson adaptation' },
  { track: 'AI & Tech', domainKey: 'ai_literacy', prompt: 'How do you decide whether or not to use an AI tool in a lesson?', scoringCriteria: 'Decision rationale, ethical awareness' },
  { track: 'Inclusive Practice', domainKey: 'differentiated_instruction', prompt: 'Explain how you modify your lessons for students with learning disabilities.', scoringCriteria: 'Specificity, scaffolding approach' },
  { track: 'Professional Identity', domainKey: 'reflective_practice', prompt: 'What does professional growth mean to you as a teacher?', scoringCriteria: 'Self-awareness, development mindset' },
  { track: 'Global Citizenship', domainKey: 'global_citizenship_sustainability', prompt: 'How do you approach teaching controversial global topics?', scoringCriteria: 'Neutrality, sensitivity, engagement' },
  { track: 'Educational Foundations', domainKey: 'child_development_psychology', prompt: 'What role does child psychology play in your daily teaching practice?', scoringCriteria: 'Application of theory to practice' },
  { track: 'Inclusive Practice', domainKey: 'cultural_competence_dei', prompt: 'How do you make students from diverse cultures feel included in your class?', scoringCriteria: 'Cultural sensitivity, inclusion methods' },
  { track: 'AI & Tech', domainKey: 'edtech_fluency', prompt: 'Describe a responsible use case of AI that improved your teaching.', scoringCriteria: 'Tech integration, impact, responsibility' },
  { track: 'Professional Identity', domainKey: 'professional_collaboration', prompt: 'Tell us about a moment when you mentored a colleague or peer.', scoringCriteria: 'Support provided, collaboration' },
  { track: 'Pedagogical Mastery', domainKey: 'reflective_practice', prompt: 'What strategies do you use to reflect on and improve your lessons?', scoringCriteria: 'Reflection depth, iteration strategy' },
];

const baseAudioRoleplays = [
  { track: 'Pedagogical Mastery', domainKey: 'parent_stakeholder_communication', prompt: "You're explaining your teaching approach to a skeptical parent. Speak as you would in a real conversation.", scoringCriteria: 'Clarity, empathy, professionalism' },
  { track: 'Inclusive Practice', domainKey: 'social_emotional_learning', prompt: 'A student feels left out of group activities. Respond with empathy and solutions.', scoringCriteria: 'Sensitivity, problem-solving' },
  { track: 'Professional Identity', domainKey: 'ethics_professionalism', prompt: 'A colleague is violating school policies. Confront them diplomatically.', scoringCriteria: 'Respect, compliance, communication' },
  { track: 'AI & Tech', domainKey: 'ai_literacy', prompt: "You're advocating for AI tools to your school head. Make your case clearly.", scoringCriteria: 'Logic, clarity, ethical considerations' },
  { track: 'Global Citizenship', domainKey: 'global_citizenship_sustainability', prompt: 'Explain how you integrate SDGs in your curriculum to a fellow teacher.', scoringCriteria: 'Global awareness, instructional alignment' },
  { track: 'Pedagogical Mastery', domainKey: 'classroom_management', prompt: 'Coach a struggling new teacher about effective classroom routines.', scoringCriteria: 'Mentorship, tone, guidance' },
  { track: 'Inclusive Practice', domainKey: 'cultural_competence_dei', prompt: 'Handle a conflict between students from different cultural backgrounds.', scoringCriteria: 'Conflict resolution, DEI awareness' },
  { track: 'AI & Tech', domainKey: 'ai_literacy', prompt: 'Demonstrate how you introduce an AI writing assistant to a class.', scoringCriteria: 'Simplicity, safety, guidance' },
  { track: 'Professional Identity', domainKey: 'parent_stakeholder_communication', prompt: "Speak to a parent about a student's social-emotional challenges.", scoringCriteria: 'Empathy, support strategies' },
  { track: 'Educational Foundations', domainKey: 'child_development_psychology', prompt: 'Describe the importance of learning theories in shaping your lesson plans.', scoringCriteria: 'Knowledge application, articulation' },
];

const baseSelfPerception = [
  { track: 'AI & Tech', domainKey: 'ai_literacy', prompt: 'I feel confident using AI tools to support student learning.' },
  { track: 'Pedagogical Mastery', domainKey: 'assessment_feedback', prompt: 'I adjust my teaching based on ongoing student feedback.' },
  { track: 'Inclusive Practice', domainKey: 'inclusive_education', prompt: 'I know how to support neurodiverse learners effectively.' },
  { track: 'Professional Identity', domainKey: 'reflective_practice', prompt: 'I consistently reflect on my teaching to improve it.' },
  { track: 'Global Citizenship', domainKey: 'global_citizenship_sustainability', prompt: 'I integrate global issues like sustainability in my lessons.' },
  { track: 'Educational Foundations', domainKey: 'child_development_psychology', prompt: 'I understand how children develop across different age groups.' },
  { track: 'Inclusive Practice', domainKey: 'inclusive_education', prompt: 'I design inclusive learning environments for all students.' },
  { track: 'AI & Tech', domainKey: 'cybersecurity_digital_citizenship', prompt: 'I understand the ethical risks of using AI in class.' },
  { track: 'Professional Identity', domainKey: 'professional_collaboration', prompt: 'I welcome constructive feedback from my colleagues.' },
  { track: 'Pedagogical Mastery', domainKey: 'instructional_strategies', prompt: 'I use questioning techniques to promote deep thinking.' },
];

const baseTeachingDilemmas = [
  { track: 'Professional Identity', domainKey: 'ethics_professionalism', prompt: 'You catch a student cheating. What do you do?', bestResponse: 'Privately address it, apply school policy, and offer a learning opportunity' },
  { track: 'Pedagogical Mastery', domainKey: 'lesson_planning', prompt: "You're forced to teach a lesson outside your subject expertise. How do you respond?", bestResponse: 'Consult peers, gather resources, prepare responsibly' },
  { track: 'Inclusive Practice', domainKey: 'cultural_competence_dei', prompt: 'A parent complains about gender representation in your materials.', bestResponse: 'Review materials, consult stakeholders, update content if needed' },
  { track: 'AI & Tech', domainKey: 'ai_literacy', prompt: 'Your school bans a commonly used AI tool. You disagree. What now?', bestResponse: 'Raise concerns professionally and suggest alternatives' },
  { track: 'Global Citizenship', domainKey: 'global_citizenship_sustainability', prompt: "A student challenges your lesson on climate change as 'biased'.", bestResponse: 'Facilitate respectful dialogue, acknowledge perspectives' },
  { track: 'Professional Identity', domainKey: 'ethics_professionalism', prompt: "You're asked to lie to cover a scheduling error. What do you do?", bestResponse: 'Refuse and explain ethical stance' },
  { track: 'Inclusive Practice', domainKey: 'social_emotional_learning', prompt: 'A student refuses to participate in group work due to anxiety.', bestResponse: 'Offer alternative participation method and consult counselor' },
  { track: 'AI & Tech', domainKey: 'cybersecurity_digital_citizenship', prompt: "You're offered a free EdTech product to trial in class — with no vetting.", bestResponse: 'Decline until privacy and safety checks are complete' },
  { track: 'Educational Foundations', domainKey: 'child_development_psychology', prompt: "You're asked to teach faster and skip key concepts.", bestResponse: 'Explain risks of skipping and propose compromise' },
  { track: 'Pedagogical Mastery', domainKey: 'instructional_strategies', prompt: 'Your supervisor insists on traditional rote methods you disagree with.', bestResponse: 'Offer evidence-based alternatives respectfully' },
];

function generateQuestions(): Question[] {
  const questions: Question[] = [];
  let order = 1;

  // Generate 50 MCQs (A1-A50)
  for (let i = 0; i < 50; i++) {
    const base = baseMCQs[i % 10];
    const variant = i >= 10 ? ` (variant ${i - 9})` : '';
    questions.push({
      id: `A${i + 1}`,
      category: 'A_MCQ',
      type: 'MCQ',
      track: base.track,
      domainKey: base.domainKey,
      prompt: base.prompt + variant,
      options: base.options,
      correctOption: base.correctOption,
      bloomLevel: base.bloomLevel,
      competencyTag: base.competencyTag,
      maxScore: 1,
      order: order++,
    });
  }

  // Generate 50 Short Answers (B1-B50)
  for (let i = 0; i < 50; i++) {
    const base = baseShortAnswers[i % 10];
    const variant = i >= 10 ? ` (variant ${i - 9})` : '';
    questions.push({
      id: `B${i + 1}`,
      category: 'B_SHORT_ANSWER',
      type: 'SHORT_ANSWER',
      track: base.track,
      domainKey: base.domainKey,
      prompt: base.prompt + variant,
      scoringCriteria: base.scoringCriteria,
      maxScore: 9,
      order: order++,
    });
  }

  // Generate 50 Audio Roleplays (C1-C50)
  for (let i = 0; i < 50; i++) {
    const base = baseAudioRoleplays[i % 10];
    const variant = i >= 10 ? ` (variant ${i - 9})` : '';
    questions.push({
      id: `C${i + 1}`,
      category: 'C_AUDIO_ROLEPLAY',
      type: 'AUDIO',
      track: base.track,
      domainKey: base.domainKey,
      prompt: base.prompt + variant,
      scoringCriteria: base.scoringCriteria,
      maxScore: 9,
      order: order++,
    });
  }

  // Generate 50 Self-Perception (D1-D50)
  for (let i = 0; i < 50; i++) {
    const base = baseSelfPerception[i % 10];
    const variant = i >= 10 ? ` (variant ${i - 9})` : '';
    questions.push({
      id: `D${i + 1}`,
      category: 'D_SELF_PERCEPTION',
      type: 'MCQ',
      track: base.track,
      domainKey: base.domainKey,
      prompt: base.prompt + variant,
      options: ['1 - Strongly Disagree', '2 - Disagree', '3 - Neutral', '4 - Agree', '5 - Strongly Agree'],
      maxScore: 5,
      order: order++,
    });
  }

  // Generate 50 Teaching Dilemmas (E1-E50)
  for (let i = 0; i < 50; i++) {
    const base = baseTeachingDilemmas[i % 10];
    const variant = i >= 10 ? ` (variant ${i - 9})` : '';
    questions.push({
      id: `E${i + 1}`,
      category: 'E_TEACHING_DILEMMA',
      type: 'SHORT_ANSWER',
      track: base.track,
      domainKey: base.domainKey,
      prompt: base.prompt + variant,
      bestResponse: base.bestResponse,
      maxScore: 9,
      order: order++,
    });
  }

  return questions;
}

const output = {
  assessmentId: 'tcdt-assessment-v1',
  title: 'Teacher Competency Diagnostic Test (TCDT)',
  description: 'Comprehensive assessment across 6 PD tracks covering 250 questions',
  version: '1.0',
  totalQuestions: 250,
  categories: {
    A_MCQ: 50,
    B_SHORT_ANSWER: 50,
    C_AUDIO_ROLEPLAY: 50,
    D_SELF_PERCEPTION: 50,
    E_TEACHING_DILEMMA: 50,
  },
  rubric: {
    B_SHORT_ANSWER: {
      dimensions: ['Depth of Reflection', 'Growth Orientation', 'Clarity of Thought'],
      scoring: {
        0: 'No response or irrelevant answer',
        1: 'Superficial response, minimal relevance',
        2: 'General insights with some application',
        3: 'Clear, detailed reflection with relevance',
      },
      maxScorePerDimension: 3,
    },
    C_AUDIO_ROLEPLAY: {
      dimensions: ['Empathy & Tone', 'Instructional Language', 'Logical Structure'],
      scoring: {
        0: 'Insensitive or dismissive tone / No instructional terms / Completely illogical',
        1: 'Limited empathy or forced tone / Vague strategy / Weak logic',
        2: 'Generally warm and student-focused / Some relevant language / Mostly logical',
        3: 'Empathetic, calm, and appropriate / Effective vocabulary / Well-structured',
      },
      maxScorePerDimension: 3,
    },
  },
  tracks: [
    { id: 'pedagogical_mastery', name: 'Pedagogical Mastery' },
    { id: 'ai_tech_fluency', name: 'AI & Tech' },
    { id: 'inclusive_practice', name: 'Inclusive Practice' },
    { id: 'professional_identity', name: 'Professional Identity' },
    { id: 'global_citizenship', name: 'Global Citizenship' },
    { id: 'educational_foundations', name: 'Educational Foundations' },
  ],
  questions: generateQuestions(),
};

const outputPath = path.join(__dirname, '..', 'data', 'sample-competency-questions.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`Generated ${output.questions.length} questions to ${outputPath}`);
console.log('\nBreakdown:');
console.log(`  - A_MCQ: ${output.questions.filter(q => q.category === 'A_MCQ').length}`);
console.log(`  - B_SHORT_ANSWER: ${output.questions.filter(q => q.category === 'B_SHORT_ANSWER').length}`);
console.log(`  - C_AUDIO_ROLEPLAY: ${output.questions.filter(q => q.category === 'C_AUDIO_ROLEPLAY').length}`);
console.log(`  - D_SELF_PERCEPTION: ${output.questions.filter(q => q.category === 'D_SELF_PERCEPTION').length}`);
console.log(`  - E_TEACHING_DILEMMA: ${output.questions.filter(q => q.category === 'E_TEACHING_DILEMMA').length}`);
