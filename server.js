import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "storage.json");

// ponytail: lightweight JSON disk persistence without heavy DB drivers
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getBpmZone(bpm) {
  if (!bpm || bpm <= 0) return "REST";
  if (bpm >= 170) return "PEAK";
  if (bpm >= 140) return "ANAEROBIC";
  if (bpm >= 100) return "AEROBIC";
  return "REST";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return verify === hash;
}

function generateStreamKey() {
  return "sk_live_" + crypto.randomBytes(12).toString("hex");
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach(cookie => {
    let [name, ...rest] = cookie.split("=");
    name = name.trim();
    if (!name) return;
    list[name] = decodeURIComponent(rest.join("=").trim());
  });
  return list;
}

let db = {
  accounts: {},
  sessions: {},
  users: {
    streamer: {
      userId: "streamer",
      name: "Streamer",
      streamKey: "sk_live_demo_streamer",
      currentSteps: 0,
      targetSteps: 5000,
      bpm: 0,
      bpmZone: "REST",
      lastBpmTimestamp: 0,
      todayStart: new Date().toISOString().split("T")[0],
      lastMilestone: 0,
      activityStatus: "IDLE",
      lastStepTimestamp: Date.now(),
      recentPaces: [],
      donationSettings: {
        enabled: true,
        secretToken: "",
        conversionRate: 10,
        mode: "subathon_target",
        minAmount: 1000
      },
      donations: [],
      lastUpdated: new Date().toISOString()
    }
  },
  rooms: {
    global: {
      roomId: "global",
      name: "Global Walking Room",
      isPrivate: false,
      passcode: "",
      targetSteps: 10000,
      members: ["streamer"],
      createdAt: new Date().toISOString()
    }
  }
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    db.accounts = parsed.accounts || {};
    db.sessions = parsed.sessions || {};
    db.users = { ...db.users, ...(parsed.users || {}) };
    db.rooms = { ...db.rooms, ...(parsed.rooms || {}) };
  } catch (err) {
    console.error("[Storage] Failed to read storage.json, using defaults:", err.message);
  }
}

// Clean up expired sessions periodically (every 1 hour)
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const token in db.sessions) {
    if (db.sessions[token].expiresAt && db.sessions[token].expiresAt < now) {
      delete db.sessions[token];
      changed = true;
    }
  }
  if (changed) saveDB();
}, 3600000);

function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[Storage] Failed to write storage.json:", err.message);
  }
}

function findUserByStreamKey(streamKey) {
  if (!streamKey) return null;
  for (const userId in db.users) {
    if (db.users[userId].streamKey === streamKey) {
      return db.users[userId];
    }
  }
  for (const accId in db.accounts) {
    if (db.accounts[accId].streamKey === streamKey) {
      return getUser(accId);
    }
  }
  return null;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Session authentication middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookies = parseCookies(req.headers["cookie"]);
  const sessionToken = bearerToken || cookies["stepaway_session"] || req.query.sessionToken;

  if (sessionToken && db.sessions[sessionToken]) {
    const session = db.sessions[sessionToken];
    if (!session.expiresAt || session.expiresAt > Date.now()) {
      const account = db.accounts[session.accountId];
      if (account) {
        req.account = account;
        req.user = getUser(account.id);
        return next();
      }
    }
  }
  req.account = null;
  req.user = null;
  next();
}

app.use(authMiddleware);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const clients = new Map();
let clientCounter = 0;

function getUser(userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      userId,
      name: userId,
      currentSteps: 0,
      targetSteps: 5000,
      bpm: 0,
      bpmZone: "REST",
      lastBpmTimestamp: 0,
      todayStart: new Date().toISOString().split("T")[0],
      lastMilestone: 0,
      activityStatus: "IDLE",
      lastStepTimestamp: Date.now(),
      recentPaces: [],
      donationSettings: {
        enabled: true,
        secretToken: "",
        conversionRate: 10, // 10 IDR = 1 step (Rp 10.000 = +1.000 steps)
        mode: "subathon_target", // "subathon_target" | "direct_step"
        minAmount: 1000
      },
      donations: [],
      lastUpdated: new Date().toISOString()
    };
    saveDB();
  } else {
    // Ensure default donation settings exist for legacy entries
    if (!db.users[userId].donationSettings) {
      db.users[userId].donationSettings = {
        enabled: true,
        secretToken: "",
        conversionRate: 10,
        mode: "subathon_target",
        minAmount: 1000
      };
    }
    if (!Array.isArray(db.users[userId].donations)) {
      db.users[userId].donations = [];
    }
  }
  return db.users[userId];
}

