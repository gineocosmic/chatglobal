// ==========================
// script.js - FINAL
// ==========================

// --------------------------
// Helpers & config
// --------------------------
const params = new URLSearchParams(window.location.search);
const room = (params.get("room") || "global").toLowerCase();

// ensure we have a simple room key that uses underscores instead of spaces
const roomKey = room.replace(/\s+/g, "_");

// anonymous user id + username
let userId = localStorage.getItem("chatglobal_id");
if (!userId) {
  userId = "u" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem("chatglobal_id", userId);
}
let username = localStorage.getItem("chatglobal_user");
if (!username) {
  username = "User#" + Math.floor(1000 + Math.random() * 9000);
  localStorage.setItem("chatglobal_user", username);
}

// show username in UI if element exists (back-compat)
const usernameEl = document.getElementById("username");
if (usernameEl) usernameEl.value = username;

// Firebase config (your project)
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
const database = firebase.database();

// UI refs
const chatBox = document.getElementById("chatBox");
const typingStatusDiv = document.getElementById("typingStatus");
const onlineCountDiv = document.getElementById("onlineCount");
const roomTitleEl = document.getElementById("roomTitle");
const toastEl = document.getElementById("toast");
const messageInput = document.getElementById("messageInput");

// constants
const MAX_CHARS = 250;
let lastSendTime = 0;
let userInteracted = false;
const notificationSound = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_8bfb58b4fc.mp3");
notificationSound.preload = "auto";

// Notification permission on first click
window.addEventListener("click", () => {
  userInteracted = true;
  if (Notification.permission === "default") Notification.requestPermission();
}, { once: true });

// --------------------------
// Utility functions
// --------------------------
function sanitize(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s, n){
  if (!s) return "";
  return s.length > n ? s.substr(0,n-1) + "…" : s;
}

// convert country code (e.g. "ID") to flag emoji
function countryCodeToFlagEmoji(cc) {
  if (!cc) return "";
  // cc should be 2 letters
  cc = cc.toUpperCase();
  const OFFSET = 0x1F1E6 - 65; // Regional Indicator Symbol Letter A minus 'A' code
  const chars = [...cc].map(c => String.fromCodePoint(c.charCodeAt(0) + OFFSET)).join('');
  return chars;
}

// show toast for N ms
function showToast(msg, ms = 3000) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.style.display = "none";
  }, ms);
}

// format room display name from key
function formatRoomName(k) {
  return k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// --------------------------
// Header / room title update
// --------------------------
(function initRoomTitle(){
  const display = formatRoomName(roomKey);
  if (roomTitleEl) roomTitleEl.textContent = "Room: " + display;
})();

// --------------------------
// Presence (online users) and country detection
// --------------------------
// We'll detect city/country via ipapi.co; fallback: country empty

let myCity = null;
let myCountry = null;
let myCountryCode = null;

// get geo info (non-blocking). For privacy we only store city and country_code.
fetch("https://ipapi.co/json")
  .then(r => r.json())
  .then(info => {
    myCity = (info.city || "").toLowerCase().replace(/\s+/g,"_") || null;
    myCountry = info.country_name || null;
    myCountryCode = info.country_code || null;
    // after we have country info, we can update presence
    registerPresence();
    // show welcome toast with flag
    const flag = countryCodeToFlagEmoji(myCountryCode);
    showToast(`Selamat datang di ${formatRoomName(roomKey)} ${flag}`, 3500);
    // update header online text initially (flag also)
    updateHeaderOnlineTextPlaceholder();
  })
  .catch(err => {
    console.log("ip detect failed", err);
    // still register presence even without country
    registerPresence();
    updateHeaderOnlineTextPlaceholder();
  });

// presence path: presence/<roomKey>/<userId>
const presenceRef = () => database.ref(`presence/${roomKey}/${userId}`);

function registerPresence(){
  // data we store: username, city, country_code, ts
  const data = {
    username,
    city: myCity || null,
    country_code: myCountryCode || null,
    ts: Date.now()
  };

  // set presence
  presenceRef().set(data).catch(e => console.log("presence set error", e));

  // ensure removal on disconnect
  presenceRef().onDisconnect().remove();

  // also refresh ts periodically (heartbeat)
  setInterval(() => {
    presenceRef().update({ ts: Date.now() }).catch(()=>{});
  }, 30 * 1000); // 30s
}

// listen to presence list and update online counter
database.ref(`presence/${roomKey}`).on("value", snap => {
  const val = snap.val() || {};
  const users = Object.keys(val);
  const count = users.length;

  // build display: 🟢 N Online • RoomName 🇺🇸
  const flag = countryCodeToFlagEmoji(myCountryCode);
  const roomName = formatRoomName(roomKey);
  const displayText = `🟢 ${count} Online • ${roomName} ${flag}`;
  if (onlineCountDiv) onlineCountDiv.textContent = displayText;

  // If count is zero (we're probably the only one), still show room + flag handled above
});

// helper to update header quickly before ipapi resolved
function updateHeaderOnlineTextPlaceholder(){
  const flag = countryCodeToFlagEmoji(myCountryCode);
  const roomName = formatRoomName(roomKey);
  if (onlineCountDiv) onlineCountDiv.textContent = `🟢 - Online • ${roomName} ${flag || ""}`;
}

// --------------------------
// Typing indicator
// --------------------------
let typingTimeout;
function sendTypingSignal() {
  database.ref(`rooms/${roomKey}/typing/${userId}`).set({ username, ts: Date.now() }).catch(()=>{});
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    database.ref(`rooms/${roomKey}/typing/${userId}`).remove().catch(()=>{});
  }, 1200);
}

