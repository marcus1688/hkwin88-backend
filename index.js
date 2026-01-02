const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
if (process.env.PAUSE_SERVICE === "true") {
  console.log("Service is paused");
  process.exit(0);
}
const mongoose = require("mongoose");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const WebSocket = require("ws");
const {
  clearCookie,
  authenticateToken,
  generateToken: userGenerateToken,
} = require("./auth/auth");

const {
  authenticateAdminToken,
  generateToken: adminGenerateToken,
} = require("./auth/adminAuth");
const AttendanceBonusRouter = require("./routes/attendancebonus");
const LoyaltyBonusRouter = require("./routes/loyaltybonus");
const usersRouter = require("./routes/users");
const depositRouter = require("./routes/deposit");
const adminUserRouter = require("./routes/adminuser");
const myPromotionRouter = require("./routes/mypromotion");
const withdrawRouter = require("./routes/withdraw");
const banklistRouter = require("./routes/banklist");
const userbanklistRouter = require("./routes/userbanklist");
const carouselRouter = require("./routes/carousel");
const BankTransactionLogRouter = require("./routes/banktransactionlog");
const UserWalletLogRouter = require("./routes/userwalletlog");
const promotionRouter = require("./routes/promotion");
const vipRouter = require("./routes/vip");
const popUpRouter = require("./routes/popup");
const BonusRouter = require("./routes/bonus");
const LuckySpinRouter = require("./routes/luckyspin");
const InformationRouter = require("./routes/information");
const ReviewRouter = require("./routes/review");
const LeaderboardRouter = require("./routes/leaderboard");
const BlogRouter = require("./routes/blog");
const MailRouter = require("./routes/mail");
const AnnouncementRouter = require("./routes/announcement");
const AnnouncementCategoryRouter = require("./routes/announcementcategory");
const HelpRouter = require("./routes/help");
const FeedbackRouter = require("./routes/feedback");
const PromoCodeRouter = require("./routes/promocode");
const MemoRouter = require("./routes/memo");
const GeneralRouter = require("./routes/general");
const KioskCategoryRouter = require("./routes/kioskcategory");
const Kiosk = require("./routes/kiosk");
const PromotionCategoryRouter = require("./routes/promotioncategory");
const RebateScheduleRouter = require("./routes/rebateschedule");
const AgentRouter = require("./routes/agent");
const AgentLevelSystemRouter = require("./routes/agentlevelsystem");
const CheckInRouter = require("./routes/checkin");
const emailRouter = require("./routes/email");
const LuckySpinSettingRouter = require("./routes/luckyspinsetting");
const SEORouter = require("./routes/seo");
const PaymentGatewayRouter = require("./routes/paymentgateway");
const WhitelistIPRouter = require("./routes/whitelistip");
const KioskBalanceRouter = require("./routes/kioskbalance");
const CryptoRouter = require("./routes/cryptowallet");
const VultrRouter = require("./routes/vultr");
const AgentPTRouter = require("./routes/agentpt");
const FreeCreditRouter = require("./routes/freecredit");
const FacebookRouter = require("./routes/facebook");
const GamelistRouter = require("./routes/gamelist");
const whatsappRouter = require("./routes/whatsapp");

const adminListRouter = require("./routes/adminlist");
const notificationRouter = require("./routes/notification");

const slotJokerRouter = require("./routes/GAMEAPI/slotjoker");

const ALLGameFunctionRouter = require("./routes/GAMEAPI/0_GameFunction");
const ALLGameStatusRouter = require("./routes/GAMEAPI/0_GameStatus");

const { resetCheckinStreaks } = require("./routes/checkin");

const cors = require("cors");
const cookieParser = require("cookie-parser");
const cookie = require("cookie");
const Deposits = require("./models/deposit.model");
const Withdraw = require("./models/withdraw.model");
const { User } = require("./models/users.model");
const { general } = require("./models/general.model");
const Promotion = require("./models/promotion.model");
const { adminUser, adminLog } = require("./models/adminuser.model");
const { addContactToGoogle } = require("./utils/googleContact");
const { Mail } = require("./models/mail.model");
const Message = require("./models/message.model");
const Conversation = require("./models/conversation.model");
const email = require("./models/email.model");
const { updateKioskBalance } = require("./services/kioskBalanceService");
const kioskbalance = require("./models/kioskbalance.model");
const UserWalletLog = require("./models/userwalletlog.model");
const BankList = require("./models/banklist.model");
const BankTransactionLog = require("./models/banktransactionlog.model");
const { myrusdtModel } = require("./models/myrusdt.model");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const Bonus = require("./models/bonus.model");
const app = express();
const cron = require("node-cron");
const moment = require("moment");
const ipRangeCheck = require("ip-range-check");
const server = http.createServer(app);
const axios = require("axios");
const wss = new WebSocket.Server({ noServer: true });
let connectedUsers = [];
let connectedAdmins = [];
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

server.keepAliveTimeout = 85000;
server.headersTimeout = 86000;

global.AGENT_COMMISSION_PROMOTION_ID = "6890a5e7596aa38349ade97d";
global.REBATE_PROMOTION_ID = "68909e951af19dfb128af5be";

const allowedOrigins = [
  "https://www.mysteryclub77.com",
  "capacitor://localhost",
  "ionic://localhost",
  // "http://192.168.68.59:3005",
  "file://",
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3005"]
    : []),
];
app.use((req, res, next) => {
  if (process.env.PAUSE_SERVICE === "true") {
    return res.status(503).json({
      success: false,
      message: "Service is temporarily paused",
    });
  }
  next();
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("Server", "nginx");
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      if (req.path === "/api/kagaming") {
        return;
      }

      try {
        JSON.parse(buf);
      } catch (e) {
        const error = new Error("Invalid JSON");
        error.status = 400;
        throw error;
      }
    },
  })
);
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use((req, res, next) => {
  if (
    req.path.includes("/admin/api/seo-pages") &&
    (req.method === "POST" || req.method === "PUT")
  ) {
    return next();
  }
  const xssClean = require("xss-clean");
  return xssClean()(req, res, next);
});

