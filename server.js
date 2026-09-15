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

let db = {
  users: {
    streamer: {
      userId: "streamer",
      name: "Streamer",
      currentSteps: 0,
      targetSteps: 5000,
      todayStart: new Date().toISOString().split("T")[0],
      lastMilestone: 0,
      lastUpdated: new Date().toISOString()
    }
  }
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    db = JSON.parse(raw);
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

// Connected overlay clients map: clientId -> { ws, subscribedUsers: Set<string> }
const clients = new Map();
let clientCounter = 0;

function getUser(userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      userId,
      name: userId,
      currentSteps: 0,
      targetSteps: 5000,
      todayStart: new Date().toISOString().split("T")[0],
      lastMilestone: 0,
      lastUpdated: new Date().toISOString()
    };
    saveDB();
  }
  return db.users[userId];
}

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
      percentage,
      delta,
      milestone,
      lastUpdated: user.lastUpdated
    }
  });

  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN && (client.subscribedUsers.has(user.userId) || client.subscribedUsers.has("*"))) {
      client.ws.send(payload);
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

app.post("/api/steps/sync", (req, res) => {
  const { userId = "streamer", steps, delta = 1, name } = req.body;
  const user = getUser(userId);
  if (name && user.name !== name) {
    user.name = name;
  }

  const prevSteps = user.currentSteps;
  if (typeof steps === "number") {
    user.currentSteps = Math.max(0, steps);
  } else {
    user.currentSteps += Math.max(1, Number(delta) || 1);
  }

  const effectiveDelta = user.currentSteps - prevSteps;
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
      currentSteps: user.currentSteps,
      targetSteps: user.targetSteps,
      milestone: reachedMilestone
    }
  });
});

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
  user.lastUpdated = new Date().toISOString();
  saveDB();

  broadcastUserUpdate(user, 0, null);
  res.json({ success: true, user });
});

// WebSocket Connection Management
wss.on("connection", (ws) => {
  const clientId = ++clientCounter;
  const clientInfo = {
    ws,
    subscribedUsers: new Set()
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

// Routes redirect for friendly OBS browser URLs
app.get("/overlay", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "overlay.html"));
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
