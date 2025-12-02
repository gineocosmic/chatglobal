// Firebase Config milik kamu
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

// Kirim pesan
function sendMessage() {
  var username = document.getElementById("username").value;
  var message = document.getElementById("messageInput").value;

  if (username === "" || message === "") return;

  database.ref("messages").push({
    name: username,
    text: message,
    time: new Date().toLocaleTimeString()
  });

  document.getElementById("messageInput").value = "";
}

// Ambil pesan realtime
database.ref("messages").on("child_added", function(snapshot) {
  var data = snapshot.val();
  var chatBox = document.getElementById("chatBox");

  var div = document.createElement("div");
  div.classList.add("chat-message");
  div.innerHTML = `<span>${data.name}</span>: ${data.text} <small>(${data.time})</small>`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});
