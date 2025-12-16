const express = require("express");
const router = express.Router();
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const axios = require("axios");

const MESSAGEBIRD_API_KEY = process.env.MESSAGEBIRD_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Check All Webhooks
router.get("/api/webhooks", async (req, res) => {
  try {
    const response = await axios.get(
      "https://conversations.messagebird.com/v1/webhooks",
      {
        headers: {
          Authorization: `AccessKey ${MESSAGEBIRD_API_KEY}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("获取 Webhooks 失败:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create New Webhook
router.post("/api/webhook/create", async (req, res) => {
  try {
    const { url, channelId } = req.body;
    const response = await axios.post(
      "https://conversations.messagebird.com/v1/webhooks",
      {
        channelId: channelId || CHANNEL_ID,
        url: url,
        events: ["message.created", "message.updated"],
      },
      {
        headers: {
          Authorization: `AccessKey ${MESSAGEBIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("创建 Webhook 失败:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update Webhooks
router.put("/api/webhook/update", async (req, res) => {
  try {
    const { webhookId, url } = req.body;
    const response = await axios.patch(
      `https://conversations.messagebird.com/v1/webhooks/${webhookId}`,
      { url },
      {
        headers: {
          Authorization: `AccessKey ${MESSAGEBIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("更新 Webhook 失败:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete Webhook
router.delete("/api/webhook/:webhookId", async (req, res) => {
  try {
    const { webhookId } = req.params;
    await axios.delete(
      `https://conversations.messagebird.com/v1/webhooks/${webhookId}`,
      {
        headers: {
          Authorization: `AccessKey ${MESSAGEBIRD_API_KEY}`,
        },
      }
    );
    res.json({ success: true, message: "Webhook deleted" });
  } catch (error) {
    console.error("删除 Webhook 失败:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get Conversations
router.get("/api/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ lastMessageAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Conversations Message
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

// Send Message
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
