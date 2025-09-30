import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import { initGame } from "./sockets/game.js";
import chatRoutes from "./routes/chat.js";

const app = express();

/* ---------- Middleware ---------- */
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ---------- Health & Routes ---------- */
app.get("/", (_req, res) =>
  res.json({ ok: true, name: "Shared Fun API", time: new Date().toISOString() })
);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/chat", chatRoutes);

/* ---------- HTTP + WebSocket ---------- */
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN, methods: ["GET", "POST"] },
});

// All socket handlers (game loop, chat, etc.) live in initGame - access game state/maps.
initGame(io);

/* ---------- DB & Boot ---------- */
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, { dbName: "shared_fun" })
  .then(() => {
    server.listen(PORT, () => {
      console.log(`API+WS on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error("Mongo connect failed:", e.message);
    process.exit(1);
  });

/* ---------- Minimal error handling ---------- */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

/* ---------- Graceful shutdown ---------- */
const shutdown = (signal) => {
  console.log(`${signal} received, closing...`);
  server.close(() => {
    mongoose.connection.close(false, () => process.exit(0));
  });
  // Force exit after 10s if something hangs
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
