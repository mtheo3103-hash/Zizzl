// Live-URL deines Render-Backends
const BACKEND_URL = "https://zizzl-server.onrender.com"; 

let socket;
let currentPin = null;
let isHost = false;

// --- UPGRADED AUDIO-SYNTHESIZER (8-Bit Chiptune Theme) ---
let audioCtx;
let isMusicPlaying = false;
let musicInterval = null;
let bassInterval = null;

const melodyNotes = [261.63, 329.63, 392.00, 523.25, 440.00, 349.23, 392.00, 293.66];
const bassNotes = [130.81, 130.81, 174.61, 146.83];
let noteIdx = 0;
let bassIdx = 0;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type = "square", volume = 0.05) {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playPopSound() {
  playTone(523.25, 0.08, "sine", 0.1);
  setTimeout(() => playTone(659.25, 0.12, "sine", 0.08), 60);
}

function playEatSound() {
  playTone(523.25, 0.06, "square", 0.08);
  setTimeout(() => playTone(659.25, 0.08, "square", 0.08), 50);
  setTimeout(() => playTone(783.99, 0.1, "square", 0.08), 100);
}

function playGameOverSound() {
  playTone(200, 0.15, "sawtooth", 0.12);
  setTimeout(() => playTone(150, 0.2, "sawtooth", 0.12), 120);
  setTimeout(() => playTone(100, 0.3, "sawtooth", 0.12), 250);
}

function toggleMusic() {
  initAudio();
  isMusicPlaying = !isMusicPlaying;
  const icon = document.getElementById("music-icon");
  if (isMusicPlaying) {
    icon.style.fill = "#2ed573";
    
    musicInterval = setInterval(() => {
      playTone(melodyNotes[noteIdx], 0.15, "square", 0.03);
      noteIdx = (noteIdx + 1) % melodyNotes.length;
    }, 180);

    bassInterval = setInterval(() => {
      playTone(bassNotes[bassIdx], 0.3, "triangle", 0.05);
      bassIdx = (bassIdx + 1) % bassNotes.length;
    }, 360);

  } else {
    icon.style.fill = "#2f3542";
    clearInterval(musicInterval);
    clearInterval(bassInterval);
  }
}

function showAlert(message) {
  const alertBox = document.getElementById("alert-box");
  alertBox.innerText = message;
  alertBox.classList.remove("hidden");
  setTimeout(() => {
    alertBox.classList.add("hidden");
  }, 4000);
}

function toggleCardSelection(checkbox) {
  playPopSound();
  const card = checkbox.closest('.game-preview-card');
  if (checkbox.checked) {
    card.classList.add('active');
  } else {
    card.classList.remove('active');
  }
}

function showJoinInput() {
  playPopSound();
  document.getElementById("join-box").classList.remove("hidden");
}

function getUsername() {
  const name = document.getElementById("username").value.trim();
  if (name.length === 0) {
    showAlert("Bitte gib zuerst einen Spielernamen ein!");
    return null;
  }
  return name;
}

function switchScreen(screenId) {
  document.querySelectorAll(".card").forEach(c => c.classList.add("hidden"));
  document.getElementById(screenId).classList.remove("hidden");
}

function connectSocket() {
  if (!socket) {
    socket = io(BACKEND_URL);

    socket.on("connect", () => {
      const statusEl = document.getElementById("connection-status");
      if (statusEl) {
        statusEl.innerText = "VERBUNDEN";
        statusEl.style.background = "#2ed573";
      }
    });

    socket.on("lobbyCreated", ({ pin, players, isHost: hostFlag }) => {
      currentPin = pin;
      isHost = hostFlag;
      document.getElementById("display-pin").innerText = pin;
      switchScreen("screen-lobby");
      document.getElementById("host-controls").classList.remove("hidden");
      document.getElementById("client-wait-msg").classList.add("hidden");
      renderPlayers(players);
    });

    socket.on("joinedLobby", ({ pin, players }) => {
      currentPin = pin;
      document.getElementById("display-pin").innerText = pin;
      switchScreen("screen-lobby");
      document.getElementById("host-controls").classList.add("hidden");
      document.getElementById("client-wait-msg").classList.remove("hidden");
      renderPlayers(players);
    });

    socket.on("updatePlayers", (players) => {
      renderPlayers(players);
    });

    socket.on("errorMsg", (msg) => {
      showAlert(msg);
    });

    socket.on("gameStarted", ({ round, totalRounds, gameType }) => {
      switchScreen("screen-game");
      document.getElementById("round-indicator").innerText = `Runde ${round} / ${totalRounds}`;
      document.getElementById("game-title").innerText = gameType.toUpperCase();
      
      if (gameType === "snake") {
        startSnakeGame(30);
      }
    });

    socket.on("updateLeaderboard", (players) => {
      renderLeaderboard(players);
    });
  }
}

function createLobby() {
  const username = getUsername();
  if (!username) return;
  playPopSound();
  connectSocket();
  socket.emit("createLobby", { username });
}

function joinLobby() {
  const pin = document.getElementById("game-pin").value.trim();
  if (pin.length < 4) return showAlert("Gültige 4-stellige PIN eingeben!");
  const username = getUsername();
  if (!username) return;
  playPopSound();
  connectSocket();
  socket.emit("joinLobby", { pin, username });
}

function startGame() {
  playPopSound();
  if (socket && currentPin && isHost) {
    const rounds = document.getElementById("round-select").value;
    const selectedGames = Array.from(
      document.querySelectorAll('.game-preview-card input:checked')
    ).map(cb => cb.value);

    if (selectedGames.length === 0) {
      showAlert("Wähle mindestens ein Spiel aus!");
      return;
    }

    socket.emit("updateSettings", { pin: currentPin, rounds, selectedGames });
    socket.emit("startGame", { pin: currentPin });
  }
}

function renderPlayers(players) {
  const grid = document.getElementById("player-grid");
  grid.innerHTML = "";
  players.forEach(p => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.innerText = p.username;
    grid.appendChild(card);
  });
  document.getElementById("player-count").innerText = players.length;
}

