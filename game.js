(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('game-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMessage = document.getElementById('overlay-message');
  const startButton = document.getElementById('start-button');
  const playerScoreElement = document.getElementById('player-score');
  const cpuScoreElement = document.getElementById('cpu-score');
  const soundButton = document.getElementById('sound-button');
  const W = canvas.width;
  const H = canvas.height;
  const PADDLE_W = 12;
  const PADDLE_H = 88;
  const BALL_R = 8;
  const WIN_SCORE = 7;
  const keys = new Set();

  const game = {
    state: 'ready', playerScore: 0, cpuScore: 0, lastTime: 0,
    player: { x: 34, y: H / 2 - PADDLE_H / 2 },
    cpu: { x: W - 46, y: H / 2 - PADDLE_H / 2 },
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    sound: false, audio: null
  };

  function resetBall(direction) {
    game.ball.x = W / 2;
    game.ball.y = H / 2;
    const speed = 390;
    const angle = (Math.random() * 0.7 - 0.35);
    game.ball.vx = Math.cos(angle) * speed * direction;
    game.ball.vy = Math.sin(angle) * speed;
  }

  function begin() {
    if (game.state === 'over') {
      game.playerScore = 0;
      game.cpuScore = 0;
      updateScore();
    }
    game.state = 'running';
    overlay.classList.add('hidden');
    game.lastTime = performance.now();
    resetBall(Math.random() < 0.5 ? -1 : 1);
  }

  function pause() {
    if (game.state === 'running') {
      game.state = 'paused';
      showOverlay('Paused', 'Take a breather. Press SPACE to resume.', 'Resume game');
    } else if (game.state === 'paused') {
      begin();
    }
  }

  function showOverlay(title, message, buttonText) {
    overlayTitle.textContent = title;
    overlayMessage.innerHTML = message;
    startButton.innerHTML = `${buttonText} <span aria-hidden="true">→</span>`;
    overlay.classList.remove('hidden');
  }

  function updateScore() {
    playerScoreElement.textContent = game.playerScore;
    cpuScoreElement.textContent = game.cpuScore;
  }

  function finish(winner) {
    game.state = 'over';
    showOverlay(winner === 'player' ? 'You win!' : 'CPU wins!', winner === 'player' ? 'What a rally. Fancy another round?' : 'Good game. Ready for a rematch?', 'Play again');
  }

  function playTone(frequency = 440, duration = 0.045) {
    if (!game.sound) return;
    try {
      game.audio ??= new AudioContext();
      const oscillator = game.audio.createOscillator();
      const gain = game.audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.06, game.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, game.audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(game.audio.destination);
      oscillator.start();
      oscillator.stop(game.audio.currentTime + duration);
    } catch { /* Audio is optional; the game remains playable without it. */ }
  }

  function movePaddle(paddle, direction, dt, speed) {
    paddle.y += direction * speed * dt;
    paddle.y = Math.max(12, Math.min(H - PADDLE_H - 12, paddle.y));
  }

  function update(dt) {
    let direction = 0;
    if (keys.has('ArrowUp') || keys.has('w')) direction -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) direction += 1;
    movePaddle(game.player, direction, dt, 520);

    const cpuCenter = game.cpu.y + PADDLE_H / 2;
    const target = game.ball.vx > 0 ? game.ball.y : H / 2;
    const cpuDirection = Math.abs(target - cpuCenter) < 12 ? 0 : Math.sign(target - cpuCenter);
    movePaddle(game.cpu, cpuDirection, dt, 350);

    const ball = game.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y - BALL_R < 10 || ball.y + BALL_R > H - 10) {
      ball.vy *= -1;
      ball.y = Math.max(10 + BALL_R, Math.min(H - 10 - BALL_R, ball.y));
      playTone(330);
    }

    const playerHit = ball.vx < 0 && ball.x - BALL_R <= game.player.x + PADDLE_W && ball.x + BALL_R >= game.player.x && ball.y >= game.player.y && ball.y <= game.player.y + PADDLE_H;
    const cpuHit = ball.vx > 0 && ball.x + BALL_R >= game.cpu.x && ball.x - BALL_R <= game.cpu.x + PADDLE_W && ball.y >= game.cpu.y && ball.y <= game.cpu.y + PADDLE_H;

    if (playerHit || cpuHit) {
      const paddle = playerHit ? game.player : game.cpu;
      const relativeHit = (ball.y - (paddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
      const directionX = playerHit ? 1 : -1;
      const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.045, 760);
      const angle = relativeHit * 0.92;
      ball.vx = Math.cos(angle) * speed * directionX;
      ball.vy = Math.sin(angle) * speed;
      ball.x = playerHit ? game.player.x + PADDLE_W + BALL_R : game.cpu.x - BALL_R;
      playTone(520);
    }

    if (ball.x < -BALL_R) {
      game.cpuScore += 1;
      updateScore();
      playTone(220, 0.12);
      if (game.cpuScore >= WIN_SCORE) finish('cpu'); else resetBall(1);
    } else if (ball.x > W + BALL_R) {
      game.playerScore += 1;
      updateScore();
      playTone(660, 0.12);
      if (game.playerScore >= WIN_SCORE) finish('player'); else resetBall(-1);
    }
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111925';
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 430);
    glow.addColorStop(0, '#1b2735');
    glow.addColorStop(1, '#111925');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#394657';
    for (let y = 16; y < H; y += 25) ctx.fillRect(W / 2 - 1, y, 2, 12);

    ctx.shadowBlur = 18;
    ctx.shadowColor = '#d3f36b88';
    ctx.fillStyle = '#d3f36b';
    roundedRect(game.player.x, game.player.y, PADDLE_W, PADDLE_H, 6);
    ctx.shadowColor = '#66d9e888';
    ctx.fillStyle = '#66d9e8';
    roundedRect(game.cpu.x, game.cpu.y, PADDLE_W, PADDLE_H, 6);
    ctx.shadowColor = '#ffffffaa';
    ctx.fillStyle = '#f5f7fa';
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function frame(timestamp) {
    const dt = Math.min((timestamp - (game.lastTime || timestamp)) / 1000, 0.035);
    game.lastTime = timestamp;
    if (game.state === 'running') update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  startButton.addEventListener('click', begin);
  document.getElementById('restart-button').addEventListener('click', () => {
    game.playerScore = 0;
    game.cpuScore = 0;
    updateScore();
    begin();
  });

  soundButton.addEventListener('click', () => {
    game.sound = !game.sound;
    soundButton.setAttribute('aria-pressed', String(game.sound));
    soundButton.setAttribute('aria-label', game.sound ? 'Turn sound off' : 'Turn sound on');
    if (game.sound) playTone(520);
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', ' '].includes(key)) event.preventDefault();
    if (['arrowup', 'arrowdown', 'w', 's'].includes(key)) keys.add(key);
    if (key === ' ' && !event.repeat) {
      if (game.state === 'running' || game.state === 'paused') pause();
      else begin();
    }
    if (key === 'escape' && game.state === 'running') pause();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  document.querySelectorAll('.touch-controls button').forEach((button) => {
    const key = button.dataset.direction === 'up' ? 'arrowup' : 'arrowdown';
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); keys.add(key); button.setPointerCapture(event.pointerId); });
    const release = () => keys.delete(key);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  showOverlay('Your serve.', 'Move with <kbd>↑</kbd> <kbd>↓</kbd> or <kbd>W</kbd> <kbd>S</kbd>', 'Start game');
  requestAnimationFrame(frame);
})();
