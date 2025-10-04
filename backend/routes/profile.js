import { Router } from "express";
import User from "../models/User.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/me", authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatarHue: user.avatarHue,
    gamesPlayed: user.gamesPlayed,
    bestScore: user.bestScore,
    totalScore: user.totalScore,
    // lifetime boosters
    speedBoosters: user.speedBoosters || 0,
  });
});

router.post("/display", authRequired, async (req, res) => {
  const { displayName } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { displayName: displayName?.slice(0, 40) || "" },
    { new: true }
  ).lean();
  res.json({ displayName: user.displayName });
});

// Global leaderboard by lifetime totalScore
// !  add authRequired.
router.get("/leaderboard", async (_req, res) => {
  const top = await User.find(
    {},
    //  speedBoosters
    "username avatarHue totalScore bestScore speedBoosters"
  )
    .sort({ totalScore: -1 })
    .limit(20)
    .lean();
  res.json(top);
});

export default router;
