import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000/api';
const TEST_EMAIL = process.env.TEST_EMAIL || 'teacher.beta.approved@gurucool.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Password123!';

async function checkResult() {
  console.log('Logging in...');
  const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  const token = authResponse.data.data.idToken || authResponse.data.data.token;
  console.log('Logged in\n');

  // Check attempts
  console.log('Fetching attempts...');
  const attemptsResponse = await axios.get(`${BASE_URL}/competency/attempts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const attempts = attemptsResponse.data.data.attempts;
  console.log(`Found ${attempts.length} attempt(s):`);
  attempts.forEach((a: any) => {
    console.log(`  - ${a.id}: ${a.status}`);
  });

  // Check result
  console.log('\nFetching result...');
  try {
    const resultResponse = await axios.get(`${BASE_URL}/competency/result`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('\n📊 Result:', JSON.stringify(resultResponse.data, null, 2));
  } catch (error: any) {
    console.log('No result yet:', error.response?.data?.error?.message || error.message);
  }
}

checkResult().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
