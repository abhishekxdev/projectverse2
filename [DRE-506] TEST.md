# PD Assessment Engine for AI Tutor Modules

**Description**
Implement a complete backend for PD module assessments, including AI-generated questions, attempt management, AI evaluation, result handling, and integration with learning paths and AI Tutor. Teachers should be able to start, attempt, submit, and receive results for each module, with AI Tutor and learning path progress updated accordingly.

## Subtasks

- [ ] **AI-Generated Questions**
  - [ ] Implement `aiQuestionGenerator.service` to generate module-specific questions using an AI model (e.g., OpenAI).
  - [ ] Add API: `POST /api/pd/modules/:moduleId/generate-questions` to trigger generation, with parameters for difficulty and question types.
  - [ ] Store generated questions in `pdQuestions` collection, linked to the module and attempt.​
- [ ] **Attempt Management**
  - [ ] Create `pdAttempts` collection: `{ id, teacherId, moduleId, status, attemptNumber, responses[], score, passed, createdAt, submittedAt, evaluatedAt }`.
  - [ ] Implement `pdAssessment.service`:
    - [ ] `startAttempt(teacherId, moduleId)` – validates module access and attempt limits.
    - [ ] `saveResponse(attemptId, questionId, payload)` – upserts responses.
    - [ ] `submitAttempt(attemptId)` – locks responses, marks as submitted, enqueues for evaluation.​
- [ ] **AI Evaluation**
  - [ ] Implement `pdEvaluationEngine.evaluate(attemptId)`:
    - [ ] Scores MCQs locally; evaluates short/AV responses using AI rubric.
    - [ ] Calculates total score and determines pass/fail based on module passing criteria.
    - [ ] Writes result back into `pdAttempts` and emits events for badges/certificates.​
- [ ] **Learning Path Integration**
  - [ ] On module completion (pass):
    - [ ] Update `learningPaths.currentModuleIndex` to unlock the next module.
    - [ ] Emit event `MODULE_COMPLETED` for AI Tutor to adjust context.
  - [ ] On module failure:
    - [ ] Increment `attemptNumber`; if `maxAttempts` reached, mark module as locked for cooldown.​
- [ ] **APIs**
  - [ ] `GET /api/pd/modules/:moduleId/questions` – fetch questions for the module.
  - [ ] `POST /api/pd/modules/:moduleId/attempt/start` – start a new attempt.
  - [ ] `POST /api/pd/attempts/:attemptId/responses` – save responses.
  - [ ] `POST /api/pd/attempts/:attemptId/submit` – submit for evaluation.
  - [ ] `GET /api/pd/attempts/:attemptId/result` – get result (score, pass/fail, feedback).
  - [ ] All APIs require teacher authentication and module access checks.​

## Acceptance Criteria

* Teachers can start, attempt, and submit PD module assessments.
* Questions are AI-generated and stored for each attempt.
* AI evaluates responses and determines pass/fail.
* Learning path and AI Tutor progress are updated based on results.
* Admins can review and approve AI-generated questions.
* Attempts are limited per module; modules are locked after max attempts.
* Results are returned with detailed feedback and scores

## Happy Path

* Teacher starts assessment for a module.
* AI generates questions, which are presented in the UI.
* Teacher answers and submits.
* AI evaluates responses and returns a result.
* If passed, the next module is unlocked; if failed, attempts are tracked and module may be locked after max attempts.

---

## Sad Paths

* AI question generation fails → fallback to cached questions or retry.
* AI evaluation fails → MCQ-only score used with minimal feedback.
* Module locked after max attempts → teacher sees cooldown timer and cannot start a new attempt until unlocked.