const path = require("path");

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      if (origin.includes("vercel.app")) {
        return callback(null, true);
      }
      if (origin === "https://localhost" || origin === "http://localhost") {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      console.log(`CORS blocked request from origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes
  max: 10000, // 1000 Request / IP
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  skip: (req, res) =>
    req.path === "/health" || req.path === "/webhook/whatsapp",
  handler: (req, res, next, options) => {
    const clientIp = req.headers["x-forwarded-for"] || req.ip;
    const clientIpTrimmed = clientIp.split(",")[0].trim();
    const origin = req.headers.origin || "Unknown";

    console.log(
      `Global Rate Limit Exceeded - IP: ${clientIpTrimmed}, Origin: ${origin}, Path: ${
        req.path
      }, Time: ${new Date().toISOString()}`
    );
    res.status(options.statusCode).send(options.message);
  },
});

app.use(globalLimiter);

// --- SOCKET IO START ---
async function adminLogAttempt(username, fullname, clientIp, remark) {
  await adminLog.create({
    username,
    fullname,
    loginTime: new Date(),
    ip: clientIp,
    remark,
  });
}

async function updateAdminStatus(userId, status) {
  await adminUser.findByIdAndUpdate(userId, { onlineStatus: status });
}

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      if (origin.includes("vercel.app")) {
        return callback(null, true);
      }
      if (origin === "https://localhost" || origin === "http://localhost") {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      console.log(`Socket.IO CORS blocked request from origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const refreshToken = socket.handshake.auth.refreshToken;
  const isAdmin = socket.handshake.auth.isAdmin;
  let clientIp =
    socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  clientIp = clientIp.split(",")[0].trim();
  socket.clientIp = clientIp;
  if (token) {
    try {
      const secret = isAdmin
        ? process.env.JWT_ADMIN_SECRET
        : process.env.JWT_SECRET;
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError" && refreshToken) {
        try {
          const refreshSecret = isAdmin
            ? process.env.ADMIN_REFRESH_TOKEN_SECRET
            : process.env.REFRESH_TOKEN_SECRET;
          const decoded = jwt.verify(refreshToken, refreshSecret);
          const user = isAdmin
            ? await adminUser.findById(decoded.userId)
            : await User.findById(decoded.userId);
          if (!user) {
            return next(new Error("User not found"));
          }
          const newToken = isAdmin
            ? await adminGenerateToken(user._id)
            : await userGenerateToken(user._id);
          socket.emit("token:refresh", { token: newToken });
          socket.userId = user._id;
          next();
        } catch (refreshError) {
          next(new Error("Authentication error"));
        }
      } else {
        next(new Error("Authentication error"));
      }
    }
  } else {
    next(new Error("Authentication error"));
  }
});

io.on("connection", async (socket) => {
  socket.isAlive = true;

  socket.on("setUserId", async (data) => {
    try {
      if (data.userId !== socket.userId) {
        // console.log(
        //   `Security Alert: User ${socket.userId} tried to set userId to ${data.userId}`
        // );
        socket.emit("error", { message: "Unauthorized" });
        socket.disconnect();
        return;
      }
      socket.userId = data.userId;
      socket.deviceId = data.deviceId;
      const user = await User.findById(socket.userId);
      if (user) {
        user.lastLogin = Date.now();
        user.lastLoginIp = socket.clientIp;
        await user.save();
      }
      const oldConnections = connectedUsers.filter(
        (user) => user.userId === socket.userId && user.socket !== socket
      );
      oldConnections.forEach((connection) => {
        if (connection.deviceId !== socket.deviceId) {
          connection.socket.emit("duplicateLogin", {
            fromDifferentDevice: true,
          });
          connection.socket.disconnect();
        }
      });
      connectedUsers = connectedUsers.filter(
        (user) => !oldConnections.includes(user)
      );
      const existingUserIndex = connectedUsers.findIndex(
        (user) => user.userId === socket.userId
      );
      if (existingUserIndex !== -1) {
        connectedUsers[existingUserIndex] = {
          userId: socket.userId,
          deviceId: socket.deviceId,
          socket,
        };
      } else {
        connectedUsers.push({
          userId: socket.userId,
          deviceId: socket.deviceId,
          socket,
        });
      }
    } catch (error) {
      console.error("Error in setUserId:", error);
    }
  });

  socket.on("setAdminId", async (data) => {
    try {
      if (data.adminId !== socket.userId) {
        // console.log(
        //   `Security Alert: Admin ${socket.userId} tried to set adminId to ${data.adminId}`
        // );
        socket.emit("error", { message: "Unauthorized" });
        socket.disconnect();
        return;
      }
      socket.adminId = data.adminId;
      await updateAdminStatus(socket.adminId, true);
      const existingAdminIndex = connectedAdmins.findIndex(
        (admin) => admin.adminId === socket.adminId
      );
      if (existingAdminIndex !== -1) {
        connectedAdmins[existingAdminIndex] = {
          adminId: socket.adminId,
          socket,
        };
      } else {
        connectedAdmins.push({
          adminId: socket.adminId,
          socket,
        });
      }
    } catch (error) {
      console.error("Error in setAdminId:", error);
    }
  });

  socket.on("getUsername", async () => {
    try {
      const userPromises = connectedUsers.map(async (connectedUser) => {
        const user = await User.findById(connectedUser.userId);
        if (user) {
          return {
            userId: user._id,
            username: user.username,
            wallet: user.wallet,
            vip: user.viplevel,
            lastlogin: user.lastLogin,
          };
        }
        return null;
      });
      const onlineUsers = await Promise.all(userPromises);
      const validOnlineUsers = onlineUsers.filter((user) => user !== null);
      socket.emit("usernameResponse", { onlineUsers: validOnlineUsers });
    } catch (error) {
      console.error("Error in getUsername:", error);
      socket.emit("error", { message: "Error fetching online users data" });
    }
  });

  socket.on("requestLatestData", async () => {
    await Promise.all([
      sendLatestDeposits(socket),
      sendLatestWithdraws(socket),
      sendLatestBonusUpdates(socket),
    ]);
  });

  socket.on("disconnect", () => {
    if (socket.adminId) {
      updateAdminStatus(socket.adminId, false);
      connectedAdmins = connectedAdmins.filter(
        (admin) => admin.socket !== socket
      );
    }
    if (socket.userId) {
      connectedUsers = connectedUsers.filter((user) => user.socket !== socket);
    }
  });
});

