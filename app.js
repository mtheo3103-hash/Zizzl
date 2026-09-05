const BACKEND_URL = "https://zizzl-server.onrender.com"; 

let socket;
let currentPin = null;
let isHost = false;

// Web Audio API Synthesizer (Lobby Musik & Sound-Effekte)
let audioCtx;
let isMusicPlaying = false;
let musicInterval = null;

// Kahoot-Style Melody Pattern (Frequenzen in Hz)
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
    // Spielt Rhythmus-Schleife ab
    musicInterval = setInterval(() => {
      playTone(melody[noteIndex], 0.2, "triangle", 0.04);
      noteIndex = (noteIndex + 1) % melody.length;
    }, 250);
  } else {
    icon.style.fill = "#2f3542";
    clearInterval(musicInterval);
  }
}

function showJoinInput() {
  playPopSound();
  document.getElementById("join-box").classList.remove("hidden");
}

function getUsername() {
  const name = document.getElementById("username").value.trim();
  return name.length > 0 ? name : "Challenger#" + Math.floor(Math.random() * 900 + 100);
}

function switchScreen(screenId) {
  document.querySelectorAll(".card").forEach(c => c.classList.add("hidden"));
  document.getElementById(screenId).classList.remove("hidden");
}

// Socket Connection
function connectSocket() {
  if (!socket) {
    socket = io(BACKEND_URL);

    socket.on("connect", () => {
      const statusEl = document.getElementById("connection-status");
      if (statusEl) {
        statusEl.innerText = "Verbunden!";
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
      alert(msg);
    });

    socket.on("gameStarted", ({ round, totalRounds }) => {
      switchScreen("screen-game");
      document.getElementById("round-indicator").innerText = `Runde ${round} / ${totalRounds}`;
    });
  }
}

function createLobby() {
  playPopSound();
  connectSocket();
  const username = getUsername();
  socket.emit("createLobby", { username });
}

function joinLobby() {
  playPopSound();
  const pin = document.getElementById("game-pin").value.trim();
  if (pin.length < 4) return alert("Bitte eine gültige 4-stellige PIN eingeben!");

  connectSocket();
  const username = getUsername();
  socket.emit("joinLobby", { pin, username });
}

function startGame() {
  playPopSound();
  if (socket && currentPin && isHost) {
    const rounds = document.getElementById("round-select").value;
    socket.emit("updateSettings", { pin: currentPin, rounds });
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