function calculateActivityStatus(user, delta) {
  const now = Date.now();
  if (!user.recentPaces) user.recentPaces = [];

  user.recentPaces.push({ time: now, delta: Math.max(1, delta) });
  user.recentPaces = user.recentPaces.filter(p => now - p.time <= 4000);

  const totalStepsInWindow = user.recentPaces.reduce((sum, p) => sum + p.delta, 0);
  const stepsPerSec = totalStepsInWindow / 4.0;
  const spm = stepsPerSec * 60;

  if (spm >= 130) {
    user.activityStatus = "RUNNING";
  } else if (spm >= 25) {
    user.activityStatus = "WALKING";
  } else {
    user.activityStatus = "IDLE";
  }

  user.lastStepTimestamp = now;
  return user.activityStatus;
}

// Periodic check to reset activity to IDLE if no steps in 6 seconds
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const userId in db.users) {
    const user = db.users[userId];
    if (user.activityStatus !== "IDLE" && now - (user.lastStepTimestamp || 0) > 5500) {
      user.activityStatus = "IDLE";
      user.recentPaces = [];
      changed = true;
      broadcastUserUpdate(user, 0, null);
    }
  }
  if (changed) saveDB();
}, 2500);

function checkMilestone(prevSteps, newSteps) {
  const prevThousands = Math.floor(prevSteps / 1000);
  const newThousands = Math.floor(newSteps / 1000);
  if (newThousands > prevThousands && newThousands > 0) {
    return newThousands * 1000;
  }
  return null;
}

function broadcastUserUpdate(user, delta = 0, milestone = null) {
  const percentage = Math.min(100, Math.round((user.currentSteps / Math.max(1, user.targetSteps)) * 100));
  const payload = JSON.stringify({
    type: "step_update",
    userId: user.userId,
    data: {
      userId: user.userId,
      name: user.name,
      currentSteps: user.currentSteps,
      targetSteps: user.targetSteps,
      bpm: user.bpm || 0,
      bpmZone: user.bpmZone || "REST",
      activityStatus: user.activityStatus || "IDLE",
      percentage,
      delta,
      milestone,
      lastUpdated: user.lastUpdated
    }
  });

  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (client.subscribedUsers.has(user.userId) || client.subscribedUsers.has("*")) {
        client.ws.send(payload);
      }
      if (client.subscribedRooms.size > 0) {
        for (const roomId of client.subscribedRooms) {
          const room = db.rooms[roomId];
          if (room && room.members.includes(user.userId)) {
            client.ws.send(payload);
            break;
          }
        }
      }
    }
  }
}

function broadcastDonationAlert(user, donationData) {
  const percentage = Math.min(100, Math.round((user.currentSteps / Math.max(1, user.targetSteps)) * 100));
  const payload = JSON.stringify({
    type: "donation_alert",
    userId: user.userId,
    data: {
      userId: user.userId,
      name: user.name,
      currentSteps: user.currentSteps,
      targetSteps: user.targetSteps,
      percentage,
      donation: donationData
    }
  });

  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (client.subscribedUsers.has(user.userId) || client.subscribedUsers.has("*")) {
        client.ws.send(payload);
      }
    }
  }
}

function getGoogleRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/auth/google/callback`;
}

// REST APIs: Authentication & Multi-Tenant SaaS
app.get("/api/auth/google/status", (req, res) => {
  res.json({
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

app.get("/api/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Google OAuth Belum Dikonfigurasi</title></head>
      <body style="background:#0b0f19; color:#f8fafc; font-family:sans-serif; padding:40px; text-align:center;">
        <h2 style="color:#ef4444;">Google OAuth Belum Dikonfigurasi</h2>
        <p style="color:#94a3b8; max-width:520px; margin:0 auto 20px; line-height: 1.6;">
          Variabel <code>GOOGLE_CLIENT_ID</code> dan <code>GOOGLE_CLIENT_SECRET</code> belum diset pada server environment.
        </p>
        <a href="/dashboard" style="display:inline-block; padding:10px 22px; background:#6366f1; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">Kembali ke Dashboard</a>
      </body>
      </html>
    `);
  }

  const redirectUri = getGoogleRedirectUri(req);
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state
  }).toString();

  res.redirect(authUrl);
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`/dashboard?auth_error=${encodeURIComponent(error || "Akses Google dibatalkan")}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri(req);

  if (!clientId || !clientSecret) {
    return res.redirect(`/dashboard?auth_error=${encodeURIComponent("Kredensial Google OAuth server belum lengkap")}`);
  }

  try {
    // 1. Exchange code for access token (ponytail: native standard fetch)
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[Google OAuth Token Error]", tokenData);
      return res.redirect(`/dashboard?auth_error=${encodeURIComponent(tokenData.error_description || "Gagal verifikasi token Google")}`);
    }

    // 2. Fetch User Profile (ponytail: native standard fetch)
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();

    if (!profileRes.ok || !profile.email) {
      return res.redirect(`/dashboard?auth_error=${encodeURIComponent("Gagal membaca profil Google")}`);
    }

    const cleanEmail = profile.email.trim().toLowerCase();
    const googleSub = profile.sub;
    const name = profile.name || profile.given_name || cleanEmail.split("@")[0];

    // 3. Find or Create Account
    let foundAccount = null;
    for (const accId in db.accounts) {
      const acc = db.accounts[accId];
      if (acc.googleId === googleSub || acc.email === cleanEmail) {
        foundAccount = acc;
        break;
      }
    }

    if (!foundAccount) {
      const accountId = "usr_" + crypto.randomBytes(6).toString("hex");
      const streamKey = generateStreamKey();
      foundAccount = {
        id: accountId,
        email: cleanEmail,
        name: name,
        googleId: googleSub,
        avatar: profile.picture || "",
        passwordHash: null,
        salt: null,
        streamKey,
        plan: "creator_free",
        createdAt: new Date().toISOString()
      };
      db.accounts[accountId] = foundAccount;

      const userObj = getUser(accountId);
      userObj.name = name;
      userObj.streamKey = streamKey;
      saveDB();
    } else {
      if (!foundAccount.googleId) {
        foundAccount.googleId = googleSub;
      }
      if (profile.picture && !foundAccount.avatar) {
        foundAccount.avatar = profile.picture;
      }
      saveDB();
    }

    // 4. Create Session
    const sessionToken = "sess_" + crypto.randomBytes(32).toString("hex");
    db.sessions[sessionToken] = {
      accountId: foundAccount.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    saveDB();

    res.setHeader("Set-Cookie", `stepaway_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    return res.redirect("/dashboard?auth=google_success");
  } catch (err) {
    console.error("[Google OAuth Callback Error]", err);
    return res.redirect(`/dashboard?auth_error=${encodeURIComponent(err.message || "Terjadi kesalahan sistem")}`);
  }
});

app.post("/api/auth/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ success: false, message: "Format email tidak valid" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
  }

  const cleanEmail = email.trim().toLowerCase();
  for (const accId in db.accounts) {
    if (db.accounts[accId].email === cleanEmail) {
      return res.status(400).json({ success: false, message: "Email sudah terdaftar. Silakan login." });
    }
  }

  const accountId = "usr_" + crypto.randomBytes(6).toString("hex");
  const { hash, salt } = hashPassword(password);
  const streamKey = generateStreamKey();
  const displayName = (name && name.trim()) ? name.trim() : cleanEmail.split("@")[0];

  const newAccount = {
    id: accountId,
    email: cleanEmail,
    name: displayName,
    passwordHash: hash,
    salt,
    streamKey,
    plan: "creator_free",
    createdAt: new Date().toISOString()
  };

  db.accounts[accountId] = newAccount;

  // Initialize user profile
  const userObj = getUser(accountId);
  userObj.name = displayName;
  userObj.streamKey = streamKey;
  saveDB();

  // Create session
  const sessionToken = "sess_" + crypto.randomBytes(32).toString("hex");
  db.sessions[sessionToken] = {
    accountId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  };
  saveDB();

  res.setHeader("Set-Cookie", `stepaway_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

  res.json({
    success: true,
    message: "Pendaftaran berhasil",
    sessionToken,
    account: {
      id: newAccount.id,
      email: newAccount.email,
      name: newAccount.name,
      streamKey: newAccount.streamKey,
      plan: newAccount.plan
    },
    userState: userObj
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email dan password wajib diisi" });
  }

  const cleanEmail = email.trim().toLowerCase();
  let foundAccount = null;

  for (const accId in db.accounts) {
    if (db.accounts[accId].email === cleanEmail) {
      foundAccount = db.accounts[accId];
      break;
    }
  }

  if (!foundAccount) {
    return res.status(401).json({ success: false, message: "Email atau password salah" });
  }

  if (!verifyPassword(password, foundAccount.passwordHash, foundAccount.salt)) {
    return res.status(401).json({ success: false, message: "Email atau password salah" });
  }

  // Create session
  const sessionToken = "sess_" + crypto.randomBytes(32).toString("hex");
  db.sessions[sessionToken] = {
    accountId: foundAccount.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  saveDB();

  res.setHeader("Set-Cookie", `stepaway_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

  const userObj = getUser(foundAccount.id);
  res.json({
    success: true,
    message: "Login berhasil",
    sessionToken,
    account: {
      id: foundAccount.id,
      email: foundAccount.email,
      name: foundAccount.name,
      streamKey: foundAccount.streamKey,
      plan: foundAccount.plan
    },
    userState: userObj
  });
});

