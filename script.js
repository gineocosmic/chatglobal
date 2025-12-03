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

// Jika ada elemen #username di page (landing lama), tampilkan (opsional)
const usernameDisplay = document.getElementById("username");
if (usernameDisplay) usernameDisplay.value = username;

//---------------------------------------------------------
// Firebase Config (isi milikmu - pastikan sudah ada file firebase.js atau inisialisasi di page)
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

// userInteracted: agar browser mengizinkan play() suara (user harus interaksi dulu)
let userInteracted = false;

// membuat Audio notif — pakai CDN (atau ganti dengan file di repo)
const notificationSound = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_8bfb58b4fc.mp3");
notificationSound.preload = "auto";

//---------------------------------------------------------
// Request Notification permission (tidak memaksa, di-trigger sekali)
//---------------------------------------------------------
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(function(permission) {
      // tidak perlu aksi khusus; permission akan disimpan oleh browser
      console.log("Notification permission:", permission);
    });
  }
}

// optional: minta permission saat user klik pertama kali pada halaman
window.addEventListener("click", () => {
  userInteracted = true;
  requestNotificationPermission();
}, { once: true });

//---------------------------------------------------------
// Kirim pesan
//---------------------------------------------------------
function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input) return;
  const message = input.value.trim();
  const now = Date.now();

  if (message === "") return;

  // Limit karakter
  if (message.length > MAX_CHARS) {
    alert("Pesan terlalu panjang (maksimal " + MAX_CHARS + " karakter)");
    return;
  }

  // Cooldown 3 detik
  if (now - lastSendTime < 3000) {
    alert("Tunggu 3 detik sebelum mengirim pesan lagi");
    return;
  }
  lastSendTime = now;

  // Push pesan ke room tertentu (path per-room)
  database.ref("rooms/" + room + "/messages").push({
    name: username,
    text: message,
    time: new Date().toLocaleTimeString()
  });

  input.value = "";
  // memastikan userInteracted true agar suara bisa dimainkan
  userInteracted = true;
}

// Enter untuk kirim
const messageInputEl = document.getElementById("messageInput");
if (messageInputEl) {
  messageInputEl.addEventListener("keypress", function(e) {
    if (e.key === "Enter") sendMessage();
  });
}

//---------------------------------------------------------
// NOTIFIKASI PESAN BARU + SUARA + JUDUL KEDIP
//---------------------------------------------------------
let pageFocus = true;
let originalTitle = document.title || "Chat Global";
let blinkInterval = null;

window.onfocus = () => {
  pageFocus = true;
  document.title = originalTitle;
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }
};

window.onblur = () => {
  pageFocus = false;
};

function startBlinkTitle(msg) {
  if (blinkInterval) return;
  let showAlt = true;
  blinkInterval = setInterval(() => {
    document.title = showAlt ? msg : originalTitle;
    showAlt = !showAlt;
  }, 700);
  // stop setelah 6 detik
  setTimeout(() => {
    if (blinkInterval) {
      clearInterval(blinkInterval);
      blinkInterval = null;
      document.title = originalTitle;
    }
  }, 6000);
}

function showDesktopNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, { body: body });
      // klik notif → fokus tab
      notif.onclick = function() { window.focus(); notif.close(); };
    } catch (e) {
      // fallback: some browsers block or require interaction
      console.log("Notification error", e);
    }
  }
}

//---------------------------------------------------------
// Ambil pesan realtime per-room
//---------------------------------------------------------
database.ref("rooms/" + room + "/messages").on("child_added", function(snapshot) {
  const data = snapshot.val();
  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;

  const div = document.createElement("div");
  div.classList.add("chat-message");

  // Bedakan warna bubble untuk user sendiri
  if (data.name === username) div.classList.add("mine");

  div.innerHTML = `<strong>${sanitizeHTML(data.name)}</strong>: ${sanitizeHTML(data.text)} <small>(${sanitizeHTML(data.time)})</small>`;

  chatBox.appendChild(div);

  // Auto Scroll (scroll ke bawah)
  chatBox.scrollTop = chatBox.scrollHeight;

  // Notifikasi jika buka tab lain & pesan bukan dari kita
  if (!pageFocus && data.name !== username) {
    // play only if user sudah interaksi minimal 1x (browser policy)
    if (userInteracted) {
      // catch play errors (some browsers block autoplay)
      notificationSound.play().catch(() => {});
    }
    startBlinkTitle("🔔 Pesan Baru!");
    showDesktopNotification("ChatGlobal - Pesan Baru", `${data.name}: ${truncate(data.text, 60)}`);
  }
});

//---------------------------------------------------------
// Util: sanitize simple (hindari XSS)
//---------------------------------------------------------
function sanitizeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// util: truncate
function truncate(s, n){
  if (!s) return "";
  return s.length > n ? s.substr(0,n-1) + "…" : s;
}
