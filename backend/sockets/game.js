import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ChatMessage from "../models/ChatMessage.js";

const TICK_MS = 33; // ~30 fps
const WORLD = { w: 2400, h: 1400 };
const PLAYER_SPEED = 5;
const ORB_COUNT = 80;
const ORB_VALUE = 5;
const RADIUS = { player: 14, orb: 10 };

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function dist2(a, b) {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function initGame(io) {
  const players = new Map(); // socket.id -> player
  const orbs = Array.from({ length: ORB_COUNT }, () => ({
    id: crypto.randomUUID(),
    x: rand(50, WORLD.w - 50),
    y: rand(50, WORLD.h - 50),
  }));

  function spawnOrb(i) {
    orbs[i] = {
      id: crypto.randomUUID(),
      x: rand(50, WORLD.w - 50),
      y: rand(50, WORLD.h - 50),
    };
  }

  // ---- Connection lifecycle ----
  io.on("connection", async (socket) => {
    // Auth handshake
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = { id: payload.id, username: payload.username };
    } catch {
      socket.emit("error-msg", "Auth failed");
      return socket.disconnect(true);
    }

    // Load player's lifetime totals from DB
    let lifetime = 0;
    try {
      const doc = await User.findById(socket.data.user.id).lean();
      lifetime = doc?.totalScore || 0;
    } catch {
      /* ignore and keep 0 */
    }

    const colorHue = Math.floor(Math.random() * 360);
    players.set(socket.id, {
      id: socket.id,
      uid: socket.data.user.id,
      name: socket.data.user.username,
      x: rand(100, WORLD.w - 100),
      y: rand(100, WORLD.h - 100),
      vx: 0,
      vy: 0,
      // session score (resets on reconnect)
      score: 0,
      // lifetime score (backed by DB) — this is what we’ll display
      lifetime,
      hue: colorHue,
      // track best session for bestScore
      bestSession: 0,
    });

    socket.emit("world-init", { WORLD, orbs });
    io.emit("players", Array.from(players.values()));

    socket.on("move", ({ up, down, left, right }) => {
      const p = players.get(socket.id);
      if (!p) return;
      let vx = 0,
        vy = 0;
      if (up) vy -= PLAYER_SPEED;
      if (down) vy += PLAYER_SPEED;
      if (left) vx -= PLAYER_SPEED;
      if (right) vx += PLAYER_SPEED;
      p.vx = vx;
      p.vy = vy;
    });

    // ✅ Chat
    socket.on("chat", async (text) => {
      if (typeof text !== "string") return;
      const t = text.trim().slice(0, 200);
      if (!t) return;

      const p = players.get(socket.id);
      if (!p) return;

      // persist
      try {
        await ChatMessage.create({
          userId: p.uid,
          username: p.name,
          hue: p.hue,
          text: t,
        });
      } catch (e) {
        console.warn("chat persist failed:", e.message);
      }

      // broadcast
      io.emit("chat", { name: p.name, hue: p.hue, text: t });
    });

    socket.on("disconnect", async () => {
      const p = players.get(socket.id);
      players.delete(socket.id);
      io.emit("players", Array.from(players.values()));
      // Update bestScore and gamesPlayed at end of session
      if (p) {
        try {
          await User.updateOne(
            { _id: p.uid },
            { $max: { bestScore: p.bestSession }, $inc: { gamesPlayed: 1 } }
          );
        } catch {}
      }
    });
  });

  // ---- Sim loop ----
  setInterval(async () => {
    // update positions
    for (const p of players.values()) {
      p.x = clamp(p.x + p.vx, RADIUS.player, WORLD.w - RADIUS.player);
      p.y = clamp(p.y + p.vy, RADIUS.player, WORLD.h - RADIUS.player);
    }

    // collisions with orbs -> persist to DB
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      for (const p of players.values()) {
        if (dist2(p, o) < (RADIUS.player + RADIUS.orb) ** 2) {
          p.score += ORB_VALUE;
          p.lifetime += ORB_VALUE;
          if (p.score > p.bestSession) p.bestSession = p.score;

          // Persist atomically: totalScore += ORB_VALUE
          // (bestScore handled on disconnect to minimize DB chatter)
          User.updateOne(
            { _id: p.uid },
            { $inc: { totalScore: ORB_VALUE } }
          ).catch(() => {});

          spawnOrb(i);
          break;
        }
      }
    }

    // broadcast snapshot (includes lifetime scores)
    io.emit("state", {
      players: Array.from(players.values()),
      orbs,
    });
  }, TICK_MS);
}
