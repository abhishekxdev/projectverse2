/**
 * PD Module Assessment End-to-End Test Script
 * Tests the complete PD module flow from login to evaluation results
 *
 * Usage:
 *   pnpm test:pd-flow
 *   pnpm test:pd-flow -- --email=teacher@test.com --password=pass123
 *   pnpm test:pd-flow -- --module=pd-module-pedagogical_mastery
 *   pnpm test:pd-flow -- --skip-eval  # Skip evaluation step
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
const SELECTED_MODULE =
  process.argv.find((arg) => arg.startsWith('--module='))?.split('=')[1] || '';
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
let moduleId = '';
let attemptId = '';

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
 * Ensure test data directories exist
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
  metadata: Record<string, any>
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
  maxAttempts: number = 20,
  intervalMs: number = 2000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(
        `${BASE_URL}/pd/attempts/${attemptId}/result`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const result = response.data.data;
      if (result?.score !== undefined) {
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
 * Main test flow for PD modules
 */
async function testPDModuleFlow() {
  const startTime = Date.now();

  try {
    log('\n🎓 PD MODULE ASSESSMENT END-TO-END TEST\n', 'magenta');
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

    // ===== STEP 2: Get Available Modules =====
    logStep(2, 'Fetch Available PD Modules');
    const modulesResponse = await axios.get(`${BASE_URL}/pd/modules`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const modules = modulesResponse.data.data.modules || modulesResponse.data.data;
    logSuccess(`Retrieved ${modules.length} PD modules`);

    if (modules.length === 0) {
      throw new Error('No PD modules available. Please seed PD modules first.');
    }

    // Display available modules
    modules.forEach((mod: any, idx: number) => {
      logInfo(`  ${idx + 1}. ${mod.title} (${mod.id})`);
    });

    // Select module (use provided or first available)
    const selectedMod = SELECTED_MODULE
      ? modules.find((m: any) => m.id === SELECTED_MODULE)
      : modules[0];

    if (!selectedMod) {
      throw new Error(`Module not found: ${SELECTED_MODULE}`);
    }

    moduleId = selectedMod.id;
    logInfo(`\nSelected module: ${selectedMod.title}`);

    // ===== STEP 3: Get Module Details =====
    logStep(3, 'Get Module Details');
    const moduleResponse = await axios.get(`${BASE_URL}/pd/modules/${moduleId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const moduleDetails = moduleResponse.data.data;
    logSuccess('Module details retrieved');
    logInfo(`Title: ${moduleDetails.title}`);
    logInfo(`Domain: ${moduleDetails.domainKey}`);
    logInfo(`Passing Score: ${moduleDetails.passingScore}%`);
    logInfo(`Max Attempts: ${moduleDetails.maxAttempts}`);

    // ===== STEP 4: Start Module Attempt =====
    logStep(4, 'Start Module Attempt');
    const startResponse = await axios.post(
      `${BASE_URL}/pd/modules/${moduleId}/attempt/start`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const startData = startResponse.data.data;
    attemptId = startData.attemptId || startData.attempt?.id;
    const questions = startData.questions || [];
    logSuccess('Module attempt started');
    logInfo(`Attempt ID: ${attemptId}`);
    logInfo(`Generated ${questions.length} questions for this attempt`);

    if (questions.length === 0) {
      logError('No questions generated!');
      logInfo('Please run seed-pd-questions.ts to seed questions');
      throw new Error('No questions available for this module');
    }

    // ===== STEP 5: Display Question Details =====
    logStep(5, 'Question Details');
    const questionTypes = questions.reduce((acc: any, q: any) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {});
    logSuccess(`Question types: ${JSON.stringify(questionTypes)}`);
    questions.forEach((q: any, idx: number) => {
      logInfo(`  ${idx + 1}. [${q.type}] ${q.prompt?.substring(0, 50)}...`);
    });

    // ===== STEP 6: Upload Video/Audio (if available) =====
    logStep(6, 'Upload Media Responses');
    const videoQuestion = questions.find(
      (q: any) => q.type === 'VIDEO' || q.type === 'AUDIO_VIDEO'
    );
    const audioQuestion = questions.find((q: any) => q.type === 'AUDIO');

    if (testFiles.hasVideo && videoQuestion) {
      try {
        const videoResult = await uploadFileWithPresignedUrl(
          testFiles.videoPath,
          'assessment-video',
          'video/mp4',
          { attemptId, questionId: videoQuestion.id }
        );
        logSuccess('Video uploaded');
        logInfo(`S3 Key: ${videoResult.key}`);
      } catch (error) {
        logError('Video upload failed', error);
      }
    } else if (!testFiles.hasVideo) {
      logInfo('No video file at test-data/videos/sample-response.mp4 - skipping');
    } else {
      logInfo('No VIDEO questions in this attempt - skipping');
    }

    if (testFiles.hasAudio && audioQuestion) {
      try {
        const audioResult = await uploadFileWithPresignedUrl(
          testFiles.audioPath,
          'assessment-audio',
          'audio/mpeg',
          { attemptId, questionId: audioQuestion.id }
        );
        logSuccess('Audio uploaded');
        logInfo(`S3 Key: ${audioResult.key}`);
      } catch (error) {
        logError('Audio upload failed', error);
      }
    } else if (!testFiles.hasAudio) {
      logInfo('No audio file at test-data/audio/sample-response.mp3 - skipping');
    } else {
      logInfo('No AUDIO questions in this attempt - skipping');
    }

    // ===== STEP 7: Save Responses (Auto-save) =====
    logStep(7, 'Save Module Responses (Auto-save)');
    const partialResponses = questions.slice(0, 3).map((q: any) => ({
      questionId: q.id,
      answer:
        q.type === 'MCQ'
          ? q.options?.[0] || 'Option A'
          : 'Partial response demonstrating understanding of the module content.',
    }));

    await axios.post(
      `${BASE_URL}/pd/attempts/${attemptId}/responses`,
      { responses: partialResponses },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    logSuccess('Responses saved (auto-save)');
    logInfo(`Saved ${partialResponses.length} partial responses`);

    // ===== STEP 8: Submit Module Attempt =====
    logStep(8, 'Submit PD Module Attempt');
    const allResponses = questions.map((q: any, idx: number) => ({
      questionId: q.id,
      answer:
        q.type === 'MCQ'
          ? q.correctOption || q.options?.[1] || q.options?.[0] || 'Option B'
          : `Comprehensive answer for question ${idx + 1}. ` +
            `This response demonstrates deep understanding of ${moduleDetails.title}. ` +
            'I would apply these concepts in my teaching practice by implementing ' +
            'differentiated instruction strategies and using formative assessment ' +
            'to continuously improve student learning outcomes.',
    }));

    const submitResponse = await axios.post(
      `${BASE_URL}/pd/attempts/${attemptId}/submit`,
      { responses: allResponses },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    logSuccess('PD module attempt submitted');
    const submitResult = submitResponse.data.data;
    logInfo(`Status: ${submitResult.attempt?.status || submitResult.status || 'SUBMITTED'}`);

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
          `${BASE_URL}/pd/evaluate`,
          { attemptId },
          {
            headers: { Authorization: `Bearer ${adminToken}` },
            timeout: 180000, // 3 minute timeout
          }
        );

        const evalResult = evalResponse.data.data;
        logSuccess('Evaluation completed');
        if (evalResult.result) {
          logInfo(`Score: ${evalResult.result.score?.toFixed?.(2) ?? evalResult.result.score}`);
          logInfo(`Passed: ${evalResult.result.passed}`);
        }
      } catch (error: any) {
        logError('Evaluation trigger failed', error);
        logInfo('Will attempt to poll for results...');
      }
    }

    // ===== STEP 10: Get Attempt Result =====
    logStep(10, 'Retrieve Module Results');
    try {
      let finalResult;
      if (!SKIP_EVAL) {
        // Poll for results if evaluation was triggered
        logInfo('Polling for evaluation results...');
        finalResult = await pollForResults(15, 3000);
      } else {
        // Just try to get existing results
        const resultResponse = await axios.get(
          `${BASE_URL}/pd/attempts/${attemptId}/result`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        finalResult = resultResponse.data.data;
      }

      logSuccess('Results retrieved');

      console.log('\n📊 PD MODULE RESULTS');
      console.log('═'.repeat(60));
      console.log(`Module: ${moduleDetails.title}`);
      console.log(`Score: ${finalResult.score?.toFixed?.(2) ?? finalResult.score ?? 'N/A'}%`);
      console.log(`Passed: ${finalResult.passed ? 'YES' : 'NO'}`);
      console.log(`Passing Score Required: ${moduleDetails.passingScore}%`);

      if (finalResult.questionResults?.length) {
        console.log('\nQuestion Results:');
        finalResult.questionResults.slice(0, 5).forEach((qr: any, idx: number) => {
          console.log(
            `  ${idx + 1}. Score: ${qr.score}/${qr.maxScore} - ${qr.feedback?.substring(0, 50) || 'No feedback'}...`
          );
        });
        if (finalResult.questionResults.length > 5) {
          console.log(`  ... and ${finalResult.questionResults.length - 5} more`);
        }
      }

      console.log('═'.repeat(60));
    } catch (error: any) {
      if (error.response?.status === 409) {
        logInfo('Results not yet available - evaluation still pending');
        logInfo('The attempt has been submitted. Results will be available after AI evaluation completes.');
      } else {
        logError('Failed to retrieve results', error);
      }
    }

    // Success summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log('\n' + '═'.repeat(60), 'green');
    log('✅ PD MODULE E2E TEST COMPLETED', 'green');
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
testPDModuleFlow();
