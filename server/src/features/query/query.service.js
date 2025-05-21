// src/query/query.service.js
import { askGemini } from '../../utils/geminiClient.js';
import pool from '../../db.js';

export async function processQuestion(question, metadata, conversationHistory = []) {

  const prompt = `
    You are a PostgreSQL expert. Generate a SQL query for this IIIT RGUKT RK Valley university database.

    IMPORTANT DATABASE CONTEXT:
    - We have 3 tables: table_a (student basic info), table_b (academic marks), table_c (branch/batch info)
    - Student IDs are in col1 of all tables (format: R200001, R210001, etc.)
    - Student names are in table_a.col2
    - Academic marks are in table_b: col15 (E1sem1), col16 (E1sem2), col17 (E2sem1)
    - Branch/department info is in table_c.col11 (values like "CSE", "Computer Science", "CS", etc.)
    - Batch info is in table_c.col18 (values like "R20", "r20", "R21", "r21")
    
    SPECIFIC INSTRUCTIONS:
    - For "top student" queries: Calculate total marks by adding col15+col16+col17 from table_b
    - For CSE students: Use WHERE UPPER(table_c.col11) LIKE ANY(ARRAY['%CS%', '%COMPUTER%'])
    - For R20 batch: Use WHERE UPPER(table_c.col18) LIKE '%R20%' OR UPPER(table_c.col18) LIKE '%20%'
    - Join tables using table_a.col1 = table_b.col1 AND table_a.col1 = table_c.col1
    - Handle NULL values with COALESCE(NULLIF(column, '')::NUMERIC, 0)

    you can use these meta data(you need to strictly follow this only) :
    Metadata: ${metadata} 
    
    Question: "${question}"
    
    Respond ONLY with the exact SQL query. No explanations or comments.
  `;

  try {
    const sqlQuery = await askGemini(prompt);
    
    const cleanedQuery = sqlQuery.replace(/```(?:sql)?|```/g, '').trim();
    console.log('Received SQL query from Gemini:', sqlQuery);


    if (!cleanedQuery || !/^(SELECT|WITH|EXPLAIN)/i.test(cleanedQuery)) {
      console.log('Invalid SQL generated, using default query');
      return generateDefaultQuery(question);
    }

    console.log('Received SQL query from Gemini:', cleanedQuery);
    return cleanedQuery;
  } catch (e) {
    console.error('Error while getting SQL from Gemini:', e.message);
    return generateDefaultQuery(question);
  }
}

function generateDefaultQuery(question) {
  const isTopStudentQuery = /top|best|highest|first/i.test(question);
  const isCSEQuery = /cse|computer|cs/i.test(question);
  const isR20Query = /r20|20/i.test(question);

  if (isTopStudentQuery && isCSEQuery && isR20Query) {
    return `
      WITH student_marks AS (
        SELECT 
          UPPER(a.col1) AS student_id,
          a.col2 AS student_name,
          COALESCE(NULLIF(b.col15, '')::NUMERIC, 0) + 
          COALESCE(NULLIF(b.col16, '')::NUMERIC, 0) + 
          COALESCE(NULLIF(b.col17, '')::NUMERIC, 0) AS total_marks
        FROM 
          table_a a
          JOIN table_b b ON UPPER(a.col1) = UPPER(b.col1)
          JOIN table_c c ON UPPER(a.col1) = UPPER(c.col1)
        WHERE 
          (UPPER(c.col11) LIKE '%CS%' OR UPPER(c.col11) LIKE '%COMPUTER%') AND
          (UPPER(c.col18) LIKE '%R20%' OR UPPER(c.col18) LIKE '%20%')
      )
      SELECT 
        student_id,
        student_name,
        total_marks,
        RANK() OVER (ORDER BY total_marks DESC) AS rank
      FROM 
        student_marks
      ORDER BY 
        total_marks DESC
      LIMIT 1;
    `;
  }

  return `
    SELECT 
      a.col1 AS student_id,
      a.col2 AS student_name,
      c.col11 AS branch,
      c.col18 AS batch,
      COALESCE(NULLIF(b.col15, '')::NUMERIC, 0) + 
      COALESCE(NULLIF(b.col16, '')::NUMERIC, 0) + 
      COALESCE(NULLIF(b.col17, '')::NUMERIC, 0) AS total_marks
    FROM 
      table_a a
      JOIN table_b b ON UPPER(a.col1) = UPPER(b.col1)
      JOIN table_c c ON UPPER(a.col1) = UPPER(c.col1)
    ORDER BY 
      total_marks DESC
    LIMIT 10;
  `;
}

export async function executeSQL(sqlQuery) {

  try {
    await pool.query('SET statement_timeout = 300000');
    const result = await pool.query(sqlQuery);
    console.log('Query executed successfully. Rows returned:', result.rows.length);
    await pool.query('SET statement_timeout = 30000');
    return result.rows;
  } catch (e) {
    console.error('Error while executing SQL query:', e.message);
    await pool.query('SET statement_timeout = 30000');
    throw new Error('PostgreSQL query failed: ' + e.message);
  }
}

export async function generateAnswerFromResults(sqlQuery, rows, question) {
  // console.log('generateAnswerFromResults called with:', { sqlQueryLength: sqlQuery.length, rowCount: rows.length, question });

  const prompt = `
    You are Linga, a 21-year-old data analyst assistant at IIIT RGUKT RK Valley.

    Your task:
    - Answer the user's question in a concise, accurate, and friendly manner based on the data provided.
    - Sound like a real 21-year-old college student, not an AI. Use casual but professional language.
    - DO NOT mention SQL, database, or technical terms like "query" or "results".
    - DO NOT mention that you're an AI or that you're generating a response.
    - If the data shows a student's rank, describe their performance in context (e.g., "top performer", "average student", etc.)
    - For name searches, be conversational (e.g., "Ragamalika is ranked 121 out of 360 students in CSE R20 batch")
    - Handle complex relationships, aggregations, and comparisons in the data.
    - If applicable, include a visualization description as JSON.
    - Ensure the response is user-friendly and avoids technical jargon.
    - Return ONLY a valid JSON object (no explanations, no markdown).

    For visualizations:
    - For rank queries: Include a bar chart showing the student's position relative to others
    - For top student queries: Include a bar chart of top performers
    - For branch comparisons: Include a pie or bar chart showing distribution
    - For performance trends: Include a line chart showing progression

    JSON format:
    {
      "content": "string, the natural language answer to the user's question",
      "visualizations": {
        "type": "chart type (pie, bar, line, etc.)",
        "title": "chart title",
        "labels": [...],
        "values": [...]
      },
      "data": [...],  // optional tabular data, can be the rows or subset
      "question": "${question}"
    }

    User's Question: "${question}"

    Data:
    ${rows.length <= 50 ? JSON.stringify(rows, null, 2) : `The query returned ${rows.length} rows. Here's a summary: First few rows: ${JSON.stringify(rows.slice(0, 3))}, Last few rows: ${JSON.stringify(rows.slice(-3))}`}
  `;

  try {
    const geminiResponse = await askGemini(prompt);
    console.log('Gemini response:', geminiResponse);
    const cleanedResponse = geminiResponse.replace(/```(?:json)?|``````json|```/g, '');

    return JSON.parse(cleanedResponse);
  } catch (e) {
    console.error('Error while processing Gemini response:', e.message);
    return {
      content: "I found some information based on your question, but I'm having trouble formatting it nicely. Here's what I know: " + 
              (rows.length > 0 ? `I found ${rows.length} records that match your query.` : "I couldn't find any records matching your criteria."),
      data: rows.slice(0, 20),
      question: question
    };
  }
}
