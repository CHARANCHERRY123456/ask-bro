// src/query/query.controller.js
import { processQuestion, executeSQL, generateAnswerFromResults } from './query.service.js';
import { fetchMetadata } from '../metadata/metadata.service.js';
import { logQuery, getQueryHistory } from '../logging/logging.service.js';

export async function handleQueryRequest(req, res) {
  console.log("Received query request:", req.body);

  const { question, conversationId } = req.body;
  console.log("Extracted question:", question);

  if (!question || typeof question !== 'string') {
    console.error("Invalid question format:", question);
    return res.status(400).json({ error: 'Question is required as a string.' });
  }

  try {
    console.log("Fetching metadata...");
    const metadata = await fetchMetadata();
    console.log("Metadata fetched successfully");

    // Get conversation history if available
    const conversationHistory = conversationId ? 
      await getQueryHistory(conversationId, 5) : // Get last 5 exchanges
      [];
    
    // Step 1: Generate SQL from question
    console.log("Processing question to generate SQL...");
    let sql;
    try {
      sql = await processQuestion(question, metadata, conversationHistory);
      console.log("Generated SQL query:", sql);
    } catch (sqlGenerationError) {
      console.error("Error generating SQL:", sqlGenerationError);
      
      // Return a friendly error message
      return res.status(200).json({ 
        error: 'Failed to generate SQL query',
        content: "I'm not sure how to answer that question with the data I have. Could you please rephrase it or provide more details about what you're looking for?",
        sql: null,
        data: null,
        visualizations: null
      });
    }

    // Step 2: Execute SQL on PostgreSQL
    console.log("Executing SQL query...");
    let rows;
    try {
      rows = await executeSQL(sql);
      console.log(`SQL execution results: ${rows.length} rows returned`);
    } catch (executionError) {
      console.error("Error executing SQL query:", executionError);
      
      // Retry with a simplified approach
      console.log("Retrying with a more robust SQL generation approach...");
      try {
        // Add a retry hint to the question
        const retryQuestion = `${question} (Please generate a simpler query focusing on exact matches only)`;
        const retrysql = await processQuestion(retryQuestion, metadata, conversationHistory);
        console.log("Retry generated SQL query:", retrysql);
        rows = await executeSQL(retrysql);
        sql = retrysql; // Update the SQL query to the successful one
        console.log(`SQL execution results after retry: ${rows.length} rows returned`);
      } catch (retryError) {
        console.error("Error on retry execution:", retryError);
        
        // Return a friendly error message
        return res.status(200).json({ 
          error: 'Failed to execute SQL query',
          content: "I understand what you're asking, but I'm having trouble retrieving that specific information. Could you try asking about a different aspect or provide more details?",
          sql: sql,
          data: null,
          visualizations: null
        });
      }
    }

    // Step 3: Generate natural language + visualizations JSON from results
    console.log("Generating answer JSON from results...");
    const answerJson = await generateAnswerFromResults(sql, rows, question);
    console.log("Answer JSON generated successfully");

    // Log the successful query
    if (conversationId) {
      await logQuery({
        conversationId,
        question,
        sql,
        result: rows.length > 0 ? 'success' : 'no_data',
        timestamp: new Date()
      });
    }

    // Step 4: Send JSON response to frontend
    console.log("Sending response to frontend...");
    res.json({
      ...answerJson,
      sql: sql,
      error: null
    });

  } catch (error) {
    console.error("Error occurred during query handling:", error);
    
    // Return a friendly error message
    res.status(200).json({ 
      error: error.message,
      content: "I ran into a problem while processing your question. Could you try asking something else?",
      sql: null,
      data: null,
      visualizations: null
    });
  }
}

// comment is added to handle conversation start

export async function handleConversationStart(req, res) {
  try {
    const conversationId = Date.now().toString();
    res.json({ conversationId });
  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({ error: error.message });
  }
}
