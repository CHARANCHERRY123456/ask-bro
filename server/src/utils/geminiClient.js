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

// Function to ask Gemini
export async function askGemini(prompt) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error while communicating with Gemini:', error.message);
    throw error;
  }
}

// check askGemini
askGemini('What is the capital of France?')