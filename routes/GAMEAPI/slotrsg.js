const express = require("express");
const router = express.Router();
const axios = require("axios");
const moment = require("moment");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
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
const SportM9BetModal = require("../../models/sport_m9bet.model");
require("dotenv").config();

const webURL = "https://www.ezwin9.com/";
const rsgAPIURL = "http://tsezwin9hkd-api.royalgaming777.com/SingleWallet";
const rsgAccount = "24aj5plurnh5";
const rsgSecret = process.env.RSG_SECRET;
const rsgDesKey = process.env.RSG_DESKEY;
const rsgDesIV = process.env.RSG_DESIV;
const rsgSystemCode = "EZWIN9HKD";

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

function encryptDES(data, key, iv) {
  const keyHex = CryptoJS.enc.Utf8.parse(key);
  const ivHex = CryptoJS.enc.Utf8.parse(iv);

  const encrypted = CryptoJS.DES.encrypt(data, keyHex, {
    iv: ivHex,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return encrypted.toString();
}

function decryptDES(encryptedData, key, iv) {
  const keyHex = CryptoJS.enc.Utf8.parse(key);
  const ivHex = CryptoJS.enc.Utf8.parse(iv);

  const decrypted = CryptoJS.DES.decrypt(encryptedData, keyHex, {
    iv: ivHex,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}

// Generate MD5 Signature
function generateMD5Signature(
  clientId,
  clientSecret,
  timestamp,
  encryptedData
) {
  const signatureString = `${clientId}${clientSecret}${timestamp}${encryptedData}`;
  return crypto.createHash("md5").update(signatureString).digest("hex");
}

async function registerRSGUser(user) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    const payload = {
      SystemCode: rsgSystemCode,
      WebId: "EZWIN9",
      UserId: "test",
      Currency: "HK",
    };

    const jsonData = JSON.stringify(payload);

    const encryptedData = encryptDES(jsonData, rsgDesKey, rsgDesIV);

    const signature = generateMD5Signature(
      rsgAccount,
      rsgSecret,
      timestamp,
      encryptedData
    );

    const response = await axios.post(
      `${rsgAPIURL}/Player/CreatePlayer`,
      `Msg=${encryptedData}`, // Body format: Msg=encryptedData (no quotes)
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-ClientID": rsgAccount,
          "X-API-Signature": signature,
          "X-API-Timestamp": timestamp.toString(),
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );
    const decryptedResponse = decryptDES(response.data, rsgDesKey, rsgDesIV);
    console.log("Decrypted Response:", decryptedResponse);

    const responseData = JSON.parse(decryptedResponse);
    console.log(responseData, "hi");
    if (response.data.errcode !== 0) {
      if (response.data.errcode === -1) {
        return {
          success: false,
          error: response.data.errtext,
          maintenance: true,
        };
      }

      return {
        success: false,
        error: response.data.errtext,
        maintenance: false,
      };
    }
    return {
      success: true,
      data: response.data,
      maintenance: false,
    };
  } catch (error) {
    console.log(error, "error registering rsg");
    return {
      success: false,
      error: error.response.data,
      maintenance: false,
    };
  }
}

router.post("/api/rsg/launchGame", authenticateToken, async (req, res) => {
  try {
    const { gameLang, clientPlatform } = req.body;
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(200).json({
        success: false,
        message: {
          en: "User not found. Please try again or contact customer service for assistance.",
          zh: "用户未找到，请重试或联系客服以获取帮助。",
          ms: "Pengguna tidak ditemui, sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "搵唔到用戶，麻煩再試多次或者聯絡客服幫手。",
          id: "Pengguna tidak ditemukan. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    if (user.gameLock?.m9bet?.lock) {
      return res.status(200).json({
        success: false,
        message: {
          en: "Your game access has been locked. Please contact customer support for further assistance.",
          zh: "您的游戏访问已被锁定，请联系客服以获取进一步帮助。",
          ms: "Akses permainan anda telah dikunci. Sila hubungi khidmat pelanggan untuk bantuan lanjut.",
          zh_hk: "老闆你嘅遊戲訪問已經被鎖定咗，麻煩聯絡客服獲取進一步幫助。",
          id: "Akses permainan Anda telah dikunci. Silakan hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
        },
      });
    }
    const registeredData = await registerRSGUser(user);

    return;
    if (!user.m9betRegistered) {
      const registeredData = await registerM9BetUser(user);

      if (!registeredData.success) {
        console.log(`M9BET error in registering account ${registeredData}`);

        if (registeredData.maintenance) {
          return res.status(200).json({
            success: false,
            message: {
              en: "Game under maintenance. Please try again later.",
              zh: "游戏正在维护中，请稍后再试。",
              ms: "Permainan sedang diselenggara, sila cuba lagi nanti.",
              zh_hk: "遊戲而家維護緊，老闆遲啲再試下。",
              id: "Permainan sedang dalam pemeliharaan. Silakan coba lagi nanti.",
            },
          });
        }

        return res.status(200).json({
          success: false,
          message: {
            en: "M9BET: Game launch failed. Please try again or customer service for assistance.",
            zh: "M9BET: 游戏启动失败，请重试或联系客服以获得帮助。",
            ms: "M9BET: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "M9BET: 遊戲開唔到，老闆試多次或者搵客服幫手。",
            id: "M9BET: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      await User.findOneAndUpdate(
        { username: user.username },
        {
          $set: {
            m9betRegistered: true,
          },
        }
      );
    }

    let lang = "ZH-CN";

    if (gameLang === "en") {
      lang = "EN-US";
    } else if (gameLang === "zh") {
      lang = "ZH-CN";
    } else if (gameLang === "ms") {
      lang = "EN-US";
    } else if (gameLang === "id") {
      lang = "ID-ID";
    } else if (gameLang === "zh_hk") {
      lang = "ZH-CN";
    }

    const params = new URLSearchParams({
      action: "login",
      secret: m9betSecret,
      agent: m9betAccount,
      username: user.gameId,
      lang: lang,
      accType: "HK",
      timezoneid: "29",
      ref: webURL,
    });

    const response = await axios.post(
      `${m9betAPIURL}/apijs.aspx?${params.toString()}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (response.data.errcode !== 0) {
      if (response.data.errcode === -1) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Game under maintenance. Please try again later.",
            zh: "游戏正在维护中，请稍后再试。",
            ms: "Permainan sedang diselenggara, sila cuba lagi nanti.",
            zh_hk: "遊戲而家維護緊，老闆遲啲再試下。",
            id: "Permainan sedang dalam pemeliharaan. Silakan coba lagi nanti.",
          },
        });
      }

      return res.status(200).json({
        success: false,
        message: {
          en: "M9BET: Game launch failed. Please try again or customer service for assistance.",
          zh: "M9BET: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "M9BET: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "M9BET: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "M9BET: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "M9BET"
    );

    let platform = response.data.result.login.weburl;
    if (clientPlatform === "web") {
      platform = response.data.result.login.weburl;
    } else if (clientPlatform === "mobile") {
      platform = response.data.result.login.mobiurl;
    }

    return res.status(200).json({
      success: true,
      gameLobby: platform,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.error("M9BET login error:", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "M9BET: Game launch failed. Please try again or customer service for assistance.",
        zh: "M9BET: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "M9BET: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "M9BET: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "M9BET: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

module.exports = router;
