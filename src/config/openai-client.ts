import * as dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
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
