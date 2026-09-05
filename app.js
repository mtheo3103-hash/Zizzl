// Trage hier die Live-URL deines Render-Backends ein
const BACKEND_URL = "https://zizzl-server.onrender.com"; 

let socket;
let currentPin = null;
let isHost = false;

// Audio-Synthesizer
let audioCtx;
let isMusicPlaying = false;
let musicInterval = null;
const melody = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
let noteIndex = 0;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(freq, duration, type = "square", volume = 0.05) {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
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

function toggleMusic() {
  initAudio();
  isMusicPlaying = !isMusicPlaying;
  const icon = document.getElementById("music-icon");
  if (isMusicPlaying) {
    icon.style.fill = "#2ed573";
    musicInterval = setInterval(() => {
      playTone(melody[noteIndex], 0.2, "triangle", 0.04);
      noteIndex = (noteIndex + 1) % melody.length;
    }, 250);
  } else {
    icon.style.fill = "#2f3542";
    clearInterval(musicInterval);
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

// TEXTURIERTES CANVAS-SNAKE MIT ANIMATIONEN
function startSnakeGame(durationSeconds = 30) {
  const viewport = document.getElementById("game-viewport");
  viewport.innerHTML = `
    <div class="snake-container">
      <div class="game-stats">
        <span>Äpfel: <strong id="snake-score">0</strong></span>
        <span>Zeit: <strong id="snake-timer">${durationSeconds}s</strong></span>
      </div>
      <canvas id="snakeCanvas" width="300" height="300"></canvas>
    </div>
  `;

  const canvas = document.getElementById("snakeCanvas");
  const ctx = canvas.getContext("2d");
  const gridSize = 15;
  const tileCount = canvas.width / gridSize;

  let snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }];
  let velocity = { x: 0, y: -1 };
  let apple = { x: 5, y: 5 };
  let score = 0;
  let timeLeft = durationSeconds;
  let isGameOver = false;
  let applePulse = 0;

  function changeDirection(newX, newY) {
    if (newX !== -velocity.x && newY !== -velocity.y) {
      velocity = { x: newX, y: newY };
    }
  }

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp": case "w": changeDirection(0, -1); break;
      case "ArrowDown": case "s": changeDirection(0, 1); break;
      case "ArrowLeft": case "a": changeDirection(-1, 0); break;
      case "ArrowRight": case "d": changeDirection(1, 0); break;
    }
  });

  let touchStartX = 0, touchStartY = 0;
  canvas.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) > 20 || Math.abs(diffY) > 20) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        changeDirection(diffX > 0 ? 1 : -1, 0);
      } else {
        changeDirection(0, diffY > 0 ? 1 : -1);
      }
    }
  }, { passive: true });

  const gameInterval = setInterval(() => {
    if (isGameOver) return;

    applePulse += 0.2;

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    if (head.x === apple.x && head.y === apple.y) {
      score += 10;
      playTone(880, 0.1, "square", 0.1);
      document.getElementById("snake-score").innerText = score;
      socket.emit("submitScore", { pin: currentPin, score: score });

      apple = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
      };
    } else {
      snake.pop();
    }

    snake.unshift(head);

    // Grid Hintergrund
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < tileCount; x++) {
      for (let y = 0; y < tileCount; y++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
          ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
      }
    }

    // Apfel mit Glow & Textur
    const appleSizeScale = Math.sin(applePulse) * 1.5;
    ctx.fillStyle = "#ff4757";
    ctx.beginPath();
    ctx.arc(
      apple.x * gridSize + gridSize / 2,
      apple.y * gridSize + gridSize / 2,
      (gridSize / 2 - 2) + appleSizeScale,
      0, Math.PI * 2
    );
    ctx.fill();

    // Schlange mit abgerundeten Textur-Segmenten
    snake.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? "#2ed573" : "#26af5f";
      
      const px = part.x * gridSize;
      const py = part.y * gridSize;
      const radius = index === 0 ? 6 : 4;

      ctx.beginPath();
      ctx.roundRect(px + 1, py + 1, gridSize - 2, gridSize - 2, radius);
      ctx.fill();

      // Glanz-Effekt
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(px + 3, py + 3, 3, 3);
    });

  }, 110);

  const timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("snake-timer").innerText = `${timeLeft}s`;

    if (timeLeft <= 0) {
      clearInterval(gameInterval);
      clearInterval(timerInterval);
      isGameOver = true;
      viewport.innerHTML = `<h3 style="margin-top: 40px; color: var(--dark);">Zeit abgelaufen!</h3>`;
    }
  }, 1000);
}
