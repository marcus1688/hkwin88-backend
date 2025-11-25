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
const smsRouter = require("./routes/sms");
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

const adminListRouter = require("./routes/adminlist");
const notificationRouter = require("./routes/notification");

const { resetCheckinStreaks } = require("./routes/checkin");

const slotliveGSCRouter = require("./routes/GAMEAPI/allGSI");
const slotlivePPRouter = require("./routes/GAMEAPI/slot_livepp");
const slotCQ9Router = require("./routes/GAMEAPI/slotcq9");
const slotHabaneroRouter = require("./routes/GAMEAPI/slothabanero");
const slotlive22Router = require("./routes/GAMEAPI/slotlive22");
const slotFachaiRouter = require("./routes/GAMEAPI/slotfachai");
const slotSpadeGamingRouter = require("./routes/GAMEAPI/slotspadegaming");
const slotFunkyRouter = require("./routes/GAMEAPI/slotfunky");
const slotJokerRouter = require("./routes/GAMEAPI/slotjoker.model");
const slotKaGamingRouter = require("./routes/GAMEAPI/slotkagaming");
const slotJiliRouter = require("./routes/GAMEAPI/slotjili");
const slotJDBRouter = require("./routes/GAMEAPI/slotjdb");
const slotLiveMicroGamingRouter = require("./routes/GAMEAPI/slot_livemicrogaming");
const slotApolloRouter = require("./routes/GAMEAPI/slotapollo");
const slotClotPlayRouter = require("./routes/GAMEAPI/slotclotplay");
const slotEpicWinRouter = require("./routes/GAMEAPI/slotepicwin");
const slotBNGRouter = require("./routes/GAMEAPI/slotbng");
const slotPegasusRouter = require("./routes/GAMEAPI/slotpegasus");
const slotKingMakerRouter = require("./routes/GAMEAPI/slotkingmaker");
const slotUUSlotRouter = require("./routes/GAMEAPI/slotuuslot");
const slotPGSlotRouter = require("./routes/GAMEAPI/slotpgslot");
const slotRSGRouter = require("./routes/GAMEAPI/slotrsg");

const liveYeebetRouter = require("./routes/GAMEAPI/liveyeebet");
const liveEvolutionRouter = require("./routes/GAMEAPI/liveevolution");
const liveWmCasinoRouter = require("./routes/GAMEAPI/livewmcasino");
const liveWeCasinoRouter = require("./routes/GAMEAPI/livewecasino");
const liveAFBRouter = require("./routes/GAMEAPI/slot_live_afb");
const liveDreamGamingRouter = require("./routes/GAMEAPI/livedreamgaming");
const liveSexybcrtRouter = require("./routes/GAMEAPI/livesexybcrt");

const otherHorsebookRouter = require("./routes/GAMEAPI/otherhorsebook");
const otherVGRouter = require("./routes/GAMEAPI/othervgqipai");

const esportIAGamingRouter = require("./routes/GAMEAPI/esportiagaming");
const esportTFGamingRouter = require("./routes/GAMEAPI/esporttfgaming");

const sportCMD368Router = require("./routes/GAMEAPI/sportcmd");
const sportWssportRouter = require("./routes/GAMEAPI/sportwssport");
const sportAFB1188Router = require("./routes/GAMEAPI/sportafb");
const sportM9BETRouter = require("./routes/GAMEAPI/sportm9bet");

const paymentgatewayEasyPayRouter = require("./routes/PaymentGateway/easypay");
const paymentgatewayLMWPayRouter = require("./routes/PaymentGateway/lmwpay");

const allImportGameRouter = require("./routes/GAMEAPI/0_ImportGameList");
const allGameStatus = require("./routes/GAMEAPI/0_GameStatus");
const GameFunction = require("./routes/GAMEAPI/0_GameFunction");
const gameTurnoverRouter = require("./routes/GAMEAPI/0_GameTotalTurnover");
const ezwin9GameRouter = require("./routes/GAMEAPI/0_Ezwin9Function");

const {
  processWsSportTickets,
  processAFB1188Bets,
  processCMD368Bets,
} = require("./services/sportsData");

const {
  processWMCasinoRecords,
  processAFBRecords,
} = require("./services/liveCasinoData");

