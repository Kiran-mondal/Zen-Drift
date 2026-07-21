import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import validator from 'validator';

dotenv.config();

const app = express();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../public')));

// 🛡️ কনফিগারবল রেট লিমিটিং (Rate Limiting) সেটআপ
// ১. স্কোর সাবমিট এন্ডপয়েন্টের জন্য কঠোর লিমিট (বট বা স্প্যাম ঠেকাতে)
const scoreLimiter = rateLimit({
  windowMs: 60 * 1000, // ১ মিনিট
  max: 15, // প্রতি মিনিটে সর্বোচ্চ ১৫ বার স্কোর সাবমিট করা যাবে
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

// ২. সাধারণ লিডারবোর্ড ফেচ করার জন্য হালকা লিমিট
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // প্রতি মিনিটে সর্বোচ্চ ১০০ বার
  message: { error: 'Rate limit exceeded.' }
});

// Auto-initialize Neon DB Table
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

app.use(async (req, res, next) => {
  await initDb();
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// 🚀 সেফ ইনপুট ভ্যালিডেশন ও রেট লিমিটিং সহ স্কোর পোস্ট রাউট
app.post('/api/score', scoreLimiter, async (req, res) => {
  let { username, score, deviceId } = req.body;

  // বেসিক ইনপুট টাইপ চেক
  if (!username || typeof score !== 'number' || !deviceId) {
    return res.status(400).json({ error: 'Invalid payload structure' });
  }

  // ১. ইউজারের নাম স্যানিটাইজ ও স্ট্রং ভ্যালিডেশন (স্পেশাল ক্যারেক্টার ও এক্সএসএস আটকানো)
  username = validator.escape(username.toString().trim());
  if (!validator.isLength(username, { min: 1, max: 20 })) {
    return res.status(400).json({ error: 'Username must be between 1 and 20 characters' });
  }

  // ২. স্কোরের ভ্যালিডেশন (স্কোর অবশ্যই পজিটিভ ইন্টিজার হতে হবে, মাইনাস বা হ্যাকড স্কোর নিষিদ্ধ)
  if (!Number.isInteger(score) || score < 0 || score > 9999999) {
    return res.status(400).json({ error: 'Invalid score value' });
  }

  // ৩. ডিভাইস আইডি ভ্যালিডেশন
  deviceId = validator.escape(deviceId.toString().trim());
  if (!validator.isLength(deviceId, { min: 5, max: 100 })) {
    return res.status(400).json({ error: 'Invalid device identifier' });
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
    console.error("Database Error:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// লিডারবোর্ড ফেচ রাউট (রেট লিমিটার সহ)
app.get('/api/leaderboard', apiLimiter, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT username, score FROM leaderboards ORDER BY score DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Database Error:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default app;
