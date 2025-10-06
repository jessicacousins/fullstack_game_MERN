import mongoose from "mongoose";
import validator from "validator";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 30,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Invalid email"],
    },
    passwordHash: { type: String, required: true },

    // Non-PII profile/game stats (privacy-friendly defaults)
    displayName: { type: String, default: "" },
    avatarHue: { type: Number, default: () => Math.floor(Math.random() * 360) },
    joinedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    // Game stats (no sensitive data)
    gamesPlayed: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },

    // how many speed boosters collected (lifetime)
    speedBoosters: { type: Number, default: 0 },

    luckyOrbs: { type: Number, default: 0 },

    // Simple analytics
    clientMeta: {
      ua: String,
      tz: String,
      lang: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
