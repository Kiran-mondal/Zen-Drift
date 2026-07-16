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
let playerHistory = []; 
let spawnTimer = 0;

// 🔒 ডিভাইস ফিঙ্গারপ্রিন্ট ট্র্যাকিং (এক ফোনে ভিন্ন ব্রাউজারে একই আইডি দিবে)
function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem('zen_drift_device_id');
  if (deviceId) return deviceId;

  const screenWidth = window.screen.width || 0;
  const screenHeight = window.screen.height || 0;
  const colorDepth = window.screen.colorDepth || 0;
  const pixelRatio = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 2;
  const language = navigator.language || 'en';
  
  const userAgent = navigator.userAgent;
  let os = "unknown";
  if (userAgent.indexOf("Android") !== -1) os = "android";
  else if (userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) os = "ios";
  else if (userAgent.indexOf("Windows") !== -1) os = "windows";

  const rawFingerprint = `${os}-${screenWidth}x${screenHeight}-${colorDepth}-${pixelRatio}-${cores}-${language}`;
  
  let hash = 0;
  for (let i = 0; i < rawFingerprint.length; i++) {
    const char = rawFingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const finalFingerprint = 'dev_' + Math.abs(hash);
  localStorage.setItem('zen_drift_device_id', finalFingerprint);
  return finalFingerprint;
}

const DEVICE_ID = getOrCreateDeviceId();

if (localStorage.getItem('zen_drift_username')) {
  usernameInput.value = localStorage.getItem('zen_drift_username');
}

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

function updateInput(x) {
  player.targetX = Math.max(player.radius, Math.min(canvas.width - player.radius, x));
}

// মাউস কন্ট্রোল
window.addEventListener('mousemove', (e) => {
  if (gameActive) updateInput(e.clientX);
});

// টাচ স্টার্ট (প্রথম ছোঁয়াতেই বল নড়বে)
window.addEventListener('touchstart', (e) => {
  if (gameActive && e.touches.length > 0) {
    updateInput(e.touches[0].clientX);
  }
}, { passive: true });

// টাচ মুভ কন্ট্রোল (আঙুলের নিচে রিয়েল-টাইমে লেগে থাকবে)
window.addEventListener('touchmove', (e) => {
  if (gameActive && e.touches.length > 0) {
    updateInput(e.touches[0].clientX);
    e.preventDefault();
  }
}, { passive: false });

// ব্যাকগ্রাউন্ড ধীরগতির ভাসমান তারা
class Star {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.speed = Math.random() * 0.4 + 0.1; 
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

// সাইন-ওয়েভ বা আঁকাবাঁকা গতির লাল বাধা
class Obstacle {
  constructor() {
    this.width = Math.random() * 90 + 70; 
    this.height = 16;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = -30;
    this.speed = 1.8 + (score * 0.02); 
    this.angle = Math.random() * Math.PI * 2; 
    this.waveRange = Math.random() * 1.5 + 0.5; 
  }
  update() {
    this.y += this.speed;
    this.angle += 0.02; 
    this.x += Math.sin(this.angle) * this.waveRange; 
    
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
  }
  draw() {
    ctx.save();
    ctx.fillStyle = '#ff7b72';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff7b72';
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.fill();
    ctx.restore();
  }
}

// গোল্ডেন বোনাস স্টার
class GoldStar {
  constructor() {
    this.x = Math.random() * (canvas.width - 40) + 20;
    this.y = -30;
    this.speed = 1.5;
    this.radius = 8;
    this.angle = Math.random() * Math.PI * 2;
  }
  update() {
    this.y += this.speed;
    this.angle += 0.03;
    this.x += Math.cos(this.angle) * 0.5; 
  }
  draw() {
    ctx.save();
    ctx.fillStyle = '#f8e3a1';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#f8e3a1';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// কণা বিস্ফোরণ ইফেক্ট (Particle Sparkle)
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const speedMultiplier = Math.random() * 4 + 2;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speedMultiplier;
    this.vy = Math.sin(angle) * speedMultiplier;
    this.alpha = 1;
    this.color = color;
    this.size = Math.random() * 3 + 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.04; 
    this.alpha -= 0.015;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

for (let i = 0; i < 60; i++) {
  stars.push(new Star());
}

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

function startGame() {
  score = 0;
  scoreVal.innerText = score;
  obstacles = [];
  particles = [];
  stars = [];
  playerHistory = [];
  for (let i = 0; i < 60; i++) stars.push(new Star());
  
  player.x = canvas.width / 2;
  player.targetX = canvas.width / 2;
  gameActive = true;
  menu.style.display = 'none';
  customAlert.style.display = 'none';
  animate(0);
}

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

function checkCollision(circle, rect) {
  let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  let distanceX = circle.x - closestX;
  let distanceY = circle.y - closestY;
  let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

  return distanceSquared < (circle.radius * circle.radius);
}

function animate(timestamp) {
  if (!gameActive) return;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  stars.forEach(s => {
    if (s instanceof Star) {
      s.update();
      s.draw();
    }
  });

  // সুপার-রেসপন্সিভ ০.৩৫ ট্রানজিশন স্পিড (Lag-free)
  player.x += (player.targetX - player.x) * 0.35;

  playerHistory.push({ x: player.x, y: player.y });
  if (playerHistory.length > 10) playerHistory.shift();

  for (let i = 0; i < playerHistory.length; i++) {
    const ratio = i / playerHistory.length;
    ctx.save();
    ctx.globalAlpha = ratio * 0.3;
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(playerHistory[i].x, playerHistory[i].y, player.radius * ratio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = player.color;
  ctx.shadowBlur = 20;
  ctx.shadowColor = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 🏷️ আপনার কাস্টম ব্র্যান্ডিং ও ওয়াটারমার্ক
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Developed by Kiran Mondal', canvas.width - 20, canvas.height - 20);

  spawnTimer++;
  if (spawnTimer % 100 === 0) { 
    obstacles.push(new Obstacle());
    if (Math.random() < 0.7) {
      stars.push(new GoldStar());
    }
  }

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

  for (let i = stars.length - 1; i >= 0; i--) {
    let st = stars[i];
    if (st instanceof GoldStar) {
      st.update();
      st.draw();

      let dist = Math.hypot(player.x - st.x, player.y - st.y);
      if (dist < player.radius + st.radius) {
        for (let p = 0; p < 15; p++) {
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
      
