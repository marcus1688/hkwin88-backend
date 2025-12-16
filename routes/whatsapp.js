const express = require("express");
const router = express.Router();
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const axios = require("axios");

const MESSAGEBIRD_API_KEY = "VDRvACh2KKN3tEOueEbFFsUXC";
const CHANNEL_ID = "2b7da680-be98-40af-be09-6becc728c55c";

router.get("/api/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ lastMessageAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/conversations/:conversationId/messages", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });
    await Conversation.findOneAndUpdate({ conversationId }, { unreadCount: 0 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/conversations/:conversationId/send", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;
    const response = await axios.post(
      `https://conversations.messagebird.com/v1/conversations/${conversationId}/messages`,
      {
        type: "text",
        content: { text },
      },
      {
        headers: {
          Authorization: `AccessKey ${MESSAGEBIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const messageData = response.data;
    await Message.findOneAndUpdate(
      { messageId: messageData.id },
      {
        messageId: messageData.id,
        conversationId: conversationId,
        from: messageData.from,
        to: messageData.to,
        direction: "sent",
        type: "text",
        content: { text },
        status: messageData.status,
      },
      { upsert: true, new: true }
    );
    await Conversation.findOneAndUpdate(
      { conversationId },
      { lastMessageAt: new Date() }
    );

    res.json(response.data);
  } catch (error) {
    console.error("发送消息失败:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
