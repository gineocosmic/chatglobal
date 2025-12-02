// 🔥 GANTI DENGAN CONFIG FIREBASE KAMU NANTI
var firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT_ID.firebaseapp.com",
  databaseURL: "https://PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
var database = firebase.database();

var messagesRef = database.ref("globalChat");

// Kirim Pesan
function sendMessage() {
  var username = document.getElementById("username").value;
  var message = document.getElementById("message").value;

  if (username === "" || message === "") return;

  messagesRef.push({
    name: username,
    text: message,
    time: new Date().toLocaleTimeString()
  });

  document.getElementById("message").value = "";
}

// Terima Pesan
messagesRef.limitToLast(50).on("child_added", function(snapshot) {
  var data = snapshot.val();

  var msgDiv = document.createElement("div");
  msgDiv.className = "message";
  msgDiv.innerText = `[${data.time}] ${data.name}: ${data.text}`;

  document.getElementById("messages").appendChild(msgDiv);

  // Auto scroll ke bawah
  var chatBox = document.getElementById("messages");
  chatBox.scrollTop = chatBox.scrollHeight;
});
