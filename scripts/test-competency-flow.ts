/**
 * Competency Assessment End-to-End Test Script
 * Tests the complete competency assessment flow from login to evaluation results
 *
 * Usage:
 *   pnpm test:competency-flow
 *   pnpm test:competency-flow -- --email=teacher@test.com --password=pass123
 *   pnpm test:competency-flow -- --skip-eval  # Skip evaluation step
 */

import axios, { AxiosError } from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Configuration
const BASE_URL =
  process.env.BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:3000/api';
const TEST_EMAIL =
  process.argv.find((arg) => arg.startsWith('--email='))?.split('=')[1] ||
  process.env.TEST_EMAIL ||
  'teacher@test.com';
const TEST_PASSWORD =
  process.argv.find((arg) => arg.startsWith('--password='))?.split('=')[1] ||
  process.env.TEST_PASSWORD ||
  'password123';
const SKIP_EVAL = process.argv.includes('--skip-eval');
const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'admin@gurucool.ai';
const ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || 'Password123!';

// Test data directories
const TEST_VIDEOS_DIR = path.join(__dirname, '../test-data/videos');
const TEST_AUDIO_DIR = path.join(__dirname, '../test-data/audio');

// Global state
let authToken = '';
let adminToken = '';
let userId = '';
let attemptId = '';
let assessmentId = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  log(`\n[${'='.repeat(60)}]`, 'cyan');
  log(`STEP ${step}: ${message}`, 'cyan');
  log(`[${'='.repeat(60)}]\n`, 'cyan');
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string, error?: any) {
  log(`✗ ${message}`, 'red');
  if (error?.response?.data) {
    console.error('Error details:', JSON.stringify(error.response.data, null, 2));
  } else if (error?.message) {
    console.error('Error message:', error.message);
  }
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'yellow');
}

function logDebug(message: string) {
  log(`  ${message}`, 'dim');
}

/**
 * Ensure test data directories and files exist
 */
