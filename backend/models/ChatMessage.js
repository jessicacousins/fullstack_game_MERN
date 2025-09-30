import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, required: true },
    hue: { type: Number, default: 200 },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

export default mongoose.model("ChatMessage", ChatMessageSchema);
