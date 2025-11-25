const express = require("express");
const router = express.Router();
const axios = require("axios");
const moment = require("moment");
const crypto = require("crypto");
const { authenticateToken } = require("../../auth/auth");
const { authenticateAdminToken } = require("../../auth/adminAuth");
const {
  User,
  adminUserWalletLog,
  GameDataLog,
} = require("../../models/users.model");
const { adminUser, adminLog } = require("../../models/adminuser.model");
const GameWalletLog = require("../../models/gamewalletlog.model");
const Decimal = require("decimal.js");
const LiveEvolutionModal = require("../../models/live_evolution.model");

require("dotenv").config();

const webURL = "https://www.ezwin9.com/";
const dreamGamingAPIURL = "https://api.dg99api.com";
const dreamGamingOperator = "DG0116340R";
const dreamGamingSecret = process.env.DREAMGAMING_SECRET;

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

async function GameWalletLogAttempt(
  username,
  transactiontype,
  remark,
  amount,
  gamename
) {
  await GameWalletLog.create({
    username,
    transactiontype,
    remark: remark || "",
    amount,
    gamename: gamename,
  });
}

function generateDreamGamingToken(random) {
  const tokenString = `${dreamGamingOperator}${dreamGamingSecret}${random}`;
  return crypto.createHash("md5").update(tokenString).digest("hex");
}

router.post(
  "/api/dreamgaming/launchGame",
  authenticateToken,
  async (req, res) => {
    try {
      const { gameLang = "zh", tableId, showApp = true, area } = req.body;
      const userId = req.user.userId;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(200).json({
          success: false,
          message: {
            en: "User not found. Please try again or contact customer service for assistance.",
            zh: "用户未找到，请重试或联系客服以获取帮助。",
            ms: "Pengguna tidak ditemui, sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "用戶未找到，請重試或聯絡客服以獲取幫助。",
            id: "Pengguna tidak ditemukan. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      if (user.gameLock?.dreamgaming?.lock) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Your game access has been locked. Please contact customer support for further assistance.",
            zh: "您的游戏访问已被锁定，请联系客服以获取进一步帮助。",
            ms: "Akses permainan anda telah dikunci. Sila hubungi khidmat pelanggan untuk bantuan lanjut.",
            zh_hk: "您的遊戲訪問已被鎖定，請聯絡客服以獲取進一步幫助。",
            id: "Akses permainan Anda telah dikunci. Silakan hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
          },
        });
      }

      // Generate random string
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let random = "";
      for (let i = 0; i < 8; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const token = generateDreamGamingToken(random);
      const dgUsername = `${dreamGamingOperator}_${user.gameId}`;

      const requestData = {
        token: token,
        random: random,
        member: {
          username: dgUsername,
        },
        limit: {
          min: 10,
          max: 10000,
        },
      };
      console.log(requestData);
      console.log(`${dreamGamingAPIURL}/user/login/${dreamGamingOperator}`);

      const response = await axios.post(
        `${dreamGamingAPIURL}/user/login/${dreamGamingOperator}`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log(response.data);
    } catch (error) {
      console.error("Dream Gaming login error:", error);
      return res.status(200).json({
        success: false,
        message: {
          en: "Dream Gaming login failed. Please try again or contact customer service.",
          zh: "Dream Gaming登录失败，请重试或联系客服。",
          ms: "Log masuk Dream Gaming gagal. Sila cuba lagi atau hubungi khidmat pelanggan.",
          zh_hk: "Dream Gaming登錄失敗，請重試或聯絡客服。",
          id: "Login Dream Gaming gagal. Silakan coba lagi atau hubungi layanan pelanggan.",
        },
      });
    }
  }
);
module.exports = router;
