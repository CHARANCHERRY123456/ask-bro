// src/utils/geminiClient.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.0-flash-exp';
const MAX_TOKENS = 100000; // Allow for very large responses
const TEMPERATURE = 0.2; // Lower temperature for more deterministic responses

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Create a cache directory if it doesn't exist
const CACHE_DIR = path.join(__dirname, '../cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Function to generate a cache key from a prompt
function generateCacheKey(prompt) {
  return Buffer.from(prompt).toString('base64').replace(/[/+=]/g, '_');
}

// Function to check if a cached response exists
function getCachedResponse(prompt) {
  const cacheKey = generateCacheKey(prompt);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  if (fs.existsSync(cachePath)) {
    try {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      // Only use cache if it's less than 1 hour old
      if (Date.now() - cacheData.timestamp < 3600000) {
        console.log('Using cached response');
        return cacheData.response;
      }
    } catch (error) {
      console.error('Error reading cache:', error);
    }
  }
  
  return null;
}

// Function to cache a response
function cacheResponse(prompt, response) {
  const cacheKey = generateCacheKey(prompt);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    fs.writeFileSync(cachePath, JSON.stringify({
      timestamp: Date.now(),
      response
    }));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
}

// Function to ask Gemini with retries and caching
export async function askGemini(prompt, useCache = true) {
  // Check cache first if enabled
  if (useCache) {
    const cachedResponse = getCachedResponse(prompt);
    if (cachedResponse) return cachedResponse;
  }
  
  // Configure the model
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: TEMPERATURE
    }
  });
  
  let retries = 0;
  let lastError = null;
  
  while (retries < MAX_RETRIES) {
    try {
      console.log(`Attempt ${retries + 1} to get response from Gemini`);
      
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      // Cache the successful response
      if (useCache) {
        cacheResponse(prompt, response);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${retries + 1} failed:`, error.message);
      
      // If error is related to content filtering, try to modify the prompt
      if (error.message.includes('content filtered') || error.message.includes('safety')) {
        prompt = `${prompt}\n\nPlease ensure your response is professional and appropriate.`;
      }
      
      retries++;
      
      // Wait before retrying
      if (retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
      }
    }
  }
  
  throw new Error(`Failed after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`);
}
