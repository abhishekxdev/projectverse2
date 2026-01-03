import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000/api';
const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'admin@gurucool.ai';
const ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || 'Password123!';
const ATTEMPT_ID = process.argv[2] || 'AkKQ5JiNXJsTureL07IP';

async function triggerEval() {
  console.log('Logging in as admin...');
  const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const token = authResponse.data.data.idToken || authResponse.data.data.token;
  console.log('Admin logged in\n');

  console.log(`Triggering evaluation for attempt: ${ATTEMPT_ID}`);
  console.log('This may take 1-2 minutes...\n');

  try {
    const evalResponse = await axios.post(
      `${BASE_URL}/competency/evaluate`,
      { attemptId: ATTEMPT_ID },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 180000, // 3 minute timeout
      }
    );
    console.log('\n📊 Evaluation Result:', JSON.stringify(evalResponse.data, null, 2));
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.log('Request timed out after 3 minutes');
      console.log('The evaluation may still be running in the background.');
    } else {
      console.log('Error:', error.response?.data || error.message);
    }
  }
}

triggerEval().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
