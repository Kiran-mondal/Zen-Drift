import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());

// ডাটাবেজ টেবিল অটো-ইনিশিয়ালাইজ করার লজিক
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboards (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(100) UNIQUE NOT NULL,
        username VARCHAR(50) NOT NULL,
        score INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error("DB Init Error:", err.message);
  }
}

// প্রতিবার রিকোয়েস্ট আসলে টেবিল চেক করবে
app.use(async (req, res, next) => {
  await initDb();
  next();
});

// স্কোর সাবমিট API
app.post('/api/score', async (req, res) => {
  const { username, score, deviceId } = req.body;
  if (!username || typeof score !== 'number' || !deviceId) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  try {
    const result = await pool.query(`
      INSERT INTO leaderboards (device_id, username, score) 
      VALUES ($1, $2, $3)
      ON CONFLICT (device_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        score = CASE WHEN EXCLUDED.score > leaderboards.score THEN EXCLUDED.score ELSE leaderboards.score END,
        created_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [deviceId, username, score]);
    
    res.json({ success: true, entry: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// লিডারবোর্ড ফেচ API
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT username, score FROM leaderboards ORDER BY score DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

export default app;

