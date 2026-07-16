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

// Neon PostgreSQL কানেকশন পুল সেটআপ
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Neon সুরক্ষিত সংযোগের জন্য এটি প্রয়োজন
  }
});

app.use(express.json());
// public ফোল্ডারের ফাইলগুলো স্ট্যাটিক হিসেবে সার্ভ করা হবে
app.use(express.static(path.join(__dirname, 'public')));

// ডাটাবেজ টেবিল স্বয়ংক্রিয়ভাবে তৈরি করার ফাংশন
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboards (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        score INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Neon Database initialized successfully.");
  } catch (err) {
    console.error("Database initialization failed:", err.message);
  }
}
initDb();

// নতুন স্কোর ডাটাবেজে সাবমিট করার API Endpoint
app.post('/api/score', async (req, res) => {
  const { username, score } = req.body;
  if (!username || typeof score !== 'number') {
    return res.status(400).json({ error: 'Invalid data' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO leaderboards (username, score) VALUES ($1, $2) RETURNING *',
      [username, score]
    );
    res.json({ success: true, entry: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ডাটাবেজ থেকে সর্বোচ্চ ১০টি স্কোর আনার API Endpoint
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT username, score, created_at FROM leaderboards ORDER BY score DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// অন্যান্য সমস্ত রিকোয়েস্টের জন্য মেইন ইণ্ডেক্স ফাইলটি সার্ভ করা হবে
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