app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers["cookie"]);
  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const sessionToken = bearerToken || cookies["stepaway_session"] || req.body.sessionToken;

  if (sessionToken && db.sessions[sessionToken]) {
    delete db.sessions[sessionToken];
    saveDB();
  }

  res.setHeader("Set-Cookie", `stepaway_session=; Path=/; HttpOnly; Max-Age=0`);
  res.json({ success: true, message: "Berhasil logout" });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.account) {
    return res.json({ success: false, authenticated: false });
  }

  const userObj = getUser(req.account.id);
  const percentage = Math.min(100, Math.round((userObj.currentSteps / Math.max(1, userObj.targetSteps)) * 100));

  res.json({
    success: true,
    authenticated: true,
    account: {
      id: req.account.id,
      email: req.account.email,
      name: req.account.name,
      streamKey: req.account.streamKey || userObj.streamKey,
      plan: req.account.plan || "creator_free"
    },
    user: {
      ...userObj,
      percentage
    }
  });
});

app.post("/api/auth/regenerate-stream-key", (req, res) => {
  if (!req.account) {
    return res.status(401).json({ success: false, message: "Silakan login terlebih dahulu" });
  }

  const newKey = generateStreamKey();
  req.account.streamKey = newKey;
  const userObj = getUser(req.account.id);
  userObj.streamKey = newKey;
  userObj.lastUpdated = new Date().toISOString();
  saveDB();

  res.json({
    success: true,
    message: "Stream Key baru berhasil dibuat",
    streamKey: newKey
  });
});

// REST APIs: Public & Streamer Endpoints
app.get("/api/users", (req, res) => {
  res.json({ success: true, users: Object.values(db.users) });
});

app.get("/api/users/:userId", (req, res) => {
  const targetId = req.params.userId;
  // If targetId matches a streamKey, resolve to user
  const user = targetId.startsWith("sk_live_") ? (findUserByStreamKey(targetId) || getUser(targetId)) : getUser(targetId);
  const percentage = Math.min(100, Math.round((user.currentSteps / Math.max(1, user.targetSteps)) * 100));
  res.json({ success: true, user: { ...user, percentage } });
});

app.post("/api/users/:userId/settings", (req, res) => {
  const { name, targetSteps } = req.body;
  const user = getUser(req.params.userId);
  if (name && name.trim()) {
    user.name = name.trim();
  }
  if (targetSteps && Number(targetSteps) >= 100) {
    user.targetSteps = Number(targetSteps);
  }
  user.lastUpdated = new Date().toISOString();
  saveDB();

  broadcastUserUpdate(user, 0, null);
  res.json({ success: true, message: "Pengaturan berhasil disimpan", user });
});

// Unified Steps & Heart Rate Sync Endpoint
app.post("/api/steps/sync", (req, res) => {
  const streamKey = req.body.apiKey || req.body.streamKey || req.body.key || req.query.key || req.query.streamKey || req.headers["x-stream-key"];
  let user = null;
  if (streamKey) {
    user = findUserByStreamKey(streamKey);
  }
  if (!user) {
    const userId = req.body.userId || "streamer";
    user = getUser(userId);
  }

  const { steps, delta = 0, name, bpm } = req.body;
  if (name && user.name !== name) {
    user.name = name;
  }

  const prevSteps = user.currentSteps;
  if (typeof steps === "number") {
    user.currentSteps = Math.max(0, steps);
  } else if (typeof delta === "number" && delta !== 0) {
    user.currentSteps = Math.max(0, user.currentSteps + Number(delta));
  }

  if (typeof bpm === "number") {
    user.bpm = Math.max(0, Math.round(bpm));
    user.bpmZone = getBpmZone(user.bpm);
    user.lastBpmTimestamp = Date.now();
  }

  const effectiveDelta = user.currentSteps - prevSteps;
  if (effectiveDelta > 0) {
    calculateActivityStatus(user, effectiveDelta);
  }

  const reachedMilestone = checkMilestone(prevSteps, user.currentSteps);
  if (reachedMilestone) {
    user.lastMilestone = reachedMilestone;
  }
  user.lastUpdated = new Date().toISOString();
  saveDB();

  broadcastUserUpdate(user, effectiveDelta, reachedMilestone);

  res.json({
    success: true,
    user: {
      userId: user.userId,
      name: user.name,
      currentSteps: user.currentSteps,
      targetSteps: user.targetSteps,
      bpm: user.bpm,
      bpmZone: user.bpmZone,
      activityStatus: user.activityStatus,
      milestone: reachedMilestone
    }
  });
});

