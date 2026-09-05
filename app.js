// ⚠️ HIER DEINE ECHTE RENDER-URL EINFÜGEN!
const BACKEND_URL = "https://zizzl-server.onrender.com"; 

let socket;
let currentPin = null;
let isHost = false;

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
