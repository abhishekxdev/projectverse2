import { createOpenAI } from '@ai-sdk/openai'

/**
 * OpenAI client configuration
 * Initializes OpenAI client with API key from environment variables using AI SDK
 */

// Get OpenAI API key from environment variables
const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required but not set')
}

// Initialize OpenAI client using AI SDK
const client = createOpenAI({
  apiKey,
})

console.log('OpenAI client initialized successfully')

export { client }
export default client
