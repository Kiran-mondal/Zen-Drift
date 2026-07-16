const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const menu = document.getElementById('menu');
const scoreVal = document.getElementById('scoreVal');
const usernameInput = document.getElementById('username');
const leaderboardEntries = document.getElementById('leaderboardEntries');

let score = 0;
let gameActive = false;
let obstacles = [];
let particles = [];
let stars = [];
let spawnTimer = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Player Configuration
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

// Controls
window.addEventListener('mousemove', (e) => {
  if (gameActive) updateInput(e.clientX);
});

window.addEventListener('touchmove', (e) => {
  if (gameActive && e.touches.length > 0) {
    updateInput(e.touches[0].clientX);
    e.preventDefault();
  }
}, { passive: false });

// Ambient Stars
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

// Obstacles
class Obstacle {
  constructor() {
    this.width = Math.random() * 120 + 80;
    this.height = 15;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = -20;
    this.speed = 3 + (score * 0.05);
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

// Collectibles
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

// Particles
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

// Init Background Stars
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
    leaderboardEntries.innerHTML = '<div>Database connection failed</div>';
  }
}

async function submitScore() {
  const username = usernameInput.value || 'Anonymous';
  try {
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score })
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
  for (let i = 0; i < 60; i++) stars.push(new Star());
  
  player.x = canvas.width / 2;
  player.targetX = canvas.width / 2;
  gameActive = true;
  menu.style.display = 'none';
  animate(0);
}

function endGame() {
  gameActive = false;
  submitScore().then(() => fetchLeaderboard());
  menu.style.display = 'block';
  alert(`Game Over! Your total score: ${score}`);
}

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
    s.update();
    s.draw();
  });

  player.x += (player.targetX - player.x) * 0.15;

  ctx.fillStyle = player.color;
  ctx.shadowBlur = 15;
  ctx.shadowColor = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Render "Made by an Indian Developer" credit dynamically on the bottom right corner during gameplay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Made by an Indian Developer', canvas.width - 20, canvas.height - 20);

  spawnTimer++;
  if (spawnTimer % 90 === 0) {
    obstacles.push(new Obstacle());
    if (Math.random() < 0.6) {
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
