// Women Safety App Backend (Final Version With Fast2SMS Integration)
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ------------------------------
// Database (file based)
// ------------------------------
const DATA_PATH = path.join(__dirname, 'data.json');
const readDB = () => JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const writeDB = (obj) => fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2));

// ------------------------------
// FAST2SMS API KEY (Your Key)
// ------------------------------
const FAST2SMS_KEY = "FjPkoHBAefhDJ4tY0Zp2dq7NzQG59lVbIW68TryvLgOCsUEmSa5a2mIrHGyVctbBJd9qEwLDsSvWhNMx";

// ------------------------------
// Function to send SOS SMS
// ------------------------------
async function sendEmergencySMS(contacts, name, lat, lon) {
  const message = `🚨 SOS ALERT!
${name} is in danger.
Live Location: https://www.google.com/maps?q=${lat},${lon}`;

  const phoneNumbers = contacts.map(c => c.phone).join(",");

  try {
    await axios.post("https://www.fast2sms.com/dev/bulkV2", {
      message: message,
      language: "english",
      route: "q",
      numbers: phoneNumbers
    }, {
      headers: {
        authorization: FAST2SMS_KEY
      }
    });

    console.log("✔ SMS Sent Successfully!");
    return true;

  } catch (err) {
    console.error("❌ SMS Error:", err.response?.data || err);
    return false;
  }
}

// ------------------------------
// SIGNUP
// ------------------------------
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Missing fields' });

    const db = readDB();
    if (db.users.find(u => u.email === email))
      return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      name,
      email,
      password: hashed,
      phone: phone || null,
      createdAt: Date.now()
    };

    db.users.push(user);
    writeDB(db);

    res.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------
// LOGIN
// ------------------------------
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();

    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------
// SAVE CONTACTS
// ------------------------------
app.post('/api/contacts', (req, res) => {
  try {
    const { userId, contacts } = req.body;
    if (!userId || !Array.isArray(contacts))
      return res.status(400).json({ error: 'Invalid payload' });

    const db = readDB();

    // Remove old contacts
    db.contacts = db.contacts.filter(c => c.userId !== userId);

    contacts.forEach(c => {
      db.contacts.push({
        id: uuidv4(),
        userId,
        name: c.name,
        phone: c.phone
      });
    });

    writeDB(db);
    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------
// GET CONTACTS
// ------------------------------
app.get('/api/contacts/:userId', (req, res) => {
  const db = readDB();
  const list = db.contacts.filter(c => c.userId === req.params.userId);
  res.json({ ok: true, contacts: list });
});

// ------------------------------
// SOS (Send SMS + Save Alert)
// ------------------------------
app.post('/api/sos', async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;

    if (!userId || !latitude || !longitude)
      return res.status(400).json({ error: 'Missing fields' });

    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    const contacts = db.contacts.filter(c => c.userId === userId);

    const smsSent = await sendEmergencySMS(
      contacts,
      user?.name || "User",
      latitude,
      longitude
    );

    // Store history
    const alert = {
      id: uuidv4(),
      userId,
      latitude,
      longitude,
      time: Date.now()
    };

    db.alerts.push(alert);
    writeDB(db);

    res.json({ ok: smsSent, alertId: alert.id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------
// LIVE LOCATION UPDATE
// ------------------------------
app.post('/api/location', (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;

    const db = readDB();
    const user = db.users.find(u => u.id === userId);

    if (user) {
      user.lastLocation = { latitude, longitude, time: Date.now() };
      writeDB(db);
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Backend running on port", PORT));