// Dedicated Heart Rate update endpoint (for rapid BLE notification sync)
app.post("/api/heartrate/sync", (req, res) => {
  const streamKey = req.body.apiKey || req.body.streamKey || req.body.key || req.query.key || req.query.streamKey || req.headers["x-stream-key"];
  let user = null;
  if (streamKey) {
    user = findUserByStreamKey(streamKey);
  }
  if (!user) {
    const userId = req.body.userId || "streamer";
    user = getUser(userId);
  }

  const { bpm } = req.body;

  if (typeof bpm === "number") {
    user.bpm = Math.max(0, Math.round(bpm));
    user.bpmZone = user.bpm > 0 ? getBpmZone(user.bpm) : "DISCONNECTED";
    user.lastBpmTimestamp = user.bpm > 0 ? Date.now() : 0;
    user.lastUpdated = new Date().toISOString();
    saveDB();

    broadcastUserUpdate(user, 0, null);
  }

  res.json({ success: true, userId: user.userId, bpm: user.bpm, bpmZone: user.bpmZone });
});

// Periodic Heart Rate Timeout Watcher (7s without BLE packet => disconnects HR to 0)
setInterval(() => {
  const now = Date.now();
  let changed = false;

  for (const userId in db.users) {
    const user = db.users[userId];
    if (user.bpm > 0 && user.lastBpmTimestamp > 0 && (now - user.lastBpmTimestamp > 7000)) {
      user.bpm = 0;
      user.bpmZone = "DISCONNECTED";
      user.lastBpmTimestamp = 0;
      user.lastUpdated = new Date().toISOString();
      changed = true;
      broadcastUserUpdate(user, 0, null);
    }
  }

  if (changed) {
    saveDB();
  }
}, 3000);

app.post("/api/users/:userId/target", (req, res) => {
  const { targetSteps } = req.body;
  if (!targetSteps || targetSteps < 100) {
    return res.status(400).json({ success: false, message: "Target langkah minimal 100" });
  }

  const user = getUser(req.params.userId);
  user.targetSteps = Number(targetSteps);
  user.lastUpdated = new Date().toISOString();
  saveDB();

  broadcastUserUpdate(user, 0, null);
  res.json({ success: true, user });
});

app.post("/api/users/:userId/reset", (req, res) => {
  const user = getUser(req.params.userId);
  user.currentSteps = 0;
  user.lastMilestone = 0;
  user.bpm = 0;
  user.bpmZone = "REST";
  user.activityStatus = "IDLE";
  user.recentPaces = [];
  user.lastUpdated = new Date().toISOString();
  saveDB();

  broadcastUserUpdate(user, 0, null);
  res.json({ success: true, user });
});

// Donation Settings & Webhook Endpoints (TipTap.gg & Generic Webhooks)
app.get("/api/users/:userId/donations", (req, res) => {
  const targetId = req.params.userId;
  const user = targetId.startsWith("sk_live_") ? (findUserByStreamKey(targetId) || getUser(targetId)) : getUser(targetId);
  res.json({
    success: true,
    settings: user.donationSettings,
    donations: user.donations || []
  });
});

app.post("/api/users/:userId/donation-settings", (req, res) => {
  const targetId = req.params.userId;
  const user = targetId.startsWith("sk_live_") ? (findUserByStreamKey(targetId) || getUser(targetId)) : getUser(targetId);
  const { enabled, secretToken, conversionRate, mode, minAmount } = req.body;

  if (typeof enabled === "boolean") {
    user.donationSettings.enabled = enabled;
  }
  if (typeof secretToken === "string") {
    user.donationSettings.secretToken = secretToken.trim();
  }
  if (typeof conversionRate === "number" && conversionRate > 0) {
    user.donationSettings.conversionRate = conversionRate;
  }
  if (mode === "subathon_target" || mode === "direct_step") {
    user.donationSettings.mode = mode;
  }
  if (typeof minAmount === "number" && minAmount >= 0) {
    user.donationSettings.minAmount = minAmount;
  }

  user.lastUpdated = new Date().toISOString();
  saveDB();

  res.json({
    success: true,
    message: "Pengaturan donasi berhasil disimpan",
    settings: user.donationSettings
  });
});

