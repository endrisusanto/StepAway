import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
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

let db = {
  users: {
    streamer: {
      userId: "streamer",
      name: "Streamer",
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
    db.users = { ...db.users, ...(parsed.users || {}) };
    db.rooms = { ...db.rooms, ...(parsed.rooms || {}) };
  } catch (err) {
    console.error("[Storage] Failed to read storage.json, using defaults:", err.message);
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[Storage] Failed to write storage.json:", err.message);
  }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
      lastUpdated: new Date().toISOString()
    };
    saveDB();
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

// REST APIs
app.get("/api/users", (req, res) => {
  res.json({ success: true, users: Object.values(db.users) });
});

app.get("/api/users/:userId", (req, res) => {
  const user = getUser(req.params.userId);
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
  const { userId = "streamer", steps, delta = 0, name, bpm } = req.body;
  const user = getUser(userId);
  if (name && user.name !== name) {
    user.name = name;
  }

  const prevSteps = user.currentSteps;
  if (typeof steps === "number") {
    user.currentSteps = Math.max(0, steps);
  } else if (delta > 0) {
    user.currentSteps += Math.max(1, Number(delta));
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
  const { userId = "streamer", bpm } = req.body;
  const user = getUser(userId);

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
        const userId = msg.userId || "streamer";
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
        for (const u of userIds) {
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