async function sendLatestDeposits(socket) {
  try {
    const deposits = await Deposits.find({ status: "pending" });
    socket.emit("latest deposits", deposits);
  } catch (error) {
    console.error("Error fetching latest deposits:", error);
  }
}

async function sendLatestWithdraws(socket) {
  try {
    const withdraws = await Withdraw.find({ status: "pending" });
    socket.emit("latest withdraws", withdraws);
  } catch (error) {
    console.error("Error fetching latest withdraws:", error);
  }
}

async function sendLatestBonusUpdates(socket) {
  try {
    const bonuses = await Bonus.find({ status: "pending" });
    socket.emit("latest bonuses", bonuses);
  } catch (error) {
    console.error("Error fetching latest bonuses:", error);
  }
}

function forceLogout(userId) {
  const userConnection = connectedUsers.find((user) => user.userId === userId);
  if (userConnection) {
    try {
      userConnection.socket.emit("forceLogout");
      userConnection.socket.disconnect();
      connectedUsers = connectedUsers.filter((user) => user.userId !== userId);
    } catch (error) {
      console.error(`Error during force logout for user ${userId}:`, error);
    }
  }
}

function forceLogoutAdmin(adminId) {
  const adminConnection = connectedAdmins.find(
    (admin) => admin.adminId === adminId
  );
  if (adminConnection) {
    try {
      adminConnection.socket.emit("forceLogoutAdmin");
      adminConnection.socket.disconnect();
      connectedAdmins = connectedAdmins.filter(
        (admin) => admin.adminId !== adminId
      );
      updateAdminStatus(adminId, false);
      return true;
    } catch (error) {
      console.error(`Error during force logout for admin ${adminId}:`, error);
      return false;
    }
  } else {
    console.log(`Admin ${adminId} not found in connected admins list`);
    return false;
  }
}

app.post(
  "/admin/api/force-logout-by-admin",
  authenticateAdminToken,
  async (req, res) => {
    const admin = await adminUser.findById(req.user.userId);
    let clientIp = req.headers["x-forwarded-for"] || req.ip;
    clientIp = clientIp.split(",")[0].trim();

    const { userId } = req.body;
    const user = await User.findById(userId);

    forceLogout(userId);

    await adminLogAttempt(
      admin.username,
      admin.fullname,
      clientIp,
      `User: ${user.username} has been force logout. Performed by ${admin.username}`
    );

    res.json({ message: "User forced to logout" });
  }
);

app.post(
  "/admin/api/force-logout-admin",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const admin = await adminUser.findById(req.user.userId);
      let clientIp = req.headers["x-forwarded-for"] || req.ip;
      clientIp = clientIp.split(",")[0].trim();
      const { adminId } = req.body;
      if (!adminId) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Admin ID is required",
            zh: "管理员ID是必需的",
          },
        });
      }
      const targetAdmin = await adminUser.findById(adminId);
      if (!targetAdmin) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Admin not found",
            zh: "未找到管理员",
          },
        });
      }
      const result = forceLogoutAdmin(adminId);

      if (admin.role !== "superadmin") {
        await adminLogAttempt(
          admin.username,
          admin.fullname,
          clientIp,
          `Admin: ${targetAdmin.username} has been force logout. Performed by ${admin.username}`
        );
      }

      if (result) {
        res.status(200).json({
          success: true,
          message: {
            en: "Admin forced to logout successfully",
            zh: "管理员已被成功强制登出",
          },
        });
      } else {
        res.status(200).json({
          success: true,
          message: {
            en: "Admin was not online or already logged out",
            zh: "管理员不在线或已经登出",
          },
        });
      }
    } catch (error) {
      console.error("Error forcing admin logout:", error);
      res.status(500).json({
        success: false,
        message: {
          en: "Internal server error",
          zh: "服务器内部错误",
        },
      });
    }
  }
);

app.post("/admin/api/mails", authenticateAdminToken, async (req, res) => {
  try {
    const {
      username,
      titleEN,
      titleCN,
      titleMS,
      contentEN,
      contentCN,
      contentMS,
    } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(200).json({
        success: false,
        message: {
          en: "User not found",
          zh: "找不到用户",
        },
      });
    }

    sendNotificationToUser(
      user._id,
      {
        en: "You have received a new mail",
        zh: "您收到一条新邮件",
        ms: "Anda telah menerima mel baru",
      },
      {
        en: "New Mail",
        zh: "新邮件",
        ms: "Mel Baru",
      }
    );

    const mail = new Mail({
      recipientId: user._id,
      username,
      titleEN,
      titleCN,
      titleMS,
      contentEN,
      contentCN,
      contentMS,
    });

    const savedMail = await mail.save();

    res.status(200).json({
      success: true,
      message: {
        en: "Mail sent successfully",
        zh: "邮件发送成功",
      },
      data: savedMail,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: "Error sending mail",
        zh: "发送邮件时出错",
      },
    });
  }
});

