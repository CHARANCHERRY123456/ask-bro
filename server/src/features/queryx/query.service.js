import { askGemini } from '../../utils/geminiClient.js';

async function getsqlFromGemini(prompt) {
  const geminiReply = await askGemini(prompt);

  const cleanedQuery = geminiReply
    .replace(/^```sql\s*/i, '')
    .replace(/```$/, '')
    .trim();

  return cleanedQuery;
}


export async function processQuestion(question, metadata) {
  const prompt = `
    You are a SQL expert and assistant helping to generate SQL queries for a complex, messy database with the following challenges:
    - Tables and columns have unclear or missing names.
    - Data contains nulls, missing values, and inconsistencies.
    - The schema is not clean and might have errors or duplicates.
    - Metadata with correct table and column mappings is provided and must be used exactly.

    Your task:
    1. Generate a valid, executable SQL query that answers the given natural language question.
    2. Use ONLY the real table and column names from the metadata provided.
    3. Include necessary filters to handle null or dirty data gracefully (e.g., exclude nulls if relevant).
    4. Use safe SQL constructs to avoid runtime errors.
    5. Return ONLY the SQL query string, without any explanation, markdown, or extra text.
    6. The SQL must be compatible with PostgreSQL.
    7. If you stuck any where just ask again but don't cause me the run time errors.

    Question: "${question}"
    Metadata: ${JSON.stringify(metadata)}
    in the meta table name and a description of the column name and its data type. and information about the table name and its data type.
    Example : tablename : {
      column_name : description of that column based on this description you need to give the information
    }

    Respond ONLY with the SQL query string you don't have to answer for the question just give sql query .
  `;
  

  let geminiReply = '';
  try {
    // geminiReply = await getsqlFromGemini(prompt);
    geminiReply = `SELECT
  CASE
    WHEN COUNT(*) > 0
    THEN TRUE
    ELSE FALSE
  END
FROM table_a
WHERE
  UPPER(col2) LIKE UPPER('%charan%')`
    console.log("is the gemini reply query", geminiReply);
    
  } catch (error) {
    console.error('Error calling Gemini:', error);
    throw new Error('Failed to get SQL from Gemini');
  }

  if (!geminiReply || geminiReply.trim() === '') {
    throw new Error('Gemini returned an empty SQL response. Please try rephrasing the question.');
  }
  return geminiReply;
}