if (messageInput) {
  messageInput.addEventListener("input", sendTypingSignal);
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendTypingSignal(); // ensure stop typing after send (sendMessage will remove)
    } else {
      sendTypingSignal();
    }
  });
}

// listen for typing list changes
database.ref(`rooms/${roomKey}/typing`).on("value", snap => {
  const val = snap.val() || {};
  const other = Object.keys(val || {}).filter(id => id !== userId).map(id => val[id].username);
  if (typingStatusDiv) {
    typingStatusDiv.textContent = other.length > 0 ? `${other.join(", ")} sedang mengetik...` : "";
  }
});

// --------------------------
// Messages: send / receive
// --------------------------
function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input) return;
  const message = input.value.trim();
  const now = Date.now();

  if (message === "") return;
  if (message.length > MAX_CHARS) {
    alert(`Pesan terlalu panjang (maks ${MAX_CHARS} karakter)`);
    return;
  }
  if (now - lastSendTime < 3000) {
    alert("Tunggu 3 detik sebelum mengirim pesan lagi");
    return;
  }
  lastSendTime = now;

  const payload = {
    userId,
    name: username,
    text: message,
    ts: Date.now(),
    time: new Date().toLocaleTimeString(),
    city: myCity || null,
    country_code: myCountryCode || null
  };

  database.ref(`rooms/${roomKey}/messages`).push(payload).catch(e => console.log("push err", e));
  input.value = "";
  // remove typing signal on send
  database.ref(`rooms/${roomKey}/typing/${userId}`).remove().catch(()=>{});
  userInteracted = true;
}

// support Enter to send also
if (messageInput) {
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
}

// receive messages
let pageFocus = true;
let originalTitle = document.title || "Chat Global";
let blinkInterval = null;
window.onfocus = () => {
  pageFocus = true;
  document.title = originalTitle;
  if (blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }
};
window.onblur = () => { pageFocus = false; };

function startBlinkTitle(msg) {
  if (blinkInterval) return;
  let showAlt = true;
  blinkInterval = setInterval(() => {
    document.title = showAlt ? msg : originalTitle;
    showAlt = !showAlt;
  }, 700);
  setTimeout(() => {
    if (blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; document.title = originalTitle; }
  }, 6000);
}

// message rendering
database.ref(`rooms/${roomKey}/messages`).limitToLast(200).on("child_added", snap => {
  const data = snap.val();
  if (!data) return;

  // build message element
  const div = document.createElement("div");
  div.classList.add("chat-message");
  if (data.userId === userId) div.classList.add("mine");

  // small flag next to username if available
  const flag = data.country_code ? countryCodeToFlagEmoji(data.country_code) + " " : "";

  div.innerHTML = `<strong>${sanitize(flag + (data.name || "Anon"))}</strong>: ${sanitize(data.text)} <small>(${sanitize(data.time)})</small>`;

  if (chatBox) {
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // notifications if not focused & message not from self
  if (!pageFocus && data.userId !== userId) {
    if (userInteracted) {
      notificationSound.play().catch(()=>{});
    }
    startBlinkTitle("🔔 Pesan Baru!");
    if (Notification.permission === "granted") {
      try {
        const n = new Notification(`${data.name}`, { body: truncate(data.text || "", 80) });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (e) {
        console.log("notif error", e);
      }
    }
  }
});

// --------------------------
// Cleanup on unload
// --------------------------
window.addEventListener("beforeunload", () => {
  // remove typing and presence (onDisconnect ideally handles it; but ensure remove)
  database.ref(`rooms/${roomKey}/typing/${userId}`).remove().catch(()=>{});
  presenceRef().remove().catch(()=>{});
});

// --------------------------
// Small UI init: show room name & flag in header
// --------------------------
(function updateHeaderInitial(){
  // if ipapi not ready yet, the presence registration will update later
  const roomPretty = formatRoomName(roomKey);
  // we cannot guarantee country flag yet; update will occur after ipapi fetch
  if (roomTitleEl) {
    roomTitleEl.textContent = `Room: ${roomPretty}`;
  }
})();

// --------------------------
// End of file
// --------------------------
