import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, clientMeta } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: "User exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      email,
      passwordHash,
      clientMeta: {
        ua: clientMeta?.ua || "",
        tz: clientMeta?.tz || "",
        lang: clientMeta?.lang || "",
      },
    });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatarHue: user.avatarHue,
        bestScore: user.bestScore,
        gamesPlayed: user.gamesPlayed,
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password)
      return res.status(400).json({ error: "Missing fields" });

    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername },
      ],
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    user.lastSeenAt = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatarHue: user.avatarHue,
        bestScore: user.bestScore,
        gamesPlayed: user.gamesPlayed,
      },
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