function renderLeaderboard(players) {
  const list = document.getElementById("leaderboard-list");
  if (!list) return;
  list.innerHTML = "";
  players.forEach((p, index) => {
    const li = document.createElement("li");
    li.className = "leaderboard-item";
    li.innerHTML = `
      <span class="rank">#${index + 1}</span>
      <span class="p-name">${p.username}</span>
      <span class="p-score">${p.currentScore || 0} PTS</span>
    `;
    list.appendChild(li);
  });
}

// --- OPTIMIERTES SNAKE-GAME MIT DYNAMISCHEN AUGEN & TOUCH CONTROLS ---
function startSnakeGame(durationSeconds = 30) {
  const viewport = document.getElementById("game-viewport");
  viewport.innerHTML = `
    <div class="snake-container">
      <div class="game-stats">
        <span>Äpfel: <strong id="snake-score">0</strong></span>
        <span>Zeit: <strong id="snake-timer">${durationSeconds}s</strong></span>
      </div>
      <canvas id="snakeCanvas" width="300" height="300"></canvas>
      
      <div class="dpad-controls">
        <button class="dpad-btn up" id="btn-up">▲</button>
        <div class="dpad-row">
          <button class="dpad-btn left" id="btn-left">◄</button>
          <button class="dpad-btn down" id="btn-down">▼</button>
          <button class="dpad-btn right" id="btn-right">►</button>
        </div>
      </div>
    </div>
  `;

  const canvas = document.getElementById("snakeCanvas");
  const ctx = canvas.getContext("2d");
  const gridSize = 15;
  const tileCount = canvas.width / gridSize;

  let snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
  let velocity = { x: 0, y: -1 };
  let nextVelocity = { x: 0, y: -1 };
  let apple = { x: 5, y: 5 };
  let score = 0;
  let timeLeft = durationSeconds;
  let isGameOver = false;
  let applePulse = 0;

  function changeDirection(nx, ny) {
    if (nx !== -velocity.x || ny !== -velocity.y) {
      nextVelocity = { x: nx, y: ny };
    }
  }

  const handleKeydown = (e) => {
    if (["ArrowUp", "KeyW"].includes(e.code)) { changeDirection(0, -1); e.preventDefault(); }
    if (["ArrowDown", "KeyS"].includes(e.code)) { changeDirection(0, 1); e.preventDefault(); }
    if (["ArrowLeft", "KeyA"].includes(e.code)) { changeDirection(-1, 0); e.preventDefault(); }
    if (["ArrowRight", "KeyD"].includes(e.code)) { changeDirection(1, 0); e.preventDefault(); }
  };
  window.addEventListener("keydown", handleKeydown);

  document.getElementById("btn-up").onclick = () => changeDirection(0, -1);
  document.getElementById("btn-down").onclick = () => changeDirection(0, 1);
  document.getElementById("btn-left").onclick = () => changeDirection(-1, 0);
  document.getElementById("btn-right").onclick = () => changeDirection(1, 0);

  let touchStartX = 0, touchStartY = 0;
  canvas.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(diffX) > 15 || Math.abs(diffY) > 15) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        changeDirection(diffX > 0 ? 1 : -1, 0);
      } else {
        changeDirection(0, diffY > 0 ? 1 : -1);
      }
    }
  }, { passive: true });

  const gameInterval = setInterval(() => {
    if (isGameOver) return;

    velocity = { ...nextVelocity };
    applePulse += 0.2;

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    if (head.x === apple.x && head.y === apple.y) {
      score += 10;
      playEatSound();
      document.getElementById("snake-score").innerText = score;
      if (typeof socket !== 'undefined' && currentPin) {
        socket.emit("submitScore", { pin: currentPin, score: score });
      }

      apple = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
      };
    } else {
      snake.pop();
    }

    snake.unshift(head);

    ctx.fillStyle = "#1e272e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < tileCount; x++) {
      for (let y = 0; y < tileCount; y++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
          ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
      }
    }

    const scale = Math.sin(applePulse) * 1.2;
    const ax = apple.x * gridSize + gridSize / 2;
    const ay = apple.y * gridSize + gridSize / 2;

    ctx.fillStyle = "#ff4757";
    ctx.beginPath();
    ctx.arc(ax, ay, (gridSize / 2 - 2) + scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2ed573";
    ctx.fillRect(ax - 1, ay - gridSize/2, 3, 3);

    snake.forEach((part, index) => {
      const px = part.x * gridSize;
      const py = part.y * gridSize;

      if (index === 0) {
        ctx.fillStyle = "#2ed573";
        ctx.beginPath();
        ctx.roundRect(px, py, gridSize, gridSize, 5);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        let e1X = px + 3, e1Y = py + 3;
        let e2X = px + 9, e2Y = py + 3;

        if (velocity.x === 1)  { e1X = px + 9; e1Y = py + 3; e2X = px + 9; e2Y = py + 9; }
        if (velocity.x === -1) { e1X = px + 3; e1Y = py + 3; e2X = px + 3; e2Y = py + 9; }
        if (velocity.y === 1)  { e1X = px + 3; e1Y = py + 9; e2X = px + 9; e2Y = py + 9; }
        if (velocity.y === -1) { e1X = px + 3; e1Y = py + 3; e2X = px + 9; e2Y = py + 3; }

        ctx.beginPath();
        ctx.arc(e1X + 1.5, e1Y + 1.5, 2.5, 0, Math.PI * 2);
        ctx.arc(e2X + 1.5, e2Y + 1.5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(e1X + 1.5, e1Y + 1.5, 1, 0, Math.PI * 2);
        ctx.arc(e2X + 1.5, e2Y + 1.5, 1, 0, Math.PI * 2);
        ctx.fill();

      } else {
        ctx.fillStyle = "#26af5f";
        ctx.beginPath();
        ctx.roundRect(px + 1, py + 1, gridSize - 2, gridSize - 2, 4);
        ctx.fill();
      }
    });

  }, 100);

  const timerInterval = setInterval(() => {
    timeLeft--;
    const timerEl = document.getElementById("snake-timer");
    if (timerEl) timerEl.innerText = `${timeLeft}s`;

    if (timeLeft <= 0) {
      clearInterval(gameInterval);
      clearInterval(timerInterval);
      window.removeEventListener("keydown", handleKeydown);
      playGameOverSound();
      isGameOver = true;
      viewport.innerHTML = `<h3 style="margin-top: 30px; color: var(--dark);">Zeit abgelaufen! Score: ${score}</h3>`;
    }
  }, 1000);
}