mongoose.connect(process.env.MONGODB_URI);

const registerUser = async ({
  fullname,
  phone,
  bankName,
  bankNumber,
  freeCreditApply,
  whatsappPhone,
}) => {
  try {
    const formatPhone = (p) => {
      const cleaned = String(p).replace(/\D/g, "");
      return cleaned.length === 8 ? `852${cleaned}` : cleaned;
    };
    const providedPhone = formatPhone(phone);
    const waPhone = formatPhone(whatsappPhone);
    const phoneNumbers = [providedPhone];
    if (waPhone && waPhone !== providedPhone) {
      phoneNumbers.push(waPhone);
    }
    const bankAccounts =
      bankName && bankNumber
        ? [
            {
              name: fullname,
              bankname: bankName,
              banknumber: bankNumber,
            },
          ]
        : [];
    const response = await axios.post(
      `${process.env.BASE_URL}internal/registeruser`,
      { fullname, phoneNumbers, bankAccounts, freeCreditApply },
      {
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": process.env.INTERNAL_API_KEY,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Register error:", error.response?.data || error.message);
    return { success: false };
  }
};

const handleAutoReply = async (conversation, messageText) => {
  const text = messageText.trim();
  const textLower = text.toLowerCase();
  const conversationId = conversation.conversationId;
  const step = conversation.step;
  const lang = conversation.language;

  const agentKeywords = [
    "客服",
    "人工",
    "真人",
    "幫我",
    "帮我",
    "問題",
    "问题",
    "agent",
    "human",
    "help",
    "support",
    "problem",
    "issue",
    "投訴",
    "投诉",
    "complain",
  ];

  if (step && step !== "waiting_agent") {
    const needsAgent = agentKeywords.some((keyword) =>
      textLower.includes(keyword.toLowerCase())
    );

    if (needsAgent) {
      const isZh = lang === "zh" || !lang;
      await sendMessage(
        conversationId,
        isZh
          ? `好的，我哋嘅客服會馬上幫您處理❤️\n請稍等~`
          : `Sure, our customer service will assist you shortly❤️\nPlease wait~`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        needsAgent: true,
      });
      return;
    }
  }

  // ============ 等待客服 - 不自动回复 ============
  if (step === "waiting_agent") {
    return;
  }

  // ============ 新客户欢迎 ============
  if (!step) {
    await sendImage(
      conversationId,
      "https://pub-92886b3c2cd44be98c01f0933462d4fd.r2.dev/hkwin-promo-cn.jpg"
    );

    await sendImage(
      conversationId,
      "https://pub-92886b3c2cd44be98c01f0933462d4fd.r2.dev/hkwin-promo-en.jpg"
    );

    await sendMessage(
      conversationId,
      `Welcome to HKWIN88❤️ 歡迎嚟到HKWIN88❤️\n\n` +
        `1️⃣ 領取免費積分 Register Free Credit\n` +
        `2️⃣ 註冊 & 存款 Register & Deposit\n` +
        `3️⃣ 聯繫客服 Contact Our Customer Support`
    );
    await updateConversation(conversation._id, {
      step: "welcome",
    });
    return;
  }

  // ============ 欢迎菜单选择 ============
  if (step === "welcome") {
    if (text === "1") {
      await sendMessage(
        conversationId,
        `請選擇你嘅語言❤️\n` +
          `Welcome Dear, Please select your language❤️\n\n` +
          `1️⃣ 中文 Chinese\n` +
          `2️⃣ 英文 English`
      );
      await updateConversation(conversation._id, {
        step: "select_language",
        flowType: "free_credit",
      });
    } else if (text === "2") {
      await sendMessage(
        conversationId,
        `請選擇你嘅語言❤️\n` +
          `Welcome Dear, Please select your language❤️\n\n` +
          `1️⃣ 中文 Chinese\n` +
          `2️⃣ 英文 English `
      );
      await updateConversation(conversation._id, {
        step: "select_language",
        flowType: "register",
      });
    } else if (text === "3") {
      await sendMessage(
        conversationId,
        `請稍等，我哋嘅客服會馬上幫您處理❤️\n` +
          `Please wait, our customer service will assist you shortly❤️`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        needsAgent: true,
      });
    } else {
      await sendMessage(conversationId, `請回覆 1️⃣, 2️⃣ 或 3️⃣`);
    }
    return;
  }

  // ============ 选择语言 ============
  if (step === "select_language") {
    const flowType = conversation.flowType;

    if (text === "1") {
      await updateConversation(conversation._id, { language: "zh" });

      if (flowType === "free_credit") {
        await sendMessage(
          conversationId,
          `✅ 老闆您好，歡迎光顧HKWIN88香港總代理\n` +
            `✅ 免費35積分只限於銀行賬號註冊\n\n` +
            `🆓 免費35積分需打滿350積分可出$100\n` +
            `🆓 出款只可以出返俾以上您所提供嘅銀行賬號\n` +
            `🆓 禁止進行老虎機/打魚類型以外嘅遊戲\n` +
            `🆓 免費活動多人申請，請老闆體諒耐心等候，我哋會盡快幫你處理，多謝😍\n\n` +
            `⬇️ 請提供你嘅英文全名：`
        );
        await updateConversation(conversation._id, {
          step: "fc_fullname_zh",
        });
      } else {
        // 注册 & 存款流程
        await sendMessage(conversationId, `請老闆提供你本人嘅英文全名~😘`);
        await updateConversation(conversation._id, {
          step: "reg_fullname_zh",
        });
      }
    } else if (text === "2") {
      await updateConversation(conversation._id, { language: "en" });

      if (flowType === "free_credit") {
        await sendMessage(
          conversationId,
          `✅ Hi Dear, Welcome to HKWIN88\n` +
            `✅ 35 Free Point is only available for bank account registration\n\n` +
            `🆓 35 Free point hit over 350 points save $100\n` +
            `🆓 Withdrawal can only be cash out to the bank account you provided above\n` +
            `🆓 Games beside than slot machine/fishing are not allowed\n` +
            `🆓 35 Free point many people apply, dear please hold on ya. We will assist you as soon as possible, thank you very much 😍\n\n` +
            `⬇️ Please provide your English full name:`
        );
        await updateConversation(conversation._id, { step: "fc_fullname_en" });
      } else {
        // 注册 & 存款流程
        await sendMessage(
          conversationId,
          `Dear please provide your full name ya😍`
        );
        await updateConversation(conversation._id, { step: "reg_fullname_en" });
      }
    } else {
      await sendMessage(
        conversationId,
        `請回覆 1️⃣ 或 2️⃣\nPlease reply 1️⃣ or 2️⃣`
      );
    }
    return;
  }

  // ============ 注册存款 - 收集全名（中文）============
  if (step === "reg_fullname_zh") {
    const fullname = text.trim();

    if (!/^[A-Za-z\s]+$/.test(fullname)) {
      await sendMessage(
        conversationId,
        `⚠️ 請只輸入英文全名（例如：CHAN TAI MAN）\n` +
          `唔好包含數字或其他資料哦～`
      );
      return;
    }

    if (fullname.length < 2) {
      await sendMessage(conversationId, `請提供你嘅英文全名~😘`);
      return;
    }

    await updateConversation(conversation._id, {
      "tempData.fullname": fullname,
    });
    await sendMessage(conversationId, `請提供你嘅手機號碼：`);
    await updateConversation(conversation._id, { step: "reg_phone_zh" });
    return;
  }

  // ============ 注册存款 - 收集电话（中文）============
  if (step === "reg_phone_zh") {
    const phone = text.trim().replace(/\D/g, "");
    if (phone.length < 8) {
      await sendMessage(conversationId, `請提供正確嘅手機號碼：`);
      return;
    }

    const tempData = conversation.tempData || {};
    const fullname = tempData.fullname;

    // 注册用户
    const result = await registerUser({
      fullname,
      phone,
      freeCreditApply: false,
      whatsappPhone: conversation.contactPhone,
    });

    if (result.success) {
      await sendMessage(
        conversationId,
        `✅ 註冊成功！\n\n` +
          `⚠️ 溫馨提示：存款同提款必須使用同一個銀行戶口名，如果使用朋友名字存款，提款時只可以出返俾您嘅朋友 ⚠️\n\n` +
          `請稍等，客服會發存款資料俾您❤️`
      );
    } else if (result.error === "duplicate_name") {
      await sendMessage(
        conversationId,
        `❌ 此名字已經註冊，請稍等客服會為您處理`
      );
    } else if (result.error === "duplicate_phone") {
      await sendMessage(
        conversationId,
        `❌ 此電話號碼已經註冊，請稍等客服會為您處理`
      );
    } else {
      await sendMessage(conversationId, `❌ 註冊失敗，請稍等客服會為您處理`);
    }

    await updateConversation(conversation._id, {
      step: "waiting_agent",
      tempData: { fullname, phone },
      needsAgent: true,
    });
    return;
  }

  // ============ 注册存款 - 收集全名（英文）============
  if (step === "reg_fullname_en") {
    const fullname = text.trim();

    if (!/^[A-Za-z\s]+$/.test(fullname)) {
      await sendMessage(
        conversationId,
        `⚠️ Please enter your English full name only (e.g., CHAN TAI MAN)\n` +
          `Do not include numbers or other information~`
      );
      return;
    }

    if (fullname.length < 2) {
      await sendMessage(
        conversationId,
        `Dear please provide your full name ya😍`
      );
      return;
    }

    await updateConversation(conversation._id, {
      "tempData.fullname": fullname,
    });
    await sendMessage(
      conversationId,
      `Please provide your mobile phone number:`
    );
    await updateConversation(conversation._id, { step: "reg_phone_en" });
    return;
  }

  // ============ 注册存款 - 收集电话（英文）============
  if (step === "reg_phone_en") {
    const phone = text.trim().replace(/\D/g, "");
    if (phone.length < 8) {
      await sendMessage(conversationId, `Please provide a valid phone number:`);
      return;
    }

    const tempData = conversation.tempData || {};
    const fullname = tempData.fullname;

    // 注册用户
    const result = await registerUser({
      fullname,
      phone,
      freeCreditApply: false,
      whatsappPhone: conversation.contactPhone,
    });

    if (result.success) {
      await sendMessage(
        conversationId,
        `✅ Registration successful!\n\n` +
          `⚠️ Reminder: Deposit and withdrawal must use the same bank account name. If using a friend's name to deposit, withdrawal can only be made to your friend's account ⚠️\n\n` +
          `Please wait, our customer service will send you the deposit details❤️`
      );
    } else if (result.error === "duplicate_name") {
      await sendMessage(
        conversationId,
        `❌ This name is already registered, please wait for our customer service`
      );
    } else if (result.error === "duplicate_phone") {
      await sendMessage(
        conversationId,
        `❌ This phone number is already registered, please wait for our customer service`
      );
    } else {
      await sendMessage(
        conversationId,
        `❌ Registration failed, please wait for our customer service`
      );
    }

    await updateConversation(conversation._id, {
      step: "waiting_agent",
      tempData: { fullname, phone },
      needsAgent: true,
    });
    return;
  }

  // ============ 免费积分 - 收集全名（中文）============
  if (step === "fc_fullname_zh") {
    const fullname = text.trim();
    if (!/^[A-Za-z\s]+$/.test(fullname)) {
      await sendMessage(
        conversationId,
        `⚠️ 請只輸入英文全名（例如：CHAN TAI MAN）\n` +
          `唔好包含數字或其他資料哦～`
      );
      return;
    }
    if (fullname.length < 2) {
      await sendMessage(conversationId, `請提供你嘅英文全名：`);
      return;
    }

    await updateConversation(conversation._id, {
      "tempData.fullname": fullname,
    });
    await sendMessage(conversationId, `請提供你嘅手機號碼：`);
    await updateConversation(conversation._id, { step: "fc_phone_zh" });
    return;
  }

  // ============ 免费积分 - 收集电话（中文）============
  if (step === "fc_phone_zh") {
    const phone = text.trim().replace(/\D/g, "");
    if (phone.length < 8) {
      await sendMessage(conversationId, `請提供正確嘅手機號碼：`);
      return;
    }
    await updateConversation(conversation._id, { "tempData.phone": phone });
    await sendMessage(
      conversationId,
      `請提供你嘅銀行名字（例如：HSBC、中銀）：`
    );
    await updateConversation(conversation._id, { step: "fc_bankname_zh" });
    return;
  }

  // ============ 免费积分 - 收集银行名（中文）============
  if (step === "fc_bankname_zh") {
    const bankName = text.trim();
    if (bankName.length < 2) {
      await sendMessage(conversationId, `請提供你嘅銀行名字：`);
      return;
    }
    await updateConversation(conversation._id, {
      "tempData.bankName": bankName,
    });
    await sendMessage(
      conversationId,
      `請提供你嘅銀行賬號號碼：

⚠️ 免費分唔接受轉數快，填轉數快一律唔處理出款`
    );
    await updateConversation(conversation._id, { step: "fc_banknumber_zh" });
    return;
  }

  // ============ 免费积分 - 收集银行号码（中文）============
  if (step === "fc_banknumber_zh") {
    const bankNumber = text.trim().replace(/\D/g, "");
    if (bankNumber.length < 6) {
      await sendMessage(conversationId, `請提供正確嘅銀行賬號號碼：`);
      return;
    }

    const tempData = conversation.tempData || {};
    const fullname = tempData.fullname;
    const phone = tempData.phone;
    const bankName = tempData.bankName;

    const result = await registerUser({
      fullname,
      phone,
      bankName,
      bankNumber,
      freeCreditApply: true,
      whatsappPhone: conversation.contactPhone,
    });

    if (result.success) {
      const { jokerGameName, jokerGamePW } = result.data;
      await sendMessage(
        conversationId,
        `✅ 註冊成功！\n\n` +
          `🎮 遊戲賬號：${jokerGameName}\n` +
          `🔑 密碼：${jokerGamePW}\n\n` +
          `🔗 下載鏈接：\n` +
          `📱 安卓App版本：https://tinyurl.com/c227ct7r\n` +
          `🌐 網頁版本：https://www.jokerapp888i.net/\n\n` +
          `✅ 免費35積分已經轉入您嘅遊戲賬號\n\n` +
          `📋 規則提醒：\n` +
          `🆓 免費35積分需打滿350積分可出$100\n` +
          `🆓 出款只可以出返俾以上您所提供嘅銀行賬號\n` +
          `🆓 禁止進行老虎機/打魚類型以外嘅遊戲\n\n` +
          `祝您遊戲愉快！如有任何問題請聯繫客服❤️`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
      });
    } else if (result.error === "duplicate_name") {
      await sendMessage(
        conversationId,
        `❌ 此名字已經註冊，請稍等客服會為您處理`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    } else if (result.error === "duplicate_phone") {
      await sendMessage(
        conversationId,
        `❌ 此電話號碼已經註冊，請稍等客服會為您處理`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    } else if (result.error === "duplicate_bank") {
      await sendMessage(
        conversationId,
        `❌ 此銀行號碼已經註冊，請稍等客服會為您處理`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    } else {
      await sendMessage(conversationId, `❌ 註冊失敗，請稍等客服會為您處理`);
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    }
    return;
  }

  // ============ 免费积分 - 收集全名（英文）============
  if (step === "fc_fullname_en") {
    const fullname = text.trim();
    if (!/^[A-Za-z\s]+$/.test(fullname)) {
      await sendMessage(
        conversationId,
        `⚠️ Please enter your English full name only (e.g., CHAN TAI MAN)\n` +
          `Do not include numbers or other information~`
      );
      return;
    }
    if (fullname.length < 2) {
      await sendMessage(
        conversationId,
        `Please provide your English full name:`
      );
      return;
    }

    await updateConversation(conversation._id, {
      "tempData.fullname": fullname,
    });
    await sendMessage(
      conversationId,
      `Please provide your mobile phone number:`
    );
    await updateConversation(conversation._id, { step: "fc_phone_en" });
    return;
  }
  // ============ 免费积分 - 收集电话（英文）============
  if (step === "fc_phone_en") {
    const phone = text.trim().replace(/\D/g, "");
    if (phone.length < 8) {
      await sendMessage(conversationId, `Please provide a valid phone number:`);
      return;
    }
    await updateConversation(conversation._id, { "tempData.phone": phone });
    await sendMessage(
      conversationId,
      `Please provide your bank name (e.g. HSBC, BOC):`
    );
    await updateConversation(conversation._id, { step: "fc_bankname_en" });
    return;
  }

  // ============ 免费积分 - 收集银行名（英文）============
  if (step === "fc_bankname_en") {
    const bankName = text.trim();
    if (bankName.length < 2) {
      await sendMessage(conversationId, `Please provide your bank name:`);
      return;
    }
    await updateConversation(conversation._id, {
      "tempData.bankName": bankName,
    });
    await sendMessage(
      conversationId,
      `Please provide your bank account number:

⚠️ Free credits do not accept FPS, FPS withdrawals will not be processed`
    );
    await updateConversation(conversation._id, { step: "fc_banknumber_en" });
    return;
  }

  // ============ 免费积分 - 收集银行号码（英文）============
  if (step === "fc_banknumber_en") {
    const bankNumber = text.trim().replace(/\D/g, "");
    if (bankNumber.length < 6) {
      await sendMessage(
        conversationId,
        `Please provide a valid bank account number:`
      );
      return;
    }

    const tempData = conversation.tempData || {};
    const fullname = tempData.fullname;
    const phone = tempData.phone;
    const bankName = tempData.bankName;

    const result = await registerUser({
      fullname,
      phone,
      bankName,
      bankNumber,
      freeCreditApply: true,
      whatsappPhone: conversation.contactPhone,
    });

    if (result.success) {
      const { jokerGameName, jokerGamePW } = result.data;
      await sendMessage(
        conversationId,
        `✅ Registration successful!\n\n` +
          `🎮 Game Account: ${jokerGameName}\n` +
          `🔑 Password: ${jokerGamePW}\n\n` +
          `🔗 Download Links:\n` +
          `📱 Android App: https://tinyurl.com/c227ct7r\n` +
          `🌐 Web Version: https://www.jokerapp888i.net/\n\n` +
          `✅ 35 Free points have been transferred to your game account\n\n` +
          `📋 Rules Reminder:\n` +
          `🆓 35 Free points hit over 350 points save $100\n` +
          `🆓 Withdrawal can only be cash out to the bank account you provided\n` +
          `🆓 Games beside slot machine/fishing are not allowed\n\n` +
          `Enjoy your game! Contact us if you have any questions❤️`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
      });
    } else if (result.error === "duplicate_name") {
      await sendMessage(
        conversationId,
        `❌ This name is already registered, please wait for our customer service`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    } else if (result.error === "duplicate_phone") {
      await sendMessage(
        conversationId,
        `❌ This phone number is already registered, please wait for our customer service`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    } else if (result.error === "duplicate_bank") {
      await sendMessage(
        conversationId,
        `❌ This bank number is already registered, please wait for our customer service`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    } else {
      await sendMessage(
        conversationId,
        `❌ Registration failed, please wait for our customer service`
      );
      await updateConversation(conversation._id, {
        step: "waiting_agent",
        tempData: { fullname, phone, bankName, bankNumber },
        needsAgent: true,
      });
    }
    return;
  }
};

// ============ Helper Functions ============

const sendMessage = async (conversationId, text) => {
  try {
    await axios.post(
      `https://conversations.messagebird.com/v1/conversations/${conversationId}/messages`,
      { type: "text", content: { text } },
      {
        headers: {
          Authorization: `AccessKey ${process.env.MESSAGEBIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Send message failed:",
      error.response?.data || error.message
    );
  }
};

const sendImage = async (conversationId, imageUrl, caption = "") => {
  try {
    const response = await axios.post(
      `https://conversations.messagebird.com/v1/conversations/${conversationId}/messages`,
      {
        type: "image",
        content: {
          image: {
            url: imageUrl,
            caption: caption,
          },
        },
      },
      {
        headers: {
          Authorization: `AccessKey ${process.env.MESSAGEBIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Send image error:", error.response?.data || error.message);
    return null;
  }
};

const updateConversation = async (id, data) => {
  await Conversation.findByIdAndUpdate(id, data);
};

// 解析用户输入的资料
const parseUserInfo = (text) => {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);
  const result = {
    fullname: null,
    phone: null,
    bankName: null,
    bankNumber: null,
  };

  for (const line of lines) {
    const lower = line.toLowerCase();

    // 尝试匹配格式 "英文全名：xxx" 或 "Full name: xxx"
    if (lower.includes("全名") || lower.includes("name")) {
      result.fullname = line.split(/[：:]/)[1]?.trim();
    } else if (
      lower.includes("手機") ||
      lower.includes("phone") ||
      lower.includes("mobile")
    ) {
      result.phone = line.split(/[：:]/)[1]?.trim()?.replace(/\D/g, "");
    } else if (lower.includes("銀行名") || lower.includes("bank name")) {
      result.bankName = line.split(/[：:]/)[1]?.trim();
    } else if (
      lower.includes("銀行號") ||
      lower.includes("bank number") ||
      lower.includes("account")
    ) {
      result.bankNumber = line.split(/[：:]/)[1]?.trim()?.replace(/\D/g, "");
    }
  }

  // 如果没有标签，按顺序解析
  if (!result.fullname && lines.length >= 4) {
    result.fullname = lines[0];
    result.phone = lines[1]?.replace(/\D/g, "");
    result.bankName = lines[2];
    result.bankNumber = lines[3]?.replace(/\D/g, "");
  }

  return result;
};

// 检查重复（中文）
const checkDuplicate = async (fullname, phone, bankNumber) => {
  const normalizedFullname = fullname.toLowerCase().replace(/\s+/g, "");

  const existingName = await User.findOne({
    fullname: new RegExp(`^${normalizedFullname}$`, "i"),
  });
  if (existingName) return "此名字已經註冊";

  const existingPhone = await User.findOne({
    $or: [{ phonenumber: phone }, { phoneNumbers: phone }],
  });
  if (existingPhone) return "此電話號碼已經註冊";

  const existingBank = await User.findOne({
    "bankAccounts.accountNumber": bankNumber,
  });
  if (existingBank) return "此銀行號碼已經註冊";

  return null;
};

// 检查重复（英文）
const checkDuplicateEN = async (fullname, phone, bankNumber) => {
  const normalizedFullname = fullname.toLowerCase().replace(/\s+/g, "");

  const existingName = await User.findOne({
    fullname: new RegExp(`^${normalizedFullname}$`, "i"),
  });
  if (existingName) return "This name is already registered";

  const existingPhone = await User.findOne({
    $or: [{ phonenumber: phone }, { phoneNumbers: phone }],
  });
  if (existingPhone) return "This phone number is already registered";

  const existingBank = await User.findOne({
    "bankAccounts.accountNumber": bankNumber,
  });
  if (existingBank) return "This bank number is already registered";

  return null;
};

// 检查名字重复
const checkDuplicateName = async (fullname) => {
  const normalizedFullname = fullname.toLowerCase().replace(/\s+/g, "");
  const existing = await User.findOne({
    fullname: new RegExp(`^${normalizedFullname}$`, "i"),
  });
  return !!existing;
};

module.exports = { handleAutoReply };

const sendWhatsAppMessage = async (conversationId, text) => {
  await axios.post(
    `https://conversations.messagebird.com/v1/conversations/${conversationId}/messages`,
    { type: "text", content: { text } },
    {
      headers: {
        Authorization: `AccessKey ${process.env.MESSAGEBIRD_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
};

const updateStep = async (id, step) => {
  await Conversation.findByIdAndUpdate(id, { "customer.step": step });
};

app.post("/webhook/whatsapp", async (req, res) => {
  try {
    const { type, message, conversation, contact } = req.body;
    if (type === "message.created" && message) {
      const lastMessageText =
        message.type === "image" ? "📷 Image" : message.content?.text || "";
      const existingConv = await Conversation.findOne({
        conversationId: conversation.id,
      });
      const needsAgent =
        message.direction === "received" &&
        (existingConv?.step === "waiting_agent" ||
          existingConv?.step === "waiting_screenshot");

      let replyToData = null;
      if (message.replyTo?.id) {
        const quotedMessage = await Message.findOne({
          messageId: message.replyTo.id,
        });
        if (quotedMessage) {
          replyToData = {
            messageId: message.replyTo.id,
            content: quotedMessage.content,
            type: quotedMessage.type,
            from: quotedMessage.from,
          };
        } else {
          replyToData = {
            messageId: message.replyTo.id,
            content: null,
            type: null,
            from: null,
          };
        }
      }

      const conv = await Conversation.findOneAndUpdate(
        { conversationId: conversation.id },
        {
          conversationId: conversation.id,
          contactId: contact.id,
          contactPhone: message.from,
          contactName: contact.displayName || "",
          channelId: message.channelId,
          status: conversation.status,
          lastMessageAt: new Date(),
          lastMessage: lastMessageText,
          $inc: { unreadCount: message.direction === "received" ? 1 : 0 },
          ...(needsAgent && { needsAgent: true }),
        },
        { upsert: true, new: true }
      );

      await Message.findOneAndUpdate(
        { messageId: message.id },
        {
          messageId: message.id,
          conversationId: conversation.id,
          from: message.from,
          to: message.to,
          direction: message.direction,
          type: message.type,
          content: message.content,
          status: message.status,
          replyTo: replyToData,
        },
        { upsert: true, new: true }
      );

      if (message.direction === "received" && message.type === "text") {
        await handleAutoReply(conv, message.content?.text || "");
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook 错误:", error);
    res.status(200).send("OK");
  }
});

app.get("/", (req, res) => {
  res.status(403).send({
    error: "Access Forbidden",
    message: "You do not have permission to access this resource.",
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.use(express.static("public"));
app.use(usersRouter);
app.use(depositRouter);
app.use(adminUserRouter);
app.use(withdrawRouter);
app.use(banklistRouter);
app.use(userbanklistRouter);
app.use(carouselRouter);
app.use(BankTransactionLogRouter);
app.use(promotionRouter);
app.use(vipRouter);
app.use(UserWalletLogRouter);
app.use(popUpRouter);
app.use(BonusRouter);
app.use(LuckySpinRouter);
app.use(InformationRouter);
app.use(ReviewRouter);
app.use(LeaderboardRouter);
app.use(BlogRouter);
app.use(MailRouter);
app.use(AnnouncementRouter);
app.use(AnnouncementCategoryRouter);
app.use(HelpRouter);
app.use(FeedbackRouter);
app.use(PromoCodeRouter);
app.use(MemoRouter);
app.use(GeneralRouter);
app.use(KioskCategoryRouter);
app.use(Kiosk);
app.use(PromotionCategoryRouter);
app.use(RebateScheduleRouter);
app.use(AgentRouter);
app.use(AgentLevelSystemRouter);
app.use(CheckInRouter);
app.use(emailRouter);
app.use(LuckySpinSettingRouter);
app.use(SEORouter);
app.use(PaymentGatewayRouter);
app.use(WhitelistIPRouter);
app.use(KioskBalanceRouter);
app.use(CryptoRouter);
app.use(VultrRouter);
app.use(AgentPTRouter);
app.use(FreeCreditRouter);
app.use(FacebookRouter);
app.use(GamelistRouter);
app.use(AttendanceBonusRouter);
app.use(LoyaltyBonusRouter);
app.use(whatsappRouter);

app.use(adminListRouter);
app.use(notificationRouter);

app.use(slotJokerRouter);

app.use(ALLGameFunctionRouter);
app.use(ALLGameStatusRouter);

app.use(myPromotionRouter);

app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: "请求的资源不存在",
  });
});

// app.use((err, req, res, next) => {
//   console.error("=== Global Error Caught ===");
//   console.error("Time:", new Date().toISOString());
//   console.error("Path:", req.method, req.originalUrl);
//   console.error("IP:", req.ip);
//   console.error("Error:", err.message);
//   console.error("Stack:", err.stack);
//   console.error("========================");
//   res.status(err.status || 500).json({
//     success: false,
//     message: {
//       en: "Internal server error",
//       zh: "服务器内部错误",
//       ms: "Ralat dalaman pelayan",
//     },
//   });
// });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});

module.exports = wss;
