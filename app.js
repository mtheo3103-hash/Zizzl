// Hier deine spätere Render.com Backend URL einfügen
const BACKEND_URL = "https://dein-zizzl-backend.onrender.com"; 
let socket;

// Sound Engine (Web Audio API - generiert 8-Bit Retro Music ohne externe Dateien)
let audioCtx;
let isMusicPlaying = false;

function playTone(freq, duration, type = "square") {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function toggleMusic() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  isMusicPlaying = !isMusicPlaying;
  document.getElementById("music-toggle").innerText = isMusicPlaying ? "🔊" : "🎵";
  
  if (isMusicPlaying) {
    playPopSound();
  }
}

function playPopSound() {
  playTone(440, 0.1);
  setTimeout(() => playTone(880, 0.15), 100);
}

// UI Handlers
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

// Socket Communication Blueprint
function connectSocket() {
  if (!socket) {
    // Standard Socket Connection
    socket = io(BACKEND_URL, { autoConnect: false });

    socket.on("connect", () => {
      document.getElementById("connection-status").innerText = "Verbunden!";
      document.getElementById("connection-status").style.background = "#2ed573";
    });

    socket.on("updatePlayers", (players) => {
      renderPlayers(players);
    });
  }
  socket.connect();
}

function createLobby() {
  playPopSound();
  connectSocket();
  const username = getUsername();
  
  // Dummy UI Update for direct visual test
  switchScreen("screen-lobby");
  document.getElementById("display-pin").innerText = "Z" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById("host-controls").classList.remove("hidden");
  document.getElementById("client-wait-msg").classList.add("hidden");
  
  renderPlayers([{ username: username + " (Host)" }]);
}

function joinLobby() {
  playPopSound();
  const pin = document.getElementById("game-pin").value.trim();
  if (pin.length < 4) return alert("Bitte eine gültige PIN eingeben!");

  connectSocket();
  const username = getUsername();

  switchScreen("screen-lobby");
  document.getElementById("display-pin").innerText = pin.toUpperCase();
  document.getElementById("host-controls").classList.add("hidden");
  
  renderPlayers([{ username: username }]);
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

function startGame() {
  playPopSound();
  switchScreen("screen-game");
}
