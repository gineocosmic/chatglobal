//---------------------------------------------------------
// Ambil nama room dari URL, contoh: chat.html?room=bandung
//---------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const room = params.get("room") || "global"; // default room

//---------------------------------------------------------
// Anonymous username generator (via localStorage)
//---------------------------------------------------------
let username = localStorage.getItem("chatglobal_user");
if (!username) {
  username = "User#" + Math.floor(1000 + Math.random() * 9000);
  localStorage.setItem("chatglobal_user", username);
}

const usernameDisplay = document.getElementById("username");
if (usernameDisplay) usernameDisplay.value = username;

//---------------------------------------------------------
// Firebase Config
//---------------------------------------------------------
var firebaseConfig = {
  apiKey: "AIzaSyB-IAj8gKwvObCoo7hRJNW6HK67UMtBadc",
  authDomain: "chatglobal-ef22a.firebaseapp.com",
  databaseURL: "https://chatglobal-ef22a-default-rtdb.firebaseio.com",
  projectId: "chatglobal-ef22a",
  storageBucket: "chatglobal-ef22a.firebasestorage.app",
  messagingSenderId: "1069564869864",
  appId: "1:1069564869864:web:0b60df0a913603422a9d5d",
  measurementId: "G-4ZBT61V36P"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
var database = firebase.database();

//---------------------------------------------------------
// Anti Spam Cooldown + Limit karakter
//---------------------------------------------------------
let lastSendTime = 0;
const MAX_CHARS = 250;

let userInteracted = false;
const notificationSound = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_8bfb58b4fc.mp3");
notificationSound.preload = "auto";

//---------------------------------------------------------
// Notification permission
//---------------------------------------------------------
window.addEventListener("click", () => {
  userInteracted = true;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}, { once: true });

//---------------------------------------------------------
// Send Message
//---------------------------------------------------------
function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  const now = Date.now();

  if (message === "") return;
  if (message.length > MAX_CHARS) {
    alert("Pesan terlalu panjang (maks 250)");
    return;
  }
  if (now - lastSendTime < 3000) {
    alert("Tunggu 3 detik lagi");
    return;
  }
  lastSendTime = now;

  database.ref("rooms/" + room + "/messages").push({
    name: username,
    text: message,
    time: new Date().toLocaleTimeString()
  });

  input.value = "";
  database.ref("rooms/" + room + "/typing/" + username).remove(); // stop typing
  userInteracted = true;
}

// Enter event
const messageInput = document.getElementById("messageInput");
if (messageInput) {
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
    sendTypingSignal();
  });
  messageInput.addEventListener("input", sendTypingSignal);
}

//---------------------------------------------------------
// TYPING INDICATOR ✍️
//---------------------------------------------------------
let typingTimeout;
function sendTypingSignal() {
  database.ref("rooms/" + room + "/typing/" + username).set(true);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    database.ref("rooms/" + room + "/typing/" + username).remove();
  }, 1200);
}

const typingStatusDiv = document.getElementById("typingStatus");

database.ref("rooms/" + room + "/typing").on("value", snapshot => {
  const usersTyping = snapshot.val() || {};

  const otherUsers = Object.keys(usersTyping).filter(u => u !== username);
  typingStatusDiv.textContent =
    otherUsers.length > 0 ? `${otherUsers.join(", ")} sedang mengetik...` : "";
});

//---------------------------------------------------------
// Notification + blinking title
//---------------------------------------------------------
let pageFocus = true;
let originalTitle = document.title || "Chat Global";
let blinkInterval = null;

window.onfocus = () => {
  pageFocus = true;
  document.title = originalTitle;
  clearInterval(blinkInterval);
  blinkInterval = null;
};
window.onblur = () => { pageFocus = false; };

function blinkTitle(msg) {
  if (blinkInterval) return;
  let toggle = true;
  blinkInterval = setInterval(() => {
    document.title = toggle ? msg : originalTitle;
    toggle = !toggle;
  }, 700);
  setTimeout(() => {
    clearInterval(blinkInterval);
    blinkInterval = null;
    document.title = originalTitle;
  }, 6000);
}

//---------------------------------------------------------
// Receive messages realtime
//---------------------------------------------------------
database.ref("rooms/" + room + "/messages").on("child_added", snapshot => {
  const data = snapshot.val();
  const chatBox = document.getElementById("chatBox");

  const div = document.createElement("div");
  div.classList.add("chat-message");
  if (data.name === username) div.classList.add("mine");

  div.innerHTML = `<strong>${sanitize(data.name)}</strong>: ${sanitize(data.text)}
  <small>(${sanitize(data.time)})</small>`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (!pageFocus && data.name !== username) {
    if (userInteracted) notificationSound.play().catch(()=>{});
    blinkTitle("🔔 Pesan Baru!");
    if (Notification.permission === "granted") {
      new Notification("Pesan Baru", {
        body: `${data.name}: ${data.text}`
      });
    }
  }
});

//---------------------------------------------------------
// Simple sanitizer
//---------------------------------------------------------
function sanitize(s) {
  return String(s).replace(/[&<>]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;"
  }[c]));
}