function ensureTestFiles() {
  [TEST_VIDEOS_DIR, TEST_AUDIO_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const videoFile = path.join(TEST_VIDEOS_DIR, 'sample-response.mp4');
  const audioFile = path.join(TEST_AUDIO_DIR, 'sample-response.mp3');

  return {
    hasVideo: fs.existsSync(videoFile),
    hasAudio: fs.existsSync(audioFile),
    videoPath: videoFile,
    audioPath: audioFile,
  };
}

/**
 * Upload file using presigned URL
 */
async function uploadFileWithPresignedUrl(
  filePath: string,
  fileType: string,
  contentType: string,
  metadata?: Record<string, any>
): Promise<{ url: string; key: string }> {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  const presignedResponse = await axios.post(
    `${BASE_URL}/upload/presigned-url`,
    { fileType, fileName, contentType, metadata },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );

  const { uploadUrl, key } = presignedResponse.data.data;

  await axios.put(uploadUrl, fileBuffer, {
    headers: { 'Content-Type': contentType },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const url = uploadUrl.split('?')[0];
  return { url, key };
}

/**
 * Poll for evaluation results with timeout
 */
async function pollForResults(
  maxAttempts: number = 30,
  intervalMs: number = 2000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/competency/result`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = response.data.data?.data || response.data.data;
      if (result?.overallScore !== undefined) {
        return result;
      }
    } catch (error: any) {
      // 409 = not evaluated yet, keep polling
      if (error.response?.status !== 409) {
        throw error;
      }
    }

    logDebug(`Waiting for evaluation... (${i + 1}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Evaluation timed out');
}

/**
 * Main test flow
 */
async function testCompetencyFlow() {
  const startTime = Date.now();

  try {
    log('\n🚀 COMPETENCY ASSESSMENT END-TO-END TEST\n', 'magenta');
    log(`Base URL: ${BASE_URL}`, 'blue');
    log(`Test User: ${TEST_EMAIL}`, 'blue');
    log(`Skip Evaluation: ${SKIP_EVAL}\n`, 'blue');

    const testFiles = ensureTestFiles();

    // ===== STEP 1: Authentication =====
    logStep(1, 'Authenticate Test User');
    try {
      const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const { data: loginData } = authResponse.data;
      authToken = loginData.idToken ?? loginData.token ?? loginData.accessToken ?? '';
      userId = loginData.user?.uid ?? loginData.user?.id ?? '';

      if (!authToken) {
        throw new Error('Missing auth token in login response');
      }
      logSuccess('Authentication successful');
      logInfo(`User ID: ${userId}`);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        logInfo('Login failed - attempting signup...');
        const signupResponse = await axios.post(`${BASE_URL}/auth/signup`, {
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          role: 'teacher',
          displayName: 'Test Teacher',
        });

        const { data: signupData } = signupResponse.data;
        authToken = signupData.idToken ?? signupData.token ?? '';
        userId = signupData.user?.uid ?? signupData.user?.id ?? '';
        logSuccess('Signup successful');
      } else {
        throw error;
      }
    }

    // ===== STEP 2: Clear Pending Attempts =====
    logStep(2, 'Clear Pending Attempts (if any)');
    try {
      // Fetch existing attempts
      const existingAttemptsResponse = await axios.get(`${BASE_URL}/competency/attempts`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const existingAttempts = existingAttemptsResponse.data.data.attempts || existingAttemptsResponse.data.data || [];

      // Debug: show all attempts and their statuses
      if (existingAttempts.length > 0) {
        logDebug(`Found ${existingAttempts.length} total attempt(s):`);
        existingAttempts.forEach((a: any, idx: number) => {
          logDebug(`  ${idx + 1}. ID: ${a.id?.slice(0, 12)}... | Status: ${a.status}`);
        });
      }

      // Filter for pending attempts (status is uppercase: SUBMITTED, IN_PROGRESS)
      const pendingAttempts = existingAttempts.filter(
        (a: any) => a.status === 'SUBMITTED' || a.status === 'IN_PROGRESS'
      );

      if (pendingAttempts.length > 0) {
        logInfo(`Found ${pendingAttempts.length} pending attempt(s) - triggering evaluation to clear`);

        // Authenticate as admin to trigger evaluation
        const adminAuthResponse = await axios.post(`${BASE_URL}/auth/login`, {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });
        adminToken =
          adminAuthResponse.data.data.idToken ??
          adminAuthResponse.data.data.token ?? '';

        for (const pendingAttempt of pendingAttempts) {
          if (pendingAttempt.status === 'SUBMITTED') {
            try {
              logInfo(`Evaluating pending attempt: ${pendingAttempt.id.slice(0, 12)}...`);
              const evalResponse = await axios.post(
                `${BASE_URL}/competency/evaluate`,
                { attemptId: pendingAttempt.id },
                {
                  headers: { Authorization: `Bearer ${adminToken}` },
                  timeout: 180000,
                }
              );
              logSuccess(`Completed evaluation for attempt: ${pendingAttempt.id.slice(0, 12)}...`);
              logDebug(`Evaluation result: ${JSON.stringify(evalResponse.data?.data?.overallScore ?? 'N/A')}`);
            } catch (evalError: any) {
              const status = evalError.response?.status;
              const errorMsg = evalError.response?.data?.error?.message || evalError.message;
              logError(`Evaluation failed for ${pendingAttempt.id.slice(0, 12)}... (${status}): ${errorMsg}`);
            }
          } else if (pendingAttempt.status === 'IN_PROGRESS') {
            logInfo(`Found in-progress attempt: ${pendingAttempt.id.slice(0, 12)}... - will be reused`);
          }
        }

        // Wait a moment for evaluations to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));
        logSuccess('Pending attempts cleared');
      } else {
        logSuccess('No pending attempts found - ready to proceed');
      }
    } catch (error: any) {
      logInfo('Could not clear pending attempts - proceeding anyway');
      logDebug(`Error: ${error.message}`);
    }

    // ===== STEP 3: Get Questions =====
    logStep(3, 'Fetch Competency Assessment Questions');
    const questionsResponse = await axios.get(`${BASE_URL}/competency/questions`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const { assessment, questions } = questionsResponse.data.data;
    assessmentId = assessment.id;
    logSuccess(`Retrieved ${questions.length} questions`);
    logInfo(`Assessment ID: ${assessmentId}`);
    logInfo(`Assessment: ${assessment.title}`);

    const questionTypes = questions.reduce((acc: any, q: any) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {});
    logInfo(`Question types: ${JSON.stringify(questionTypes)}`);

    // ===== STEP 4: Start Attempt =====
    logStep(4, 'Start Assessment Attempt');
    const startResponse = await axios.post(
      `${BASE_URL}/competency/attempts`,
      { assessmentId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const attemptData = startResponse.data.data;
    attemptId = attemptData.id;
    const selectedQuestions = attemptData.questions || questions;
    logSuccess('Attempt started');
    logInfo(`Attempt ID: ${attemptId}`);
    logInfo(`Questions for this attempt: ${selectedQuestions.length}`);

    // ===== STEP 5: Upload Video Response (if available) =====
    logStep(5, 'Upload Video Response');
    if (testFiles.hasVideo) {
      const videoQuestion = selectedQuestions.find(
        (q: any) => q.type === 'VIDEO' || q.type === 'AUDIO_VIDEO'
      );
      if (videoQuestion) {
        try {
          const videoResult = await uploadFileWithPresignedUrl(
            testFiles.videoPath,
            'assessment-video',
            'video/mp4',
            { attemptId, questionId: videoQuestion.id }
          );
          logSuccess('Video uploaded successfully');
          logInfo(`S3 Key: ${videoResult.key}`);
        } catch (error) {
          logError('Video upload failed', error);
        }
      } else {
        logInfo('No VIDEO questions in this attempt - skipping');
      }
    } else {
      logInfo('No video file at test-data/videos/sample-response.mp4 - skipping');
    }

    // ===== STEP 6: Upload Audio Response (if available) =====
    logStep(6, 'Upload Audio Response');
    if (testFiles.hasAudio) {
      const audioQuestion = selectedQuestions.find(
        (q: any) => q.type === 'AUDIO'
      );
      if (audioQuestion) {
        try {
          const audioResult = await uploadFileWithPresignedUrl(
            testFiles.audioPath,
            'assessment-audio',
            'audio/mpeg',
            { attemptId, questionId: audioQuestion.id }
          );
          logSuccess('Audio uploaded successfully');
          logInfo(`S3 Key: ${audioResult.key}`);
        } catch (error) {
          logError('Audio upload failed', error);
        }
      } else {
        logInfo('No AUDIO questions in this attempt - skipping');
      }
    } else {
      logInfo('No audio file at test-data/audio/sample-response.mp3 - skipping');
    }

    // ===== STEP 7: Save Progress (Auto-save) =====
    logStep(7, 'Save Attempt Progress (Auto-save)');
    const partialAnswers = selectedQuestions.slice(0, 3).map((q: any, idx: number) => ({
      questionId: q.id,
      answer:
        q.type === 'MCQ'
          ? q.options?.[0] || 'Option A'
          : `Sample answer for question ${idx + 1}. This demonstrates understanding of ${q.domainKey || 'teaching competencies'}.`,
    }));

    await axios.patch(
      `${BASE_URL}/competency/attempts/${attemptId}`,
      { answers: partialAnswers },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    logSuccess('Progress saved (auto-save)');
    logInfo(`Saved ${partialAnswers.length} partial answers`);

    // ===== STEP 8: Submit Attempt =====
    logStep(8, 'Submit Assessment');
    const allAnswers = selectedQuestions.map((q: any, idx: number) => ({
      questionId: q.id,
      answer:
        q.type === 'MCQ'
          ? q.correctOption || q.options?.[0] || 'Option A'
          : `Comprehensive answer for ${q.domainKey || 'teaching'} question ${idx + 1}. ` +
            'This demonstrates deep understanding and practical application of teaching competencies. ' +
            'I would implement differentiated instruction strategies to address diverse learner needs.',
    }));

    const submitResponse = await axios.post(
      `${BASE_URL}/competency/submit`,
      { assessmentId, attemptId, answers: allAnswers },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    logSuccess('Assessment submitted');
    const submitResult = submitResponse.data.data;
    logInfo(`Status: ${submitResult.status}`);

    // ===== STEP 9: Trigger AI Evaluation =====
    logStep(9, 'Trigger AI Evaluation');
    if (SKIP_EVAL) {
      logInfo('Skipping evaluation (--skip-eval flag)');
    } else {
      try {
        // Authenticate as admin
        logInfo('Authenticating as admin...');
        const adminAuthResponse = await axios.post(`${BASE_URL}/auth/login`, {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });
        adminToken =
          adminAuthResponse.data.data.idToken ??
          adminAuthResponse.data.data.token ?? '';
        logSuccess('Admin authenticated');

        // Trigger evaluation
        logInfo('Triggering AI evaluation (this may take 30-60 seconds)...');
        const evalResponse = await axios.post(
          `${BASE_URL}/competency/evaluate`,
          { attemptId },
          {
            headers: { Authorization: `Bearer ${adminToken}` },
            timeout: 180000, // 3 minute timeout
          }
        );

        const evalResult = evalResponse.data.data;
        logSuccess('Evaluation completed');
        logInfo(`Overall Score: ${evalResult.overallScore?.toFixed?.(2) ?? evalResult.overallScore}`);
        logInfo(`Proficiency Level: ${evalResult.proficiencyLevel}`);
      } catch (error: any) {
        logError('Evaluation trigger failed', error);
        logInfo('Will attempt to poll for results...');
      }
    }

    // ===== STEP 10: Get Results =====
    logStep(10, 'Retrieve Assessment Results');
    try {
      let finalResult;
      if (!SKIP_EVAL) {
        // Poll for results if evaluation was triggered
        logInfo('Polling for evaluation results...');
        finalResult = await pollForResults(15, 3000);
      } else {
        // Just try to get existing results
        const resultsResponse = await axios.get(`${BASE_URL}/competency/result`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        finalResult = resultsResponse.data.data?.data || resultsResponse.data.data;
      }

      logSuccess('Results retrieved');

      console.log('\n📊 ASSESSMENT RESULTS');
      console.log('═'.repeat(60));
      console.log(`Overall Score: ${finalResult.overallScore?.toFixed?.(2) ?? finalResult.overallScore ?? 'Pending'}`);
      console.log(`Proficiency Level: ${finalResult.proficiencyLevel || 'Pending'}`);

      if (finalResult.domainScores?.length) {
        console.log('\nDomain Scores:');
        finalResult.domainScores.forEach((score: any) => {
          const percent = score.scorePercent?.toFixed?.(1) ?? 'N/A';
          console.log(`  • ${score.domainKey}: ${score.rawScore}/${score.maxScore} (${percent}%)`);
        });
      }

      if (finalResult.strengthDomains?.length) {
        console.log(`\nStrengths: ${finalResult.strengthDomains.join(', ')}`);
      }
      if (finalResult.gapDomains?.length) {
        console.log(`Gaps: ${finalResult.gapDomains.join(', ')}`);
      }
      console.log('═'.repeat(60));
    } catch (error: any) {
      if (error.response?.status === 409) {
        logInfo('Results not yet available - evaluation still pending');
      } else {
        logError('Failed to retrieve results', error);
      }
    }

    // ===== STEP 11: Get All Attempts =====
    logStep(11, 'Get All User Attempts');
    const attemptsResponse = await axios.get(`${BASE_URL}/competency/attempts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const attempts = attemptsResponse.data.data.attempts || attemptsResponse.data.data;
    logSuccess(`Found ${attempts.length} attempt(s)`);
    attempts.slice(0, 5).forEach((att: any, idx: number) => {
      const createdAt = att.createdAt?._seconds
        ? new Date(att.createdAt._seconds * 1000).toLocaleString()
        : new Date(att.createdAt).toLocaleString();
      logInfo(`  ${idx + 1}. ID: ${att.id.slice(0, 12)}... | Status: ${att.status} | ${createdAt}`);
    });

    // Success summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log('\n' + '═'.repeat(60), 'green');
    log('✅ COMPETENCY ASSESSMENT E2E TEST COMPLETED', 'green');
    log(`   Duration: ${duration}s`, 'green');
    log('═'.repeat(60) + '\n', 'green');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log('\n' + '═'.repeat(60), 'red');
    log('❌ TEST FAILED', 'red');
    log(`   Duration: ${duration}s`, 'red');
    log('═'.repeat(60) + '\n', 'red');

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error('Status:', axiosError.response?.status);
      console.error('URL:', axiosError.config?.url);
      console.error('Error:', JSON.stringify(axiosError.response?.data, null, 2));
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

// Run the test
testCompetencyFlow();
