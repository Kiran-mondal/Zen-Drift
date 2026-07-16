const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const menu = document.getElementById('menu');
const scoreVal = document.getElementById('scoreVal');
const usernameInput = document.getElementById('username');
const leaderboardEntries = document.getElementById('leaderboardEntries');

const customAlert = document.getElementById('customAlert');
const alertMsg = document.getElementById('alertMsg');
const alertBtn = document.getElementById('alertBtn');

let score = 0;
let gameActive = false;
let obstacles = [];
let particles = [];
let stars = [];
let spawnTimer = 0;

// 🔒 শক্তিশালী ডিভাইস ফিঙ্গারপ্রিন্টিং লজিক (একই ফোনের সব ব্রাউজারে ১টি আইডি দেবে)
function getOrCreateDeviceId() {
  // ১. প্রথমে ব্রাউজারের লোকাল স্টোরেজ চেক করা
  let deviceId = localStorage.getItem('zen_drift_device_id');
  if (deviceId) return deviceId;

  // ২. ডিভাইসের নির্দিষ্ট হার্ডওয়্যার ডেটা সংগ্রহ করা (যা ব্রাউজার বদলালেও একই থাকে)
  const screenWidth = window.screen.width || 0;
  const screenHeight = window.screen.height || 0;
  const colorDepth = window.screen.colorDepth || 0;
  const pixelRatio = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 2;
  const language = navigator.language || 'en';
  
  // অপারেটিং সিস্টেম শনাক্তকরণ
  const userAgent = navigator.userAgent;
  let os = "unknown";
  if (userAgent.indexOf("Android") !== -1) os = "android";
  else if (userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) os = "ios";
  else if (userAgent.indexOf("Windows") !== -1) os = "windows";

  // ৩. হার্ডওয়্যার ও স্ক্রিন ডেটা একসাথে মিলিয়ে একটি ফিঙ্গারপ্রিন্ট টেক্সট তৈরি করা
  const rawFingerprint = `${os}-${screenWidth}x${screenHeight}-${colorDepth}-${pixelRatio}-${cores}-${language}`;
  
  // ৪. এই টেক্সটটিকে একটি ইউনিক ম্যাথমেটিক্যাল হ্যাশ কোডে রূপান্তর করা
  let hash = 0;
  for (let i = 0; i < rawFingerprint.length; i++) {
    const char = rawFingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const finalFingerprint = 'dev_' + Math.abs(hash);
  
  // ব্রাউজারের লোকাল স্টোরেজে ভবিষ্যতের জন্য সেভ রাখা
  localStorage.setItem('zen_drift_device_id', finalFingerprint);
  return finalFingerprint;
}

// গ্লোবাল ডিভাইস আইডি কনস্ট্যান্ট
const DEVICE_ID = getOrCreateDeviceId();

// ইউজার আগে নিজের নাম পরিবর্তন করে থাকলে তা ধরে রাখা
if (localStorage.getItem('zen_drift_username')) {
  usernameInput.value = localStorage.getItem('zen_drift_username');
}

// স্ক্রিন রিসাইজ হ্যান্ডলার
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// প্লেয়ার অবজেক্ট
const player = {
  x: canvas.width / 2,
  y: canvas.height * 0.75,
  targetX: canvas.width / 2,
  radius: 12,
  color: '#58a6ff'
};

// প্লেয়ারের পজিশন কন্ট্রোল
function updateInput(x) {
  player.targetX = Math.max(player.radius, Math.min(canvas.width - player.radius, x));
}

// মাউস এবং টাচ ইভেন্ট কন্ট্রোল
window.addEventListener('mousemove', (e) => {
  if (gameActive) updateInput(e.clientX);
});

window.addEventListener('touchmove', (e) => {
  if (gameActive && e.touches.length > 0) {
    updateInput(e.touches[0].clientX);
    e.preventDefault();
  }
}, { passive: false });

// ব্যাকগ্রাউন্ডের মিটিমিটি জ্বলতে থাকা তারা
class Star {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.speed = Math.random() * 1 + 0.5;
    this.size = Math.random() * 1.5;
  }
  update() {
    this.y += this.speed;
    if (this.y > canvas.height) {
      this.y = 0;
      this.x = Math.random() * canvas.width;
    }
  }
  draw() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

// বাধা বা অবস্টাকল ক্লাস
class Obstacle {
  constructor() {
    this.width = Math.random() * 120 + 80;
    this.height = 15;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = -20;
    this.speed = 3 + (score * 0.05); // স্কোর বাড়ার সাথে সাথে স্পিড বাড়ে
  }
  update() {
    this.y += this.speed;
  }
  draw() {
    ctx.fillStyle = '#ff7b72';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff7b72';
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// পয়েন্ট বা গোল্ডেন স্টার ক্লাস (যা কালেক্ট করলে ২৫ পয়েন্ট পাওয়া যায়)
class GoldStar {
  constructor() {
    this.x = Math.random() * (canvas.width - 20) + 10;
    this.y = -20;
    this.speed = 2.5;
    this.radius = 8;
  }
  update() {
    this.y += this.speed;
  }
  draw() {
    ctx.fillStyle = '#f8e3a1';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#f8e3a1';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// পার্টিকল ইফেক্ট ক্লাস
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.alpha = 1;
    this.color = color;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.02;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ব্যাকগ্রাউন্ড স্টার্স ইনিশিয়ালাইজেশন
for (let i = 0; i < 60; i++) {
  stars.push(new Star());
}

// সার্ভার থেকে টপ ১০ লিডারবোর্ড ডেটা আনা
async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    leaderboardEntries.innerHTML = '';
    if (data.length === 0) {
      leaderboardEntries.innerHTML = '<div>No records yet. Be the first!</div>';
      return;
    }
    data.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `<span>${idx + 1}. ${item.username}</span><span>${item.score} pt</span>`;
      leaderboardEntries.appendChild(row);
    });
  } catch (err) {
    leaderboardEntries.innerHTML = '<div>Leaderboard unavailable</div>';
  }
}

// সার্ভারে স্কোর পাঠানো (ইউনিক ডিভাইস আইডি অনুযায়ী)
async function submitScore() {
  const username = usernameInput.value.trim() || 'Player 1';
  localStorage.setItem('zen_drift_username', username);
  try {
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score, deviceId: DEVICE_ID })
    });
  } catch (err) {
    console.error('Score submit error:', err);
  }
}

