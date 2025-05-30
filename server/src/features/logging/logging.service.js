// src/logging/logging.service.js
import pool from '../../db.js';

// Create logging table if it doesn't exist
export async function initLoggingTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS query_logs (
        id SERIAL PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        question TEXT NOT NULL,
        sql_query TEXT,
        result TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL
      );
    `);
    console.log('Logging table initialized');
  } catch (error) {
    console.error('Error initializing logging table:', error);
  }
}

// Log a query
export async function logQuery(logData) {
  try {
    await pool.query(`
      INSERT INTO query_logs (conversation_id, question, sql_query, result, timestamp)
      VALUES ($1, $2, $3, $4, $5);
    `, [
      logData.conversationId,
      logData.question,
      logData.sql,
      logData.result,
      logData.timestamp
    ]);
    console.log('Query logged successfully');
  } catch (error) {
    console.error('Error logging query:', error);
  }
}

// Get query history for a conversation
export async function getQueryHistory(conversationId, limit = 5) {
  try {
    const result = await pool.query(`
      SELECT question, sql_query, result, timestamp
      FROM query_logs
      WHERE conversation_id = $1
      ORDER BY timestamp DESC
      LIMIT $2;
    `, [conversationId, limit]);
    
    return result.rows.map(row => ({
      question: row.question,
      response: row.result === 'success' ? 'Found relevant information' : 'No data found',
      timestamp: row.timestamp
    }));
  } catch (error) {
    console.error('Error getting query history:', error);
    return [];
  }
}
// 1747484782039