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

// Tampilkan nama di UI (optional jika ingin terlihat di form)
const usernameDisplay = document.getElementById("username");
if (usernameDisplay) usernameDisplay.value = username;

//---------------------------------------------------------
// Firebase Config (punyamu)
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var database = firebase.database();

//---------------------------------------------------------
// Anti Spam Cooldown + Limit karakter
//---------------------------------------------------------
let lastSendTime = 0;

// Kirim pesan
function sendMessage() {
  const message = document.getElementById("messageInput").value.trim();
  const now = Date.now();

  if (message === "") return;

  // Limit karakter
  if (message.length > 250) {
    alert("Pesan terlalu panjang (maksimal 250 karakter)");
    return;
  }

  // Cooldown 3 detik
  if (now - lastSendTime < 3000) {
    alert("Tunggu 3 detik sebelum mengirim pesan lagi");
    return;
  }
  lastSendTime = now;

  // Push pesan ke room tertentu
  database.ref("rooms/" + room + "/messages").push({
    name: username,
    text: message,
    time: new Date().toLocaleTimeString()
  });

  document.getElementById("messageInput").value = "";
}

//---------------------------------------------------------
// Ambil pesan realtime per-room
//---------------------------------------------------------
database.ref("rooms/" + room + "/messages").on("child_added", function(snapshot) {
  const data = snapshot.val();
  const chatBox = document.getElementById("chatBox");

  const div = document.createElement("div");
  div.classList.add("chat-message");

  // Bedakan warna bubble untuk user sendiri
  if (data.name === username) div.classList.add("mine");

  div.innerHTML = `<strong>${data.name}</strong>: ${data.text} <small>(${data.time})</small>`;

  chatBox.appendChild(div);

  // Auto Scroll
  chatBox.scrollTop = chatBox.scrollHeight;
});

//---------------------------------------------------------
// Enter untuk kirim
//---------------------------------------------------------
document.getElementById("messageInput").addEventListener("keypress", function(e) {
  if (e.key === "Enter") sendMessage();
});
