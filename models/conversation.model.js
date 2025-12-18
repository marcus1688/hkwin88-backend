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
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    customer: {
      welcomed: { type: Boolean, default: false },
      step: { type: String, default: null },
      username: { type: String, default: null },
      password: { type: String, default: null },
      registered: { type: Boolean, default: false },
    },
    step: { type: String, default: null },
    language: { type: String, default: null },
    flowType: { type: String, default: null },
    tempData: { type: mongoose.Schema.Types.Mixed, default: {} },
    needsAgent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