// গেম শুরু করার লজিক
function startGame() {
  score = 0;
  scoreVal.innerText = score;
  obstacles = [];
  particles = [];
  stars = [];
  for (let i = 0; i < 60; i++) stars.push(new Star());
  
  player.x = canvas.width / 2;
  player.targetX = canvas.width / 2;
  gameActive = true;
  menu.style.display = 'none';
  customAlert.style.display = 'none';
  animate(0);
}

// গেম ওভার হওয়ার লজিক
function endGame() {
  gameActive = false;
  submitScore().then(() => fetchLeaderboard());
  alertMsg.innerText = `Your total score: ${score} pt`;
  customAlert.style.display = 'block';
}

alertBtn.addEventListener('click', () => {
  customAlert.style.display = 'none';
  menu.style.display = 'block';
});

// সংঘর্ষ বা কলিশন চেক লজিক (Circle to Rectangle Collision)
function checkCollision(circle, rect) {
  let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  let distanceX = circle.x - closestX;
  let distanceY = circle.y - closestY;
  let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

  return distanceSquared < (circle.radius * circle.radius);
}

// মেইন গেম লুপ (অ্যানিমেশন)
function animate(timestamp) {
  if (!gameActive) return;

  // ব্যাকগ্রাউন্ড ক্লিয়ার
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ব্যাকগ্রাউন্ড তারা আপডেট ও ড্র
  stars.forEach(s => {
    if (s instanceof Star) {
      s.update();
      s.draw();
    }
  });

  // প্লেয়ারের মন্থর মুভমেন্ট ইফেক্ট (Easing)
  player.x += (player.targetX - player.x) * 0.15;

  // প্লেয়ার ড্র
  ctx.fillStyle = player.color;
  ctx.shadowBlur = 15;
  ctx.shadowColor = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ওয়াটারমার্ক ড্র
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Made by an Indian Developer', canvas.width - 20, canvas.height - 20);

  // অবস্টাকল ও পয়েন্ট স্পন টাইমার
  spawnTimer++;
  if (spawnTimer % 90 === 0) {
    obstacles.push(new Obstacle());
    if (Math.random() < 0.6) {
      stars.push(new GoldStar());
    }
  }

  // অবস্টাকল আপডেট ও চেক
  for (let i = obstacles.length - 1; i >= 0; i--) {
    let obs = obstacles[i];
    obs.update();
    obs.draw();

    if (checkCollision(player, obs)) {
      endGame();
      return;
    }

    if (obs.y > canvas.height) {
      obstacles.splice(i, 1);
      score += 5;
      scoreVal.innerText = score;
    }
  }

  // পয়েন্ট তারা সংগ্রহ ও চেক
  for (let i = stars.length - 1; i >= 0; i--) {
    let st = stars[i];
    if (st instanceof GoldStar) {
      st.update();
      st.draw();

      let dist = Math.hypot(player.x - st.x, player.y - st.y);
      if (dist < player.radius + st.radius) {
        for (let p = 0; p < 10; p++) {
          particles.push(new Particle(st.x, st.y, '#f8e3a1'));
        }
        stars.splice(i, 1);
        score += 25;
        scoreVal.innerText = score;
      } else if (st.y > canvas.height) {
        stars.splice(i, 1);
      }
    }
  }

  // বিস্ফোরণ কণা (Particles) আপডেট
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.draw();
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  requestAnimationFrame(animate);
}

startBtn.addEventListener('click', startGame);
fetchLeaderboard();