// Webhook Endpoint for TipTap.gg / Saweria / Trakteer
app.post(["/api/webhooks/tiptap", "/api/webhooks/donation", "/api/webhooks/tiptap/:streamKey"], (req, res) => {
  const streamKey = req.params.streamKey || req.query.key || req.query.streamKey || req.body.streamKey || req.body.key;
  let user = null;
  if (streamKey) {
    user = findUserByStreamKey(streamKey);
  }
  if (!user) {
    const userId = req.query.userId || req.query.user || req.body.userId || "streamer";
    user = getUser(userId);
  }

  if (!user.donationSettings || user.donationSettings.enabled === false) {
    return res.status(403).json({ success: false, message: "Integrasi donasi sedang dinonaktifkan untuk user ini" });
  }

  // Verify Secret Token if configured
  const configuredSecret = (user.donationSettings.secretToken || "").trim();
  if (configuredSecret) {
    const providedSecret = 
      req.headers["x-tiptap-signature"] ||
      req.headers["x-webhook-secret"] ||
      req.headers["x-signature"] ||
      req.query.token ||
      req.query.secret ||
      req.body.token ||
      req.body.secret;

    if (!providedSecret || providedSecret !== configuredSecret) {
      return res.status(401).json({ success: false, message: "Secret token webhook tidak valid" });
    }
  }

  // Parse payload (Supports TipTap nested data object and flat payload structures)
  const payload = req.body || {};
  const data = payload.data || payload;

  const rawAmount = data.amount || data.gross_amount || data.nominal || data.total || payload.amount || 0;
  const amount = Number(rawAmount);

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: "Nominal donasi tidak valid" });
  }

  const minAmount = Number(user.donationSettings.minAmount) || 1000;
  if (amount < minAmount) {
    return res.json({
      success: true,
      message: `Donasi di bawah batas minimal (Rp ${minAmount.toLocaleString('id-ID')}), diabaikan dari step goal`,
      processed: false
    });
  }

  const donatorName = data.donator_name || data.name || data.supporter_name || data.from || data.author || payload.donator_name || "Anonim";
  const message = data.message || data.comment || data.msg || payload.message || "";
  const donationId = data.id || data.transaction_id || payload.id || `tip_${Date.now()}`;

  // Conversion logic
  const conversionRate = Number(user.donationSettings.conversionRate) || 10;
  const stepsAdded = Math.max(1, Math.round(amount / conversionRate));
  const mode = user.donationSettings.mode || "subathon_target";

  if (mode === "subathon_target") {
    user.targetSteps = (user.targetSteps || 5000) + stepsAdded;
  } else {
    user.currentSteps = (user.currentSteps || 0) + stepsAdded;
  }

  const donationRecord = {
    id: String(donationId),
    donatorName: String(donatorName).trim(),
    amount,
    formattedAmount: `Rp ${amount.toLocaleString("id-ID")}`,
    message: String(message).trim(),
    stepsAdded,
    mode,
    timestamp: new Date().toISOString()
  };

  if (!Array.isArray(user.donations)) {
    user.donations = [];
  }
  user.donations.unshift(donationRecord);
  if (user.donations.length > 50) {
    user.donations = user.donations.slice(0, 50);
  }

  user.lastUpdated = new Date().toISOString();
  saveDB();

  // Broadcast WebSocket events
  broadcastUserUpdate(user, mode === "direct_step" ? stepsAdded : 0, null);
  broadcastDonationAlert(user, donationRecord);

  console.log(`[TipTap Webhook] Donasi diterima dari ${donationRecord.donatorName}: ${donationRecord.formattedAmount} -> +${stepsAdded} steps (${mode}) untuk ${user.userId}`);

  res.json({
    success: true,
    message: "Donasi berhasil diproses dan dikonversi ke step goal",
    donation: donationRecord,
    userState: {
      userId: user.userId,
      currentSteps: user.currentSteps,
      targetSteps: user.targetSteps
    }
  });
});

