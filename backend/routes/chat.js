import express from "express";
import ChatMessage from "../models/ChatMessage.js";

const router = express.Router();

// public read; --> future: add in authRequired
router.get("/recent", async (_req, res) => {
  const msgs = await ChatMessage.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(msgs.reverse()); // oldest->newest
});

export default router;
