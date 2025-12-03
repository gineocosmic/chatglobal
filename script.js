// ------------------------------
// script.js (profile + avatar upload + all features)
// ------------------------------
const params = new URLSearchParams(window.location.search);
const room = (params.get("room") || "global").toLowerCase();
const roomKey = room.replace(/\s+/g, "_");

// Firebase config (isi milikmu)
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
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// UI refs
const chatBox = document.getElementById("chatBox");
const typingStatusDiv = document.getElementById("typingStatus");
const onlineCountDiv = document.getElementById("onlineCount");
const roomTitleEl = document.getElementById("roomTitle");
const toastEl = document.getElementById("toast");
const messageInput = document.getElementById("messageInput");
const profileBtn = document.getElementById("profileBtn");
const profileModal = document.getElementById("profileModal");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const avatarInput = document.getElementById("avatarInput");
const avatarPreview = document.getElementById("avatarPreview");
const profileNameInput = document.getElementById("profileName");
const colorChoices = document.getElementById("colorChoices");

// local user settings stored in localStorage
let localUser = {
  uid: localStorage.getItem("chat_uid") || null,
  username: localStorage.getItem("chat_username") || null,
  color: localStorage.getItem("chat_color") || "#4f9cff",
  avatar: localStorage.getItem("chat_avatar") || null
};

// if no username, generate default
if (!localUser.username) {
  localUser.username = "User#" + Math.floor(1000 + Math.random() * 9000);
}
if (!localUser.uid) {
  // we'll set uid after anonymous auth
}

// show placeholder username in modal if exists
if (profileNameInput) profileNameInput.value = localUser.username;
if (avatarPreview && localUser.avatar) avatarPreview.style.backgroundImage = `url(${localUser.avatar})`;

// Anonymous auth (needed for Storage secure upload)
auth.signInAnonymously().catch(e => console.log("auth err", e));
auth.onAuthStateChanged(user => {
  if (!user) return;
  localUser.authUid = user.uid;
  // persist a stable client id (prefer auth uid)
  localUser.uid = localUser.uid || user.uid;
  localStorage.setItem("chat_uid", localUser.uid);
  // register presence & other realtime features now that auth is ready
  registerPresence();
});

