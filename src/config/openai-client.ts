import * as dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('ERROR: OPENAI_API_KEY environment variable is not set!');
  console.error('Please add OPENAI_API_KEY to your .env file');
  console.error('Example: OPENAI_API_KEY=sk-your-api-key-here');
  throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your .env file.');
}

export const openai = new OpenAI({
  apiKey,
  timeout: 30_000,
});

export const AI_CONFIG = {
  model: 'gpt-4o-mini',
  maxTutorTokens: 500,
  maxEvaluationTokens: 500,
};


export default openai;
