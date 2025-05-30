import { processQuestion } from './query.service.js';
import { fetchMetadata } from '../metadata/metadata.service.js';
import pool from '../../db.js';


export async function handleUserQuery(req, res) {
  const { question } = req.body;


  if (!question || typeof question !== 'string') {
    console.error('Invalid question format:', question);
    return res.status(400).json({ error: 'Invalid question format' });
  }

  try {
    const metadata = await fetchMetadata();

    const sql = await processQuestion(question, metadata);

    if (!sql) {
      console.error('❌ AI failed to generate a valid SQL query.');
      return res.status(400).json({ error: 'Could not generate a valid SQL query.' });
    }

    
    console.log('📊 Executing SQL query on the database...');
    const result = await pool.query(sql);
    console.log('✅ SQL query executed successfully.');
    
    const table = result.rows;


    return res.status(200).json({
      sql,
      response: 'Query executed successfully',
      chart: { type: 'none', labels: [], values: [] },
      table
    });

  } catch (err) {
    console.error('❌ Error in /api/query:', err.message);
    res.status(500).json({
      error: 'Unable to process the question. Please rephrase or check logs.',
      details: err.message
    });
  }
}
