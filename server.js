import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// টেবিলে device_id এবং UNIQUE কনস্ট্রেইন্ট যোগ করা হয়েছে
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
    console.log("Neon Database initialized with Device ID tracking.");
  } catch (err) {
    console.error("Database initialization failed:", err.message);
  }
}
initDb();

// একই ডিভাইসের জন্য স্কোর ইনসার্ট অথবা হাই-স্কোর আপডেট করার লজিক
app.post('/api/score', async (req, res) => {
  const { username, score, deviceId } = req.body;
  if (!username || typeof score !== 'number' || !deviceId) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  try {
    // ON CONFLICT ব্যবহার করে একই device_id থাকলে শুধু হাই-স্কোর আপডেট করা হবে
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