// Test Donation Endpoint (Direct Simulator from Dashboard)
app.post("/api/users/:userId/test-donation", (req, res) => {
  const user = getUser(req.params.userId);
  const { amount = 10000, donatorName = "Tester TipTap", message = "Semangat jalannya! +Target Steps" } = req.body;

  const validAmount = Math.max(1000, Number(amount) || 10000);
  const conversionRate = Number(user.donationSettings?.conversionRate) || 10;
  const stepsAdded = Math.max(1, Math.round(validAmount / conversionRate));
  const mode = user.donationSettings?.mode || "subathon_target";

  if (mode === "subathon_target") {
    user.targetSteps = (user.targetSteps || 5000) + stepsAdded;
  } else {
    user.currentSteps = (user.currentSteps || 0) + stepsAdded;
  }

  const donationRecord = {
    id: `test_${Date.now()}`,
    donatorName: donatorName || "Tester TipTap",
    amount: validAmount,
    formattedAmount: `Rp ${validAmount.toLocaleString("id-ID")}`,
    message: message || "Simulasi donasi berhasil!",
    stepsAdded,
    mode,
    timestamp: new Date().toISOString()
  };

  if (!Array.isArray(user.donations)) {
    user.donations = [];
  }
  user.donations.unshift(donationRecord);
  if (user.donations.length > 50) {
    user.donations = user.donations.slice(0, 50);
  }

  user.lastUpdated = new Date().toISOString();
  saveDB();

  broadcastUserUpdate(user, mode === "direct_step" ? stepsAdded : 0, null);
  broadcastDonationAlert(user, donationRecord);

  res.json({
    success: true,
    message: "Simulasi donasi berhasil dikirim",
    donation: donationRecord,
    userState: {
      userId: user.userId,
      currentSteps: user.currentSteps,
      targetSteps: user.targetSteps
    }
  });
});

// Retrigger Single Donation Alert to OBS
app.post("/api/users/:userId/donations/:donationId/retrigger", (req, res) => {
  const user = getUser(req.params.userId);
  const donation = (user.donations || []).find(d => String(d.id) === String(req.params.donationId));
  if (!donation) {
    return res.status(404).json({ success: false, message: "Data donasi tidak ditemukan" });
  }

  broadcastDonationAlert(user, donation);
  res.json({
    success: true,
    message: `Alert donasi dari ${donation.donatorName} berhasil disiarkan ulang ke OBS`,
    donation
  });
});

// Delete Single Donation Record
app.delete("/api/users/:userId/donations/:donationId", (req, res) => {
  const user = getUser(req.params.userId);
  const initialLength = (user.donations || []).length;
  user.donations = (user.donations || []).filter(d => String(d.id) !== String(req.params.donationId));

  if (user.donations.length === initialLength) {
    return res.status(404).json({ success: false, message: "Data donasi tidak ditemukan" });
  }

  user.lastUpdated = new Date().toISOString();
  saveDB();

  res.json({
    success: true,
    message: "Data donasi berhasil dihapus",
    donations: user.donations
  });
});

// Batch Actions: Multiple Delete or Multiple Retrigger
app.post("/api/users/:userId/donations/batch-action", (req, res) => {
  const user = getUser(req.params.userId);
  const { action, donationIds } = req.body;

  if (!Array.isArray(donationIds) || donationIds.length === 0) {
    return res.status(400).json({ success: false, message: "Pilih setidaknya satu donasi" });
  }

  const idSet = new Set(donationIds.map(String));

  if (action === "delete") {
    const beforeCount = (user.donations || []).length;
    user.donations = (user.donations || []).filter(d => !idSet.has(String(d.id)));
    const deletedCount = beforeCount - user.donations.length;

    user.lastUpdated = new Date().toISOString();
    saveDB();

    return res.json({
      success: true,
      message: `${deletedCount} donasi berhasil dihapus`,
      donations: user.donations
    });
  }

  if (action === "retrigger") {
    const matched = (user.donations || []).filter(d => idSet.has(String(d.id)));
    if (matched.length === 0) {
      return res.status(404).json({ success: false, message: "Tidak ada donasi yang cocok untuk disiarkan ulang" });
    }

    // Sequence trigger with staggered delays if multiple
    matched.forEach((donation, index) => {
      setTimeout(() => {
        broadcastDonationAlert(user, donation);
      }, index * 1200);
    });

    return res.json({
      success: true,
      message: `${matched.length} alert donasi berhasil disiarkan ulang secara berurutan ke OBS`
    });
  }

  res.status(400).json({ success: false, message: "Action tidak dikenali (gunakan 'delete' atau 'retrigger')" });
});

// Room APIs
app.get("/api/rooms", (req, res) => {
  const publicRooms = Object.values(db.rooms).map(r => ({
    roomId: r.roomId,
    name: r.name,
    isPrivate: r.isPrivate,
    targetSteps: r.targetSteps,
    memberCount: (r.members || []).length,
    createdAt: r.createdAt
  }));
  res.json({ success: true, rooms: publicRooms });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = db.rooms[req.params.roomId];
  if (!room) return res.status(404).json({ success: false, message: "Room tidak ditemukan" });

  const membersData = (room.members || []).map(uId => {
    const u = getUser(uId);
    const percentage = Math.min(100, Math.round((u.currentSteps / Math.max(1, u.targetSteps)) * 100));
    return { ...u, percentage };
  });

  res.json({
    success: true,
    room: {
      roomId: room.roomId,
      name: room.name,
      isPrivate: room.isPrivate,
      targetSteps: room.targetSteps,
      members: membersData
    }
  });
});

