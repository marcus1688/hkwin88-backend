const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true },
    contactId: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactName: { type: String, default: "" },
    channelId: { type: String, required: true },
    status: { type: String, default: "active" },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessage: { type: String, default: "" },
    unreadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
