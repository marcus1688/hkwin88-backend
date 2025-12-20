const express = require("express");
const router = express.Router();
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const axios = require("axios");
const { authenticateAdminToken } = require("../auth/adminAuth");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME_hkwin88;
const R2_PUBLIC_URL = `https://pub-${process.env.R2_PUBLIC_ID_hkwin88}.r2.dev`;
const MESSAGEBIRD_API_KEY = process.env.MESSAGEBIRD_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Check All Webhooks
router.get("/admin/api/webhooks", authenticateAdminToken, async (req, res) => {
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
router.post(
  "/admin/api/webhook/create",
  authenticateAdminToken,
  async (req, res) => {
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
      console.error(
        "创建 Webhook 失败:",
        error.response?.data || error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// Update Webhooks
router.put(
  "/admin/api/webhook/update",
  // authenticateAdminToken,
  async (req, res) => {
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
      console.error(
        "更新 Webhook 失败:",
        error.response?.data || error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete Webhook
router.delete(
  "/admin/api/webhook/:webhookId",
  authenticateAdminToken,
  async (req, res) => {
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
      console.error(
        "删除 Webhook 失败:",
        error.response?.data || error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// Get Conversations
router.get(
  "/admin/api/conversations",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const conversations = await Conversation.find().lean();
      conversations.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      });
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get All Conversations Message
router.get(
  "/admin/api/conversations/:conversationId/messages",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { markAsRead } = req.query;
      const messages = await Message.find({ conversationId }).sort({
        createdAt: 1,
      });
      if (markAsRead === "true") {
        await Conversation.findOneAndUpdate(
          { conversationId },
          { unreadCount: 0 }
        );
      }
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Send Message with Quote Reply
router.post(
  "/admin/api/conversations/:conversationId/send",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { text, replyToMessageId } = req.body;
      const messagePayload = {
        type: "text",
        content: { text },
      };
      let replyToData = null;
      if (replyToMessageId) {
        messagePayload.replyTo = {
          id: replyToMessageId,
        };
        const quotedMessage = await Message.findOne({
          messageId: replyToMessageId,
        });
        if (quotedMessage) {
          replyToData = {
            messageId: replyToMessageId,
            content: quotedMessage.content,
            type: quotedMessage.type,
            from: quotedMessage.from,
          };
        }
      }
      const response = await axios.post(
        `https://conversations.messagebird.com/v1/conversations/${conversationId}/messages`,
        messagePayload,
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
          replyTo: replyToData,
        },
        { upsert: true, new: true }
      );
      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          lastMessageAt: new Date(),
          lastMessage: text,
          needsAgent: false,
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error("发送消息失败:", error.response?.data || error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// Upload Image to R2
router.post(
  "/admin/api/upload/image",
  authenticateAdminToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileName = `whatsapp/${Date.now()}-${file.originalname}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      const imageUrl = `${R2_PUBLIC_URL}/${fileName}`;
      res.json({ success: true, url: imageUrl });
    } catch (error) {
      console.error("上传图片失败:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Send Image with Quote Reply
router.post(
  "/admin/api/conversations/:conversationId/send-image",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { imageUrl, caption, replyToMessageId } = req.body;

      const messagePayload = {
        type: "image",
        content: {
          image: {
            url: imageUrl,
            caption: caption || "",
          },
        },
      };

      let replyToData = null;

      if (replyToMessageId) {
        messagePayload.replyTo = {
          id: replyToMessageId,
        };

        const quotedMessage = await Message.findOne({
          messageId: replyToMessageId,
        });
        if (quotedMessage) {
          replyToData = {
            messageId: replyToMessageId,
            content: quotedMessage.content,
            type: quotedMessage.type,
            from: quotedMessage.from,
          };
        }
      }

      const response = await axios.post(
        `https://conversations.messagebird.com/v1/conversations/${conversationId}/messages`,
        messagePayload,
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
          type: "image",
          content: { image: { url: imageUrl, caption: caption || "" } },
          status: messageData.status,
          replyTo: replyToData,
        },
        { upsert: true, new: true }
      );

      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          lastMessageAt: new Date(),
          lastMessage: caption ? `📷 ${caption}` : "📷 Image",
          needsAgent: false,
        }
      );

      res.json(response.data);
    } catch (error) {
      console.error(
        "Failed to send image:",
        error.response?.data || error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
);

// Pin Message
router.post(
  "/admin/api/conversations/:conversationId/pin",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const conversation = await Conversation.findOneAndUpdate(
        { conversationId },
        { isPinned: true, pinnedAt: new Date() },
        { new: true }
      );
      res.json({ success: true, conversation });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Unpin Message
router.post(
  "/admin/api/conversations/:conversationId/unpin",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const conversation = await Conversation.findOneAndUpdate(
        { conversationId },
        { isPinned: false, pinnedAt: null },
        { new: true }
      );
      res.json({ success: true, conversation });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get My Account Info
router.get(
  "/admin/api/whatsapp/account",
  authenticateAdminToken,
  async (req, res) => {
    try {
      res.json({
        name: process.env.WHATSAPP_ACCOUNT_NAME || "HKWIN88 Customer Service",
        phone: process.env.WHATSAPP_PHONE || "+852 7042 0016",
        status: "active",
        channelId: CHANNEL_ID,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Skip Bot Flow
router.post(
  "/admin/api/conversations/:conversationId/skip-bot",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const conversation = await Conversation.findOneAndUpdate(
        { conversationId },
        {
          step: "waiting_agent",
          needsAgent: true,
        },
        { new: true }
      );
      res.json({ success: true, conversation });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Mark as Replied
router.post(
  "/admin/api/conversations/:conversationId/mark-replied",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const conversation = await Conversation.findOneAndUpdate(
        { conversationId },
        { needsAgent: false },
        { new: true }
      );
      res.json({ success: true, conversation });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
module.exports = router;
