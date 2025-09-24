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

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (_req, res) => res.json({ ok: true, name: "Shared Fun API" }));
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN, methods: ["GET", "POST"] },
});
initGame(io);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI, { dbName: "shared_fun" })
  .then(() => {
    server.listen(PORT, () =>
      console.log(`API+WS on http://localhost:${PORT}`)
    );
  })
  .catch((e) => {
    console.error("Mongo connect failed:", e.message);
    process.exit(1);
  });