app.post("/api/rooms", (req, res) => {
  const { roomId, name, isPrivate = false, passcode = "", targetSteps = 10000, creatorId = "streamer" } = req.body;
  if (!roomId || !roomId.trim()) {
    return res.status(400).json({ success: false, message: "Room ID wajib diisi" });
  }

  const cleanRoomId = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  db.rooms[cleanRoomId] = {
    roomId: cleanRoomId,
    name: name || cleanRoomId,
    isPrivate: Boolean(isPrivate),
    passcode: isPrivate ? String(passcode || "") : "",
    targetSteps: Number(targetSteps) || 10000,
    members: [creatorId],
    createdAt: new Date().toISOString()
  };
  saveDB();

  res.json({ success: true, message: "Room berhasil dibuat", room: db.rooms[cleanRoomId] });
});

app.post("/api/rooms/:roomId/join", (req, res) => {
  const { userId = "streamer", passcode = "" } = req.body;
  const room = db.rooms[req.params.roomId];
  if (!room) return res.status(404).json({ success: false, message: "Room tidak ditemukan" });

  if (room.isPrivate && room.passcode && room.passcode !== passcode) {
    return res.status(403).json({ success: false, message: "Passcode room salah" });
  }

  if (!room.members.includes(userId)) {
    room.members.push(userId);
    saveDB();
  }

  res.json({ success: true, message: `Berhasil bergabung ke room ${room.name}`, room });
});

app.post("/api/rooms/:roomId/leave", (req, res) => {
  const { userId } = req.body;
  const room = db.rooms[req.params.roomId];
  if (room && userId) {
    room.members = room.members.filter(m => m !== userId);
    saveDB();
  }
  res.json({ success: true, message: "Berhasil keluar dari room" });
});

// WebSocket Handling
wss.on("connection", (ws) => {
  const clientId = ++clientCounter;
  const clientInfo = {
    ws,
    subscribedUsers: new Set(),
    subscribedRooms: new Set()
  };
  clients.set(clientId, clientInfo);

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.type === "subscribe") {
        let userId = msg.userId || "streamer";
        if (msg.key) {
          const u = findUserByStreamKey(msg.key);
          if (u) userId = u.userId;
        } else if (userId.startsWith("sk_live_")) {
          const u = findUserByStreamKey(userId);
          if (u) userId = u.userId;
        }

        clientInfo.subscribedUsers.add(userId);
        const user = getUser(userId);
        const percentage = Math.min(100, Math.round((user.currentSteps / Math.max(1, user.targetSteps)) * 100));
        ws.send(JSON.stringify({
          type: "init",
          data: { ...user, percentage }
        }));
      } else if (msg.type === "subscribe_multi") {
        const userIds = Array.isArray(msg.userIds) ? msg.userIds : ["streamer"];
        const initData = [];
        for (const rawId of userIds) {
          let u = rawId;
          if (rawId.startsWith("sk_live_")) {
            const found = findUserByStreamKey(rawId);
            if (found) u = found.userId;
          }
          clientInfo.subscribedUsers.add(u);
          const userData = getUser(u);
          const percentage = Math.min(100, Math.round((userData.currentSteps / Math.max(1, userData.targetSteps)) * 100));
          initData.push({ ...userData, percentage });
        }
        ws.send(JSON.stringify({
          type: "init_multi",
          data: initData
        }));
      } else if (msg.type === "subscribe_room") {
        const roomId = msg.roomId || "global";
        clientInfo.subscribedRooms.add(roomId);
        const room = db.rooms[roomId];
        const initData = [];
        if (room && Array.isArray(room.members)) {
          for (const u of room.members) {
            const userData = getUser(u);
            const percentage = Math.min(100, Math.round((userData.currentSteps / Math.max(1, userData.targetSteps)) * 100));
            initData.push({ ...userData, percentage });
          }
        }
        ws.send(JSON.stringify({
          type: "init_room",
          roomId,
          roomName: room ? room.name : roomId,
          data: initData
        }));
      } else if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    } catch (err) {
      console.error("[WS Message Error]:", err.message);
    }
  });

  ws.on("close", () => {
    clients.delete(clientId);
  });
});

// OBS Overlay Route Aliases
app.get("/overlay", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "overlay.html"));
});

app.get("/overlay/heartrate", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "overlay-heartrate.html"));
});

app.get("/overlay/multi", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "overlay-multi.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

server.listen(PORT, () => {
  console.log(`[StepAway Server] Running on http://localhost:${PORT}`);
  console.log(`[StepAway Server] Domain target: stepaway.endrisusanto.my.id`);
});
