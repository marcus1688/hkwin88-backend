const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true },
    conversationId: { type: String, required: true, index: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    direction: { type: String, enum: ["received", "sent"], required: true },
    type: { type: String, default: "text" },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, default: "received" },
    replyTo: {
      messageId: { type: String, default: null },
      content: { type: mongoose.Schema.Types.Mixed, default: null },
      type: { type: String, default: null },
      from: { type: String, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
