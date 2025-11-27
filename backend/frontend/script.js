// ---------------------------------------------------
//  Women Safety App – FINAL LEVEL-2 FULL SCRIPT
// ---------------------------------------------------

const API_BASE = "http://localhost:5000/api";

// ----- Helper for getting elements -----
function $id(id) {
  return document.getElementById(id);
}

// ----- Toast notification -----
const toastEl = $id("toast");
function showToast(msg, time = 2500) {
  if (!toastEl) return console.log("Toast:", msg);
  toastEl.innerText = msg;
  toastEl.style.display = "block";
  setTimeout(() => (toastEl.style.display = "none"), time);
}

// ----- Log helper -----
const logDiv = $id("log");
function log(msg) {
  if (logDiv)
    logDiv.innerText = new Date().toLocaleTimeString() + " - " + msg;
  else console.log(msg);
}

// ----- DOM references -----
const signupBox = $id("signup-box");
const loginBox = $id("login-box");
const dashBox = $id("dash-box");

const btnSignup = $id("btn-signup");
const btnLogin = $id("btn-login");
const toLogin = $id("to-login");
const toSignup = $id("to-signup");

const welcome = $id("welcome");
const contactsListDiv = $id("contacts-list");
const addContactBtn = $id("add-contact");

const btnTrack = $id("btn-track");
const btnStop = $id("btn-stop");
const btnSos = $id("btn-sos");

const navSignup = $id("nav-signup");
const navLogin = $id("nav-login");
const navLogout = $id("nav-logout");

const locStatus = $id("loc-status");

const fakeCallBtn = $id("btn-fake-call");
const fakeCallScreen = $id("fake-call-screen");
const fakeCallEnd = $id("fake-call-end");

let currentUser = null;
let watchId = null;
let map = null;
let marker = null;
let fakeRingtone = null;

// ----- UI Switch -----
function showOnly(view) {
  signupBox.style.display = view === "signup" ? "block" : "none";
  loginBox.style.display = view === "login" ? "block" : "none";
  dashBox.style.display = view === "dash" ? "block" : "none";
}

// Navigation events
navSignup?.addEventListener("click", () => showOnly("signup"));
navLogin?.addEventListener("click", () => showOnly("login"));
navLogout?.addEventListener("click", () => logout());

toLogin?.addEventListener("click", (e) => {
  e.preventDefault();
  showOnly("login");
});
toSignup?.addEventListener("click", (e) => {
  e.preventDefault();
  showOnly("signup");
});

// ---------------------------
// SIGNUP
// ---------------------------
btnSignup?.addEventListener("click", async () => {
  const name = $id("su-name").value.trim();
  const email = $id("su-email").value.trim();
  const phone = $id("su-phone").value.trim();
  const password = $id("su-password").value;

  if (!name || !email || !password)
    return showToast("Please fill all required fields");

  try {
    const res = await fetch(API_BASE + "/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const j = await res.json();

    if (j.ok) {
      showToast("Signup successful. Please login.");
      showOnly("login");
    } else showToast(j.error || "Signup failed");
  } catch {
    showToast("Server error");
  }
});

// ---------------------------
// LOGIN
// ---------------------------
btnLogin?.addEventListener("click", async () => {
  const email = $id("li-email").value.trim();
  const password = $id("li-password").value;

  if (!email || !password) return showToast("Enter credentials");

  try {
    const res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await res.json();

    if (j.ok) {
      currentUser = j.user;
      sessionStorage.setItem("user", JSON.stringify(currentUser));
      showOnly("dash");
      welcome.innerText = `Welcome, ${currentUser.name}`;
      initMap();
      loadContacts();

      navSignup.style.display = "none";
      navLogin.style.display = "none";
      navLogout.style.display = "inline-block";

      showToast("Logged in");
    } else showToast("Invalid login");
  } catch {
    showToast("Server error");
  }
});

// ---------------------------
// LOGOUT
// ---------------------------
function logout() {
  sessionStorage.removeItem("user");
  currentUser = null;
  showOnly("login");

  navSignup.style.display = "inline-block";
  navLogin.style.display = "inline-block";
  navLogout.style.display = "none";

  if (watchId) navigator.geolocation.clearWatch(watchId);
  showToast("Logged out");
}

// ---------------------------
// ADD CONTACT
// ---------------------------
addContactBtn?.addEventListener("click", async () => {
  const name = $id("c-name").value.trim();
  const phone = $id("c-phone").value.trim();

  if (!name || !phone) return showToast("Enter name & phone");

  const current = Array.from(
    document.querySelectorAll(".contact-item")
  ).map((el) => ({
    name: el.dataset.name,
    phone: el.dataset.phone,
  }));
  current.push({ name, phone });

  try {
    const res = await fetch(API_BASE + "/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, contacts: current }),
    });

    const j = await res.json();

    if (j.ok) {
      $id("c-name").value = "";
      $id("c-phone").value = "";
      loadContacts();
      showToast("Contacts saved");
    }
  } catch {
    showToast("Server error");
  }
});

