import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ChatMessage from "../models/ChatMessage.js";

const TICK_MS = 33; // ~30 fps
const WORLD = { w: 2400, h: 1400 };
const PLAYER_SPEED = 5;
const ORB_COUNT = 80;
const ORB_VALUE = 5;
const RADIUS = { player: 14, orb: 10 };

// Speed Booster constants
const BOOST_SPAWN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const BOOST_DURATION_MS = 10 * 1000; // 10 seconds
const BOOST_MULTIPLIER = 10;

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

  //!  single rare speed-boost orb (spawns at most once per cooldown)
  let speedOrb = null; // { id, x, y } | null
  let nextSpeedOrbAt = Date.now() + BOOST_SPAWN_COOLDOWN_MS;

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
    let boostersFromDB = 0;
    try {
      const doc = await User.findById(socket.data.user.id).lean();
      lifetime = doc?.totalScore || 0;
      boostersFromDB = doc?.speedBoosters || 0;
    } catch {}

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
      // lifetime score (backed by DB)
      lifetime,
      hue: colorHue,
      // track best session for bestScore
      bestSession: 0,

      // boosters & boost window
      boosters: boostersFromDB, // lifetime count (synced from DB)
      boostUntil: 0, // timestamp until which boost is active
    });

    socket.emit("world-init", { WORLD, orbs, speedOrb });
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

    // chat
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
    // 0) handle speed booster spawn (rare, single)
    if (!speedOrb && Date.now() >= nextSpeedOrbAt) {
      speedOrb = {
        id: crypto.randomUUID(),
        x: rand(60, WORLD.w - 60),
        y: rand(60, WORLD.h - 60),
      };
    }

    // 1) update positions (apply boost multiplier when active)
    for (const p of players.values()) {
      const active = Date.now() < p.boostUntil;
      const mult = active ? BOOST_MULTIPLIER : 1;
      p.x = clamp(p.x + p.vx * mult, RADIUS.player, WORLD.w - RADIUS.player);
      p.y = clamp(p.y + p.vy * mult, RADIUS.player, WORLD.h - RADIUS.player);
    }

    // 2) collisions with normal orbs -> persist to DB
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      for (const p of players.values()) {
        if (dist2(p, o) < (RADIUS.player + RADIUS.orb) ** 2) {
          p.score += ORB_VALUE;
          p.lifetime += ORB_VALUE;
          if (p.score > p.bestSession) p.bestSession = p.score;

          // Persist atomically: totalScore += ORB_VALUE

          User.updateOne(
            { _id: p.uid },
            { $inc: { totalScore: ORB_VALUE } }
          ).catch(() => {});

          spawnOrb(i);
          break;
        }
      }
    }

    // 3) collision with the single Speed Booster orb
    if (speedOrb) {
      for (const p of players.values()) {
        const fake = { x: speedOrb.x, y: speedOrb.y };
        if (dist2(p, fake) < (RADIUS.player + RADIUS.orb) ** 2) {
          // grant boost
          p.boostUntil = Date.now() + BOOST_DURATION_MS;
          p.boosters = (p.boosters || 0) + 1;

          // persist lifetime boosters
          User.updateOne({ _id: p.uid }, { $inc: { speedBoosters: 1 } }).catch(
            () => {}
          );

          // remove orb and schedule next spawn time
          speedOrb = null;
          nextSpeedOrbAt = Date.now() + BOOST_SPAWN_COOLDOWN_MS;
          break;
        }
      }
    }

    // 4) broadcast snapshot (includes lifetime scores, boosters, and speedOrb)
    io.emit("state", {
      players: Array.from(players.values()),
      orbs,
      speedOrb,
    });
  }, TICK_MS);
}