// =================== utilities ===================
function sanitize(s){ if (!s && s!==0) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function truncate(s,n){ if(!s) return ""; return s.length>n? s.substr(0,n-1)+"…" : s; }
function ccToFlag(cc){ if(!cc) return ""; cc = cc.toUpperCase(); const OFFSET = 0x1F1E6 - 65; return [...cc].map(c=>String.fromCodePoint(c.charCodeAt(0)+OFFSET)).join(''); }
function showToast(msg,ms=3000){ if(!toastEl) return; toastEl.textContent = msg; toastEl.style.display = "block"; clearTimeout(toastEl._t); toastEl._t = setTimeout(()=>toastEl.style.display="none", ms); }

// ---------------- presence & online count ----------------
let myCity = null, myCountry = null, myCountryCode = null;
fetch("https://ipapi.co/json").then(r=>r.json()).then(info=>{
  myCity = (info.city||"").toLowerCase().replace(/\s+/g,"_") || null;
  myCountry = info.country_name || null;
  myCountryCode = info.country_code || null;
  updateHeader(); // update header with flag if possible
  showToast(`Selamat datang di ${roomKey.replace(/_/g," ")} ${ccToFlag(myCountryCode)}`,3000);
}).catch(()=>{ updateHeader(); });

// presence path
function presenceRef(){ return db.ref(`presence/${roomKey}/${localUser.uid}`); }

function registerPresence(){
  if (!localUser.uid) return; // wait auth
  const data = { username: localUser.username, avatar: localUser.avatar || null, color: localUser.color, ts: Date.now(), city: myCity || null, country_code: myCountryCode || null };
  presenceRef().set(data).catch(()=>{});
  presenceRef().onDisconnect().remove();
  setInterval(()=>presenceRef().update({ts:Date.now()}).catch(()=>{}), 30000);
  // listen online count
  db.ref(`presence/${roomKey}`).on("value", s => {
    const val = s.val()||{};
    const count = Object.keys(val).length;
    const flag = ccToFlag(myCountryCode);
    if (onlineCountDiv) onlineCountDiv.textContent = `🟢 ${count} Online • ${formatRoomName(roomKey)} ${flag||""}`;
  });
}

function formatRoomName(k){ return k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
function updateHeader(){ if (onlineCountDiv) onlineCountDiv.textContent = `🟢 - Online • ${formatRoomName(roomKey)} ${ccToFlag(myCountryCode)||""}`; }

// ---------------- typing indicator ----------------
let typingTimeout;
function sendTypingSignal(){
  if (!localUser.uid) return;
  db.ref(`rooms/${roomKey}/typing/${localUser.uid}`).set({username: localUser.username, ts: Date.now()}).catch(()=>{});
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(()=>{ db.ref(`rooms/${roomKey}/typing/${localUser.uid}`).remove().catch(()=>{}); }, 1200);
}
if (messageInput){
  messageInput.addEventListener("input", sendTypingSignal);
  messageInput.addEventListener("keypress", e=>{ if(e.key==="Enter"){ sendTypingSignal(); } else sendTypingSignal(); });
}
db.ref(`rooms/${roomKey}/typing`).on("value", s=>{
  const val = s.val()||{};
  const other = Object.keys(val||{}).filter(id=>id!==localUser.uid).map(id=>val[id].username);
  typingStatusDiv.textContent = other.length>0 ? `${other.join(", ")} sedang mengetik...` : "";
});

// ---------------- messages send/receive ----------------
const MAX_CHARS = 250;
let lastSend = 0;
function sendMessage(){
  const el = document.getElementById("messageInput");
  if(!el) return;
  const txt = el.value.trim();
  const now = Date.now();
  if (!txt) return;
  if (txt.length>MAX_CHARS){ alert(`Pesan terlalu panjang (maks ${MAX_CHARS})`); return; }
  if (now - lastSend < 3000){ alert("Tunggu 3 detik sebelum mengirim lagi"); return; }
  lastSend = now;

  const payload = {
    userId: localUser.uid,
    name: localUser.username,
    text: txt,
    time: new Date().toLocaleTimeString(),
    color: localUser.color,
    avatar: localUser.avatar || null,
    ts: Date.now()
  };
  db.ref(`rooms/${roomKey}/messages`).push(payload).catch(e=>console.log(e));
  el.value = "";
  // remove typing
  db.ref(`rooms/${roomKey}/typing/${localUser.uid}`).remove().catch(()=>{});
}

// render message with avatar and color
db.ref(`rooms/${roomKey}/messages`).limitToLast(200).on("child_added", snap=>{
  const data = snap.val();
  if(!data) return;
  const div = document.createElement("div");
  div.classList.add("chat-message");
  if (data.userId === localUser.uid) div.classList.add("mine");

  // avatar
  const avatarDiv = document.createElement("div");
  avatarDiv.classList.add("msg-avatar");
  if (data.avatar) {
    avatarDiv.style.backgroundImage = `url(${data.avatar})`;
    avatarDiv.style.backgroundSize = "cover";
    avatarDiv.style.backgroundPosition = "center";
  } else {
    // show initials
    const initials = (data.name||"U").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
    avatarDiv.textContent = initials;
    avatarDiv.style.background = data.color || localUser.color;
  }

  // message body
  const body = document.createElement("div");
  body.classList.add("msg-body");
  const name = document.createElement("span");
  name.classList.add("msg-name");
  name.textContent = `${data.name || "Anon"}`;
  const text = document.createElement("div");
  text.innerHTML = sanitize(data.text) + `<div style="font-size:11px;color:#666;margin-top:6px;">(${sanitize(data.time)})</div>`;

  body.appendChild(name);
  body.appendChild(text);

  div.appendChild(avatarDiv);
  div.appendChild(body);

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// notification + blink (kept simple)
let pageFocus = true; let origTitle = document.title || "Chat Global"; let blinkInt = null;
window.onfocus = ()=>{ pageFocus = true; document.title = origTitle; if (blinkInt) { clearInterval(blinkInt); blinkInt=null; } };
window.onblur = ()=>{ pageFocus = false; };
db.ref(`rooms/${roomKey}/messages`).limitToLast(1).on("child_added", s=>{
  const d = s.val();
  if (!d) return;
  if (!pageFocus && d.userId !== localUser.uid) {
    // play sound (if user interacted)
    try{ if (window.__userInteracted) { (new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_8bfb58b4fc.mp3")).play().catch(()=>{}); } }catch(e){}
    // blink
    if (!blinkInt) {
      let alt=true; blinkInt = setInterval(()=>{ document.title = alt? "🔔 Pesan Baru!": origTitle; alt=!alt; },700);
      setTimeout(()=>{ clearInterval(blinkInt); blinkInt=null; document.title=origTitle; },5000);
    }
    // desktop notif
    if (Notification.permission==="granted") {
      try{ const n=new Notification(`${d.name}`,{body:truncate(d.text,80)}); n.onclick=()=>{ window.focus(); n.close(); } }catch(e){}
    }
  }
});

// ---------------- profile modal handling & avatar upload ----------------
profileBtn.addEventListener("click", ()=>{ profileModal.setAttribute("aria-hidden","false"); });
closeProfileBtn.addEventListener("click", ()=>{ profileModal.setAttribute("aria-hidden","true"); });

// color pick logic
document.querySelectorAll('.color-dot').forEach(btn=>{
  btn.addEventListener("click", ()=> {
    document.querySelectorAll('.color-dot').forEach(x=>x.classList.remove('selected'));
    btn.classList.add('selected');
    localUser.color = btn.getAttribute('data-color');
  });
});

// avatar preview read
let selectedFile = null;
avatarInput.addEventListener("change", (ev)=>{
  const f = ev.target.files[0];
  if (!f) return;
  if (f.size > 2*1024*1024) { alert("Ukuran file maksimal 2MB"); avatarInput.value=""; return; }
  selectedFile = f;
  // preview
  const reader = new FileReader();
  reader.onload = e => {
    avatarPreview.style.backgroundImage = `url(${e.target.result})`;
    avatarPreview.style.display = "block";
  };
  reader.readAsDataURL(f);
});

// save profile: name, color, upload avatar if provided
saveProfileBtn.addEventListener("click", async ()=>{
  const newName = profileNameInput.value.trim();
  if (newName) {
    localUser.username = newName;
    localStorage.setItem("chat_username", localUser.username);
  }
  // if color not set, read selected
  const sel = document.querySelector('.color-dot.selected');
  if (sel) localUser.color = sel.getAttribute('data-color');
  localStorage.setItem("chat_color", localUser.color);

  // upload avatar if a file selected
  if (selectedFile) {
    try {
      // ensure auth ready
      const currentUser = auth.currentUser;
      if (!currentUser) { alert("Tunggu sebentar, koneksi auth belum siap."); return; }
      const ext = selectedFile.name.split('.').pop();
      const storageRef = storage.ref().child(`avatars/${currentUser.uid}.${ext}`);
      const task = storageRef.put(selectedFile);
      showToast("Mengunggah foto...");
      await task;
      const url = await storageRef.getDownloadURL();
      localUser.avatar = url;
      localStorage.setItem("chat_avatar", url);
      // update presence node if exists
      if (localUser.uid) db.ref(`presence/${roomKey}/${localUser.uid}`).update({ avatar: url }).catch(()=>{});
      showToast("Foto profil tersimpan", 2000);
    } catch (e) {
      console.error("upload error", e);
      alert("Upload gagal. Coba lagi.");
    }
  } else {
    // no new avatar, keep existing
  }

  // update presence username/color
  if (localUser.uid) {
    db.ref(`presence/${roomKey}/${localUser.uid}`).update({ username: localUser.username, color: localUser.color, avatar: localUser.avatar || null }).catch(()=>{});
  }

  profileModal.setAttribute("aria-hidden","true");
});

// ---------------- helper: ensure presence uses a stable uid ----------------
(function ensureLocalUid(){
  if (!localUser.uid) {
    // if auth exists, prefer auth.uid
    if (auth.currentUser && auth.currentUser.uid) {
      localUser.uid = auth.currentUser.uid;
      localStorage.setItem("chat_uid", localUser.uid);
    } else {
      // fallback generate
      localUser.uid = localStorage.getItem("chat_uid") || "u"+Math.random().toString(36).slice(2,9);
      localStorage.setItem("chat_uid", localUser.uid);
    }
  }
})();

// register presence if auth already ready
if (auth.currentUser) registerPresence();

// ---------------- cleanup on leave ----------------
window.addEventListener("beforeunload", ()=>{
  if (localUser && localUser.uid) {
    db.ref(`rooms/${roomKey}/typing/${localUser.uid}`).remove().catch(()=>{});
    db.ref(`presence/${roomKey}/${localUser.uid}`).remove().catch(()=>{});
  }
});