// ---------------------------
// LOAD CONTACTS
// ---------------------------
async function loadContacts() {
  const res = await fetch(API_BASE + `/contacts/${currentUser.id}`);
  const j = await res.json();

  // ⭐ VERY IMPORTANT ⭐
  window.allEmergencyContacts = j.contacts;

  contactsListDiv.innerHTML = "";

  if (!j.contacts.length) {
    contactsListDiv.innerHTML = "<div class='muted'>No contacts added</div>";
    return;
  }

  j.contacts.forEach((c) => {
    const el = document.createElement("div");
    el.className = "contact-item";
    el.dataset.name = c.name;
    el.dataset.phone = c.phone;

    el.innerHTML = `
      <div>
        <strong>${c.name}</strong>
        <div class="muted">${c.phone}</div>
      </div>
      <button class="outline small" onclick="removeContact('${c.id}')">Remove</button>
    `;
    contactsListDiv.appendChild(el);
  });
}

window.removeContact = async function (id) {
  const res = await fetch(API_BASE + `/contacts/${currentUser.id}`);
  const j = await res.json();

  const updated = j.contacts.filter((c) => c.id !== id);

  await fetch(API_BASE + "/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: currentUser.id, contacts: updated }),
  });

  loadContacts();
  showToast("Contact removed");
};

// ---------------------------
// MAP + TRACKING
// ---------------------------
function initMap() {
  if (map) return;
  map = L.map("map").setView([20.5937, 78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);
}

btnTrack?.addEventListener("click", () => {
  btnTrack.style.display = "none";
  btnStop.style.display = "inline-block";

  watchId = navigator.geolocation.watchPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    locStatus.innerText = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;

    if (marker) marker.setLatLng([lat, lon]);
    else marker = L.marker([lat, lon]).addTo(map).bindPopup("You are here");

    map.setView([lat, lon], 15);

    await fetch(API_BASE + "/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, latitude: lat, longitude: lon }),
    });
  });
});

btnStop?.addEventListener("click", () => {
  navigator.geolocation.clearWatch(watchId);
  btnStop.style.display = "none";
  btnTrack.style.display = "inline-block";
  showToast("Tracking stopped");
});

// ---------------------------
// AUTO SOS (WHATSAPP)
// ---------------------------
async function triggerSOS_Auto() {
  if (!currentUser) return showToast("Login required");

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const msg =
`🚨 *SOS Alert!*

I am in danger. I need help urgently!

📍 *Live Location:*
https://maps.google.com/?q=${lat},${lon}

⚡ Please respond immediately.`;

    if (!window.allEmergencyContacts || window.allEmergencyContacts.length === 0)
      return showToast("No emergency contacts saved");

   window.allEmergencyContacts.forEach((contact) => {
  const clean = "91" + contact.phone.replace(/\D/g, "");

  window.open(
    `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(msg)}`,
    "_blank"
  );
});

    showToast("WhatsApp alerts sent");
  });
}

// ---------------------------
// COUNTDOWN SOS
// ---------------------------
btnSos?.addEventListener("click", () => {
  let t = 5;
  btnSos.innerText = `Sending in ${t}... Tap to cancel`;
  btnSos.style.background = "#444";

  const timer = setInterval(() => {
    t--;
    btnSos.innerText = `Sending in ${t}... Tap to cancel`;
    if (t <= 0) {
      clearInterval(timer);
      btnSos.style.background = "";
      btnSos.innerText = "🚨 SOS";
      triggerSOS_Auto();
    }
  }, 1000);

  btnSos.onclick = () => {
    clearInterval(timer);
    btnSos.style.background = "";
    btnSos.innerText = "🚨 SOS";
    showToast("Cancelled");
  };
});

// ---------------------------
// SHAKE DETECTOR SOS
// ---------------------------
let lastX, lastY, lastZ;
let threshold = 15;

window.addEventListener("devicemotion", (e) => {
  const a = e.accelerationIncludingGravity;
  if (!a) return;

  if (lastX !== undefined) {
    const diff = Math.abs(lastX - a.x) + Math.abs(lastY - a.y) + Math.abs(lastZ - a.z);
    if (diff > threshold) {
      showToast("Shake detected - SOS");
      triggerSOS_Auto();
    }
  }

  lastX = a.x;
  lastY = a.y;
  lastZ = a.z;
});

// ---------------------------
// FAKE CALL
// ---------------------------
fakeCallBtn?.addEventListener("click", () => {
  showToast("Fake call in 3 seconds...");

  setTimeout(() => {
    fakeCallScreen.style.display = "flex";
    fakeRingtone = new Audio(
      "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"
    );
    fakeRingtone.loop = true;
    fakeRingtone.play();
  }, 3000);
});

fakeCallEnd?.addEventListener("click", () => {
  fakeRingtone.pause();
  fakeCallScreen.style.display = "none";
});

// ---------------------------
// VOICE COMMAND "HELP ME"
// ---------------------------
try {
  window.SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const recog = new SpeechRecognition();
  recog.lang = "en-US";
  recog.continuous = true;

  recog.onresult = (e) => {
    const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
    if (text.includes("help me")) {
      showToast("Voice SOS Triggered");
      triggerSOS_Auto();
    }
  };

  recog.start();
} catch {
  console.warn("Voice not supported");
}

// ---------------------------
// SESSION RESTORE
// ---------------------------
(function () {
  const u = sessionStorage.getItem("user");
  if (u) {
    currentUser = JSON.parse(u);
    showOnly("dash");
    welcome.innerText = `Welcome, ${currentUser.name}`;
    initMap();
    loadContacts();
    navSignup.style.display = "none";
    navLogin.style.display = "none";
    navLogout.style.display = "inline-block";
  } else {
    showOnly("signup");
  }
})();