const cors = require("cors");
const cookieParser = require("cookie-parser");
const cookie = require("cookie");
const Deposits = require("./models/deposit.model");
const Withdraw = require("./models/withdraw.model");
const { User } = require("./models/users.model");
const { adminUser, adminLog } = require("./models/adminuser.model");
const { Mail } = require("./models/mail.model");
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
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
  "https://mysteryclub88.com",
  "https://www.mysteryclub88.com",
  "https://www.ezwin9.com",
  "https://vercel.com/marcus-projects-3c8bb325/stash88-frontend/4aq13rrn8TXDxRHJgf2TbCgfG8SK",
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
require("./services/maintenanceScheduler");

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
  skip: (req, res) => req.path === "/health",
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

app.get(
  "/admin/api/fallback-latest-transactions",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const [deposits, withdraws, bonuses] = await Promise.all([
        Deposits.find({ status: "pending" }),
        Withdraw.find({ status: "pending" }),
        Bonus.find({ status: "pending" }),
      ]);
      return res.status(200).json({
        success: true,
        data: {
          deposits,
          withdraws,
          bonuses,
        },
      });
    } catch (error) {
      console.error("Fallback API error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// --- SOCKET IO END ---

function sendNotificationToUser(userId, message, title) {
  const userConnection = connectedUsers.find(
    (user) => user.userId.toString() === userId.toString()
  );

  if (userConnection && userConnection.socket.connected) {
    userConnection.socket.emit("notification", { message, title });
  }
}

function verifyTatumSignature(payload, signature, secret) {
  try {
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha512", secret)
      .update(payloadString, "utf8")
      .digest("base64");
    if (signature.length !== expectedSignature.length) {
      console.log("Signature length mismatch");
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(signature, "base64"),
      Buffer.from(expectedSignature, "base64")
    );
  } catch (error) {
    console.error("Error verifying Tatum signature:", error);
    return false;
  }
}

app.post(
  "/webhook-endpoint",
  (req, res, next) => {
    const signature = req.headers["x-payload-hash"];
    const hmacSecret = process.env.TATUM_HMAC_SECRET;
    if (!hmacSecret) {
      console.error("TATUM_HMAC_SECRET not configured");
      return res.status(500).json({
        message: "Server configuration error",
      });
    }
    if (!signature) {
      console.log("Missing x-payload-hash header in webhook request");
      return res.status(401).json({
        message: "Unauthorized - Missing signature",
      });
    }
    if (!verifyTatumSignature(req.body, signature, hmacSecret)) {
      console.log("Invalid webhook signature from Tatum");
      console.log("Expected signature format: base64");
      console.log("Received signature:", signature);
      return res.status(401).json({
        message: "Unauthorized - Invalid signature",
      });
    }
    console.log("✅ Tatum webhook signature verified successfully");
    next();
  },
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const webhookData = req.body;
      if (webhookData.asset !== "USDT_TRON") {
        return res.status(200).json({
          message: `${webhookData.asset} asset received, no action taken`,
        });
      }
      const address = webhookData.address;
      const usdtAmount = parseFloat(webhookData.amount);
      const approvedAt = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
      const user = await User.findOne({
        "cryptoWallet.crypto_address": address,
      }).session(session);
      if (!user) {
        console.log(`User not found for wallet address: ${address}`);
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ message: "User or wallet address not found" });
      }
      const rateRecord = await myrusdtModel
        .findOne({ name: "USDT-MYR" })
        .session(session);
      if (!rateRecord) {
        console.log("Exchange rate record not found");
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ message: "Exchange rate not found" });
      }
      const bank = await BankList.findOne({ bankname: "USDT" }).session(
        session
      );
      if (!bank) {
        console.log("USDT bank record not found");
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Bank not found" });
      }
      const buyrate = rateRecord.buyrate;
      const myrAmount = Math.floor(usdtAmount * buyrate * 100) / 100;
      const transactionId = uuidv4();
      const isFirstDeposit = user.firstDepositDate === null;
      if (isFirstDeposit) {
        user.firstDepositDate = approvedAt;
      }
      user.wallet += myrAmount;
      user.totaldeposit += myrAmount;
      user.lastdepositdate = new Date();
      await user.save({ session });
      const deposit = new Deposits({
        userId: user._id,
        username: user.username,
        fullname: user.fullname,
        bankname: bank.bankname,
        ownername: bank.ownername,
        bankid: bank._id,
        walletType: "Main",
        method: "auto",
        transactionType: "deposit",
        processBy: "Self Processed",
        amount: Number(myrAmount.toFixed(2)),
        presignedUrl: "N/A",
        remark: `USDT ${webhookData.amount}`,
        transactionId: transactionId,
        status: "approved",
        processtime: "N/A",
        newDeposit: isFirstDeposit,
      });
      await deposit.save({ session });
      const walletLog = new UserWalletLog({
        userId: user._id,
        transactionid: deposit.transactionId,
        transactiontime: new Date(),
        transactiontype: "deposit",
        amount: myrAmount,
        status: "approved",
        promotionnameEN: `USDT ${webhookData.amount}`,
      });
      await walletLog.save({ session });
      bank.totalDeposits += Number(webhookData.amount);
      bank.currentbalance =
        bank.startingbalance +
        bank.totalDeposits -
        bank.totalWithdrawals +
        bank.totalCashIn -
        bank.totalCashOut;
      await bank.save({ session });
      const depositLog = new BankTransactionLog({
        bankName: bank.bankname,
        ownername: bank.ownername,
        bankAccount: bank.bankaccount,
        network: bank.network,
        remark: `HKD ${myrAmount}`,
        lastBalance: bank.currentbalance - Number(webhookData.amount),
        currentBalance: bank.currentbalance,
        transactionTime: approvedAt,
        processby: "N/A",
        qrimage: bank.qrimage,
        playerusername: user.username,
        playerfullname: user.fullname,
        transactiontype: "deposit",
        amount: Number(webhookData.amount),
      });
      await depositLog.save({ session });
      const message = {
        en: `Deposit of ${usdtAmount} USDT confirmed!`,
        zh: `存款 ${webhookData.amount} USDT 已确认！`,
      };
      const title = {
        en: `Deposit confirmed!`,
        zh: `存款确认！`,
      };
      await session.commitTransaction();
      session.endSession();
      sendNotificationToUser(user._id, message, title);
      console.log(
        `Deposit successful: ${usdtAmount} USDT (${myrAmount} MYR) for user ${user.username}`
      );
      return res
        .status(200)
        .json({ message: "Webhook received and processed successfully" });
    } catch (error) {
      console.error("Error processing webhook:", error);
      await session.abortTransaction();
      session.endSession();
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// app.post("/api/test-send-notification", async (req, res) => {
//   try {
//     const { userId, amount } = req.body;

//     if (!userId || !amount) {
//       return res.status(400).json({
//         success: false,
//         message: {
//           en: "User ID and amount are required",
//           zh: "用户ID和金额是必填项",
//         },
//       });
//     }
//     const message = {
//       en: `Deposit of ${amount} USDT confirmed!`,
//       zh: `存款 ${amount} USDT 已确认！`,
//     };
//     const title = {
//       en: "Deposit confirmed!",
//       zh: "存款确认！",
//     };
//     sendNotificationToUser(userId, message, title);
//     return res.status(200).json({
//       success: true,
//       message: {
//         en: "Notification sent to user",
//         zh: "通知已发送给用户",
//       },
//     });
//   } catch (error) {
//     console.error("Error sending notification:", error);
//     return res.status(500).json({
//       success: false,
//       message: {
//         en: "Failed to send notification",
//         zh: "发送通知失败",
//       },
//       error: error.message,
//     });
//   }
// });

const updateUsdtMyrRate = async () => {
  try {
    const response = await axios.get(
      "https://api.coinpaprika.com/v1/tickers/usdt-tether?quotes=HKD"
    );
    if (
      response.data &&
      response.data.quotes &&
      response.data.quotes.HKD &&
      response.data.quotes.HKD.price
    ) {
      const currentRate = response.data.quotes.HKD.price;
      const buyRate = Math.max(currentRate - 0.05, 0).toFixed(2);
      const sellRate = currentRate.toFixed(2);

      const result = await myrusdtModel.findOneAndUpdate(
        { name: "USDT-MYR" },
        {
          buyrate: buyRate,
          sellrate: sellRate,
          lastUpdate: new Date(),
        },
        { upsert: true, new: true }
      );

      console.log(`USDT-HKD rate updated: buy=${buyRate}, sell=${sellRate}`);
    } else {
      console.error(
        "Unable to fetch USDT-HKD exchange rate data from CoinPaprika API"
      );
    }
  } catch (error) {
    console.error("Error updating USDT-HKD exchange rate:", error.message);
  }
};

cron.schedule("0 12 * * *", updateUsdtMyrRate);

if (process.env.NODE_ENV === "production") {
  updateUsdtMyrRate();
} else {
  console.log(
    "Development environment detected - USDT-HKD rate update is disabled"
  );
}

app.get("/api/usdt-myr-buyrate", async (req, res) => {
  try {
    const rateRecord = await myrusdtModel.findOne({ name: "USDT-MYR" });
    if (!rateRecord) {
      return res.status(404).json({
        success: false,
        message: "Exchange rate not found",
      });
    }

    res.status(200).json({
      success: true,
      buyrate: rateRecord.buyrate,
      sellrate: rateRecord.sellrate,
      lastUpdate: rateRecord.lastUpdate,
    });
  } catch (error) {
    console.error("Error fetching USDT-HKD buy rate:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

mongoose.connect(process.env.MONGODB_URI);

if (process.env.NODE_ENV !== "development") {
  cron.schedule(
    "5 0 * * *",
    async () => {
      try {
        console.log("began proces getallturnover forrebate");
        const response = await axios.post(
          `${process.env.BASE_URL}admin/api/getAllTurnoverForRebate`,
          {
            date: "yesterday",
            pass: process.env.SERVER_SECRET,
          }
        );
        if (response.data.success) {
          console.log("Turnover data fetched successfully:", {
            price: response.data.data,
            time: moment().format("YYYY-MM-DD HH:mm:ss"),
          });
        }
      } catch (error) {
        console.error("Error in getting all turnover:", error.message);
      }
    },
    {
      timezone: "Asia/Shanghai",
    }
  );

  cron.schedule(
    "*/15 * * * *",
    async () => {
      try {
        console.log("Started processing categorized game data for rebate");
        const response = await axios.post(
          `${process.env.BASE_URL}api/all/categorizedgamedata`
        );

        if (response.data.success) {
          console.log("Categorized game data processed successfully:", {
            grandTotalTurnover: response.data.summary.grandTotalTurnover,
            totalPlayersProcessed:
              response.data.summary.processingStats.totalPlayersProcessed,
            successfulUpdates:
              response.data.summary.processingStats.successfulUpdates,
            failedUpdates: response.data.summary.processingStats.failedUpdates,
            time: moment.utc().add(8, "hours").format("YYYY-MM-DD HH:mm:ss"),
          });
        } else {
          console.error(
            "Categorized game data processing failed:",
            response.data
          );
        }
      } catch (error) {
        console.error(
          "Error in processing categorized game data:",
          error.message
        );
      }
    },
    {
      timezone: "Asia/Shanghai",
    }
  );

  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        console.log("Cron job started: Calling reset checkin route...");
        const result = await resetCheckinStreaks();
        if (result.success) {
          console.log("✅ Cron job completed successfully");
        } else {
          console.error("❌ Cron job failed:", result.error);
        }
      } catch (error) {
        console.error("Error executing rebate calculation:", error.message);
      }
    },
    {
      timezone: "Asia/Shanghai", // Set the timezone for the cron job
    }
  );

  cron.schedule(
    "*/10 * * * *",
    async () => {
      try {
        console.log("Cron job started: Processing sports betting data...");

        const wsSportResult = await processWsSportTickets();

        if (wsSportResult.success) {
          console.log(
            `✅ WS Sport tickets processed: ${wsSportResult.stored} stored, ${wsSportResult.skipped} skipped out of ${wsSportResult.total} total`
          );
        } else {
          console.error(
            "❌ Failed to process WS Sport tickets:",
            wsSportResult.error
          );
        }

        const afb1188Result = await processAFB1188Bets();
        if (afb1188Result.success) {
          console.log(
            `✅ AFB1188 bets processed: ${afb1188Result.stored} stored, ${afb1188Result.skipped} skipped, ${afb1188Result.filtered} filtered out of ${afb1188Result.total} total`
          );
        } else {
          console.error(
            "❌ Failed to process AFB1188 bets:",
            afb1188Result.error
          );
        }

        const cmd368Result = await processCMD368Bets();

        if (cmd368Result.success) {
          console.log(
            `✅ CMD368: ${cmd368Result.inserted} inserted, ${cmd368Result.updated} updated, ${cmd368Result.filtered} filtered out of ${cmd368Result.total} total`
          );
        } else {
          console.error("❌ CMD368 failed:", cmd368Result.error);
        }

        const wmResult = await processWMCasinoRecords();

        if (wmResult.success) {
          console.log(
            `✅ WM Casino: ${wmResult.inserted} inserted, ${wmResult.skipped} skipped out of ${wmResult.total} total`
          );
        } else {
          console.error("❌ WM Casino failed:", wmResult.error);
        }

        const afbResult = await processAFBRecords();

        if (afbResult.success) {
          console.log(
            `✅ AFB Live: ${afbResult.inserted} inserted, ${afbResult.skipped} skipped out of ${afbResult.total} total`
          );
        } else {
          console.error("❌ AFB Live failed:", afbResult.error);
        }
      } catch (error) {
        console.error("Error in WS Sport cron job:", error.message);
      }
    },
    {
      timezone: "Asia/Shanghai",
    }
  );
}

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
app.use(smsRouter);
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

app.use(adminListRouter);
app.use(notificationRouter);

app.use(myPromotionRouter);

app.use(slotliveGSCRouter);
app.use(slotlivePPRouter);
app.use(slotCQ9Router);
app.use(slotHabaneroRouter);
app.use(slotlive22Router);
app.use(slotFachaiRouter);
app.use(slotSpadeGamingRouter);
app.use(slotFunkyRouter);
app.use(slotJokerRouter);
app.use(slotKaGamingRouter);
app.use(slotJiliRouter);
app.use(slotJDBRouter);
app.use(slotLiveMicroGamingRouter);
app.use(slotApolloRouter);
app.use(slotClotPlayRouter);
app.use(slotEpicWinRouter);
app.use(slotBNGRouter);
app.use(slotPegasusRouter);
app.use(slotKingMakerRouter);
app.use(slotUUSlotRouter);
app.use(slotPGSlotRouter);
app.use(slotRSGRouter);

app.use(liveYeebetRouter);
app.use(liveEvolutionRouter);
app.use(liveWmCasinoRouter);
app.use(liveWeCasinoRouter);
app.use(liveAFBRouter);
app.use(liveDreamGamingRouter);
app.use(liveSexybcrtRouter);

app.use(otherHorsebookRouter);
app.use(otherVGRouter);

app.use(esportIAGamingRouter);
app.use(esportTFGamingRouter);

app.use(sportCMD368Router);
app.use(sportWssportRouter);
app.use(sportAFB1188Router);
app.use(sportM9BETRouter);

app.use(paymentgatewayEasyPayRouter);
app.use(paymentgatewayLMWPayRouter);

app.use(allImportGameRouter);
app.use(allGameStatus);
app.use(GameFunction);
app.use(gameTurnoverRouter);
app.use(ezwin9GameRouter);

// const modelsToUpdate = [
//   "SportWBETModal",
//   "SportWBETRecordModal",
//   "SportsWsSportModal",
// ];

// const newExpireAfterSeconds = 432000;

// // Route to update all schemas
// const updateExpirationIndexes = async (
//   expirationTime = newExpireAfterSeconds
// ) => {
//   try {
//     for (const modelName of modelsToUpdate) {
//       const model = mongoose.model(modelName);

//       // Drop the existing index to avoid conflicts
//       await model.collection.dropIndex({ createdAt: -1 }).catch((err) => {
//         if (err.code !== 27) {
//           // 27 means the index wasn't found, so it can be ignored
//           console.error(`Error dropping index for ${modelName}:`, err);
//         }
//       });

//       // Recreate the index with updated expiration time
//       await model.collection.createIndex(
//         { createdAt: -1 },
//         { expireAfterSeconds: expirationTime }
//       );

//       console.log(
//         `Index updated for ${modelName} with expiration time: ${expirationTime} seconds.`
//       );
//     }

//     console.log(
//       `✅ Expiration updated to ${expirationTime} seconds for all specified models.`
//     );
//   } catch (error) {
//     console.error("❌ Error updating expiration indexes:", error);
//   }
// };
// updateExpirationIndexes();

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
