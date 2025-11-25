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
const OtherVGModal = require("../../models/other_vg.model");
require("dotenv").config();

const webURL = "https://www.ezwin9.com/";
const vgCaishenAPIURL = "https://game.91vipgames.com/ChannelApi";
const vgCaishenCode = "SWHK";
const vgCaishenSecret = process.env.VGCAISHEN_SECRET;
const vgPartnerID = "UAT_VG_393";
const vgCaishenCallbackSecret = process.env.VGCAISHEN_CALLBACKSECRET;
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

async function getVGToken() {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const verifycode = crypto
      .createHash("md5")
      .update(`${vgCaishenCode}${timestamp}${vgCaishenSecret}`)
      .digest("hex")
      .toUpperCase();

    const response = await axios.get(`${vgCaishenAPIURL}/Security/GetToken`, {
      params: {
        channel: vgCaishenCode,
        timestamp: timestamp,
        verifycode: verifycode,
      },
    });

    if (response.data.state === 0) {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.response.data,
    };
  }
}

async function registerVGUser(user, apitoken) {
  try {
    const response = await axios.get(
      `${vgCaishenAPIURL}/API/${vgCaishenCode}/CreateUser`,
      {
        params: {
          username: user.gameId,
          channel: vgCaishenCode,
          agent: "EZWIN9",
        },
        headers: {
          apitoken: apitoken,
        },
      }
    );
    if (response.data.state === 0) {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.response.data,
    };
  }
}

function generateVGSignature(params, apiKey) {
  const filteredParams = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (
      key !== "sign" &&
      value !== "" &&
      value !== null &&
      value !== undefined
    ) {
      filteredParams[key] = String(value);
    }
  });

  const sortedKeys = Object.keys(filteredParams).sort();

  const stringA = sortedKeys
    .map((key) => `${key}=${filteredParams[key]}`)
    .join("&");

  const stringSignTemp = stringA + "&key=" + apiKey;

  const signature = crypto
    .createHash("md5")
    .update(stringSignTemp)
    .digest("hex")
    .toUpperCase();

  return signature;
}

router.post("/api/vgqipai/launchGame", authenticateToken, async (req, res) => {
  try {
    const { gameLang } = req.body;
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

    if (user.gameLock?.vgqipai?.lock) {
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

    const vgToken = await getVGToken();

    if (!vgToken.success) {
      console.log("VG: GET TOKEN FAILED", vgToken);
      return res.status(200).json({
        success: false,
        message: {
          en: "VG: Game launch failed. Please try again or customer service for assistance.",
          zh: "VG: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "VG: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "VG: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "VG: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    if (!user.vgRegistered) {
      const registeredData = await registerVGUser(user, vgToken.data.value);

      if (!registeredData.success) {
        console.log(`VG error in registering account ${registeredData}`);

        return res.status(200).json({
          success: false,
          message: {
            en: "VG: Game launch failed. Please try again or customer service for assistance.",
            zh: "VG: 游戏启动失败，请重试或联系客服以获得帮助。",
            ms: "VG: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "VG: 遊戲開唔到，老闆試多次或者搵客服幫手。",
            id: "VG: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      await User.findOneAndUpdate(
        { username: user.username },
        {
          $set: {
            vgRegistered: true,
          },
        }
      );
    }
    let lang = 2;

    if (gameLang === "en") {
      lang = 3;
    } else if (gameLang === "zh") {
      lang = 1;
    } else if (gameLang === "ms") {
      lang = 3;
    } else if (gameLang === "id") {
      lang = 3;
    } else if (gameLang === "zh_hk") {
      lang = 2;
    }

    const response = await axios.get(
      `${vgCaishenAPIURL}/API/${vgCaishenCode}/LoginWithChannel`,
      {
        params: {
          username: user.gameId,
          channel: vgCaishenCode,
          gametype: 1000,
          Language: lang,
        },
        headers: {
          apitoken: vgToken.data.value,
        },
      }
    );
    if (response.data.state !== 0) {
      return res.status(200).json({
        success: false,
        message: {
          en: "VG: Game launch failed. Please try again or customer service for assistance.",
          zh: "VG: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "VG: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "VG: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "VG: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "VG"
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.value,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.error("VG login error:", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "VG: Game launch failed. Please try again or customer service for assistance.",
        zh: "VG: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "VG: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "VG: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "VG: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/vgcaishen/getbalance", async (req, res) => {
  try {
    const { username, partnerId, nonce_str, sign } = req.body;
    if (
      !username ||
      !partnerId ||
      !nonce_str ||
      !sign ||
      partnerId !== vgPartnerID
    ) {
      console.log("failed");
      return res.status(200).json({
        state: 2,
        message: "Missing required parameters",
        data: {
          username: username || "",
          balance: "0",
          walletTime: new Date().toISOString(),
        },
      });
    }

    const expectedSignature = generateVGSignature(
      req.body,
      vgCaishenCallbackSecret
    );

    if (sign !== expectedSignature) {
      console.error("VG Caishen: Invalid signature received");

      return res.status(200).json({
        state: 108,
        message: "Invalid signature",
        data: {
          username: username,
          balance: "0",
          walletTime: new Date().toISOString(),
        },
      });
    }

    const currentUser = await User.findOne(
      { gameId: username },
      { wallet: 1, _id: 1 }
    ).lean();

    if (!currentUser) {
      console.log("GetBalance not login");
      return res.status(200).json({
        state: 2,
        message: "User not found",
        data: {
          username: username || "",
          balance: "0",
          walletTime: new Date().toISOString(),
        },
      });
    }
    return res.status(200).json({
      state: 0,
      message: "OK",
      data: {
        username: username,
        balance: roundToTwoDecimals(currentUser.wallet).toString(),
        walletTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "VG: Error in game provider calling ae96 get balance api:",
      error.message
    );
    return res.status(200).json({
      state: 2,
      message: "System error",
      data: {
        username: "",
        balance: "0",
        walletTime: new Date().toISOString(),
      },
    });
  }
});

router.post("/api/vgcaishen/bet", async (req, res) => {
  try {
    const {
      username,
      partnerId,
      nonce_str,
      sign,
      betId,
      betAmount,
      game_code,
      time,
    } = req.body;
    if (
      !username ||
      !partnerId ||
      !nonce_str ||
      !sign ||
      !betId ||
      betAmount == null ||
      !game_code ||
      !time ||
      partnerId !== vgPartnerID
    ) {
      return res.status(200).json({
        state: 2,
        message: "Missing required parameters",
        data: {
          username: username || "",
          balance: "0",
          walletTime: new Date().toISOString(),
        },
      });
    }

    const expectedSignature = generateVGSignature(
      req.body,
      vgCaishenCallbackSecret
    );

    if (sign !== expectedSignature) {
      console.error("VG Caishen: Invalid signature received");

      return res.status(200).json({
        state: 108,
        message: "Invalid signature",
        data: {
          username: username,
          balance: "0",
          walletTime: new Date().toISOString(),
        },
      });
    }

    const [currentUser, existingBet] = await Promise.all([
      User.findOne(
        { gameId: username },
        {
          wallet: 1,
          "gameLock.vgqipai.lock": 1,
          _id: 1,
        }
      ).lean(),
      OtherVGModal.findOne({ betId: betId }, { _id: 1 }).lean(),
    ]);

    if (!currentUser) {
      console.log("bet not login");
      return res.status(200).json({
        state: 2,
        message: "User not found",
        data: {
          username: username || "",
          balance: "0",
          walletTime: new Date().toISOString(),
        },
      });
    }

    if (currentUser.gameLock?.vgqipai?.lock) {
      return res.status(200).json({
        state: 2,
        message: "Player banned",
        data: {
          username: username,
          balance: roundToTwoDecimals(currentUser.wallet).toString(),
          walletTime: new Date().toISOString(),
        },
      });
    }

    if (existingBet) {
      return res.status(200).json({
        state: 0,
        message: "OK",
        data: {
          username: username,
          balance: roundToTwoDecimals(currentUser.wallet).toString(),
          walletTime: new Date().toISOString(),
        },
      });
    }

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: roundToTwoDecimals(betAmount) },
      },
      { $inc: { wallet: -roundToTwoDecimals(betAmount) } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        state: 2821,
        message: "Insufficient balance",
        data: {
          username: username,
          balance: roundToTwoDecimals(currentUser.wallet).toString(),
          walletTime: new Date().toISOString(),
        },
      });
    }

    await OtherVGModal.create({
      username: username,
      betId: betId,
      bet: true,
      depositamount: roundToTwoDecimals(betAmount),
    });

    return res.status(200).json({
      state: 0,
      message: "OK",
      data: {
        username: username,
        balance: roundToTwoDecimals(updatedUserBalance.wallet).toString(),
        walletTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "VG: Error in game provider calling ae96 get bet api:",
      error.message
    );
    return res.status(200).json({
      state: 2,
      message: "System error",
      data: {
        username: "",
        balance: "0",
        walletTime: new Date().toISOString(),
      },
    });
  }
});

router.post("/api/vgcaishen/settle", async (req, res) => {
  try {
    const {
      username,
      partnerId,
      nonce_str,
      sign,
      betId,
      winloseAmount,
      game_code,
      time,
      betAmount,
      vaildAmount,
    } = req.body;

    if (
      !username ||
      !partnerId ||
      !nonce_str ||
      !sign ||
      !betId ||
      winloseAmount == null ||
      vaildAmount == null ||
      betAmount == null ||
      !game_code ||
      !time ||
      partnerId !== vgPartnerID
    ) {
      return res.status(200).json({
        state: 2,
        message: "Missing required parameters",
        data: {
          betId: betId || "",
          balance: "0",
          msg: "该注单结算失败",
          walletTime: new Date().toISOString(),
        },
      });
    }

    const expectedSignature = generateVGSignature(
      req.body,
      vgCaishenCallbackSecret
    );

    if (sign !== expectedSignature) {
      console.error("VG Caishen: Invalid signature received");

      return res.status(200).json({
        state: 108,
        message: "Invalid signature",
        data: {
          betId: betId,
          balance: "0",
          msg: "该注单结算失败",
          walletTime: new Date().toISOString(),
        },
      });
    }

    const originalBetId = betId.startsWith("RI")
      ? betId.replace("RI", "RO")
      : betId;

    const [currentUser, existingBet, existingTransaction] = await Promise.all([
      User.findOne({ gameId: username }, { wallet: 1, _id: 1 }).lean(),
      OtherVGModal.findOne(
        { betId: originalBetId, bet: true },
        { _id: 1 }
      ).lean(),
      OtherVGModal.findOne(
        { betId: originalBetId, $or: [{ settle: true }, { cancel: true }] },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      console.log("settle not login");
      return res.status(200).json({
        state: 2,
        message: "User not found",
        data: {
          betId: betId,
          balance: "0",
          msg: "该注单结算失败",
          walletTime: new Date().toISOString(),
        },
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        state: 2,
        message: "No bet found",
        data: {
          betId: betId,
          balance: roundToTwoDecimals(currentUser.wallet).toString(),
          msg: "该注单结算失败",
          walletTime: new Date().toISOString(),
        },
      });
    }

    if (existingTransaction) {
      return res.status(200).json({
        state: 0,
        message: "OK",
        data: {
          betId: betId,
          balance: roundToTwoDecimals(currentUser.wallet).toString(),
          msg: "该注单结算成功",
          walletTime: new Date().toISOString(),
        },
      });
    }

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: roundToTwoDecimals(winloseAmount) } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      OtherVGModal.findOneAndUpdate(
        { betId: originalBetId },
        {
          $set: {
            settle: true,
            withdrawamount: roundToTwoDecimals(winloseAmount),
            betamount: roundToTwoDecimals(vaildAmount),
          },
        },
        { upsert: true }
      ),
    ]);

    return res.status(200).json({
      state: 0,
      message: "OK",
      data: {
        betId: betId,
        balance: roundToTwoDecimals(updatedUserBalance.wallet).toString(),
        msg: "该注单结算成功",
        walletTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "VG: Error in game provider calling ae96 get game result api:",
      error.message
    );
    return res.status(200).json({
      state: 2,
      message: "System error",
      data: {
        username: "",
        balance: "0",
        walletTime: new Date().toISOString(),
      },
    });
  }
});

router.post("/api/vgqipai/getturnoverforrebate", async (req, res) => {
  try {
    const { date } = req.body;

    let startDate, endDate;
    if (date === "today") {
      startDate = moment
        .utc()
        .add(8, "hours")
        .startOf("day")
        .subtract(8, "hours")
        .toDate();
      endDate = moment
        .utc()
        .add(8, "hours")
        .endOf("day")
        .subtract(8, "hours")
        .toDate();
    } else if (date === "yesterday") {
      startDate = moment
        .utc()
        .add(8, "hours")
        .subtract(1, "days")
        .startOf("day")
        .subtract(8, "hours")
        .toDate();

      endDate = moment
        .utc()
        .add(8, "hours")
        .subtract(1, "days")
        .endOf("day")
        .subtract(8, "hours")
        .toDate();
    }

    console.log("VG QUERYING TIME", startDate, endDate);

    const records = await OtherVGModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      settle: true,
      cancel: { $ne: true },
    });

    const uniqueGameIds = [
      ...new Set(records.map((record) => record.username)),
    ];

    const users = await User.find(
      { gameId: { $in: uniqueGameIds } },
      { gameId: 1, username: 1 }
    ).lean();

    const gameIdToUsername = {};
    users.forEach((user) => {
      gameIdToUsername[user.gameId] = user.username;
    });

    let playerSummary = {};

    records.forEach((record) => {
      const gameId = record.username;
      const actualUsername = gameIdToUsername[gameId];

      if (!playerSummary[actualUsername]) {
        playerSummary[actualUsername] = { turnover: 0, winloss: 0 };
      }

      playerSummary[actualUsername].turnover += record.betamount || 0;

      playerSummary[actualUsername].winloss +=
        (record.withdrawamount || 0) - (record.depositamount || 0);
    });

    Object.keys(playerSummary).forEach((playerId) => {
      playerSummary[playerId].turnover = Number(
        playerSummary[playerId].turnover.toFixed(2)
      );
      playerSummary[playerId].winloss = Number(
        playerSummary[playerId].winloss.toFixed(2)
      );
    });
    // Return the aggregated results
    return res.status(200).json({
      success: true,
      summary: {
        gamename: "VG QIPAI",
        gamecategory: "Poker",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("VG QIPAI: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      error: "VG QIPAI: Failed to fetch win/loss report",
    });
  }
});

router.get(
  "/admin/api/vgqipai/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await OtherVGModal.find({
        username: user.gameId,
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        settle: true,
        cancel: { $ne: true },
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss +=
          (record.withdrawamount || 0) - (record.depositamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "VG QIPAI",
          gamecategory: "Poker",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("VG QIPAI: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "VG QIPAI: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/vgqipai/:userId/gamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await GameDataLog.find({
        username: user.username,
        date: {
          $gte: moment(new Date(startDate))
            .utc()
            .add(8, "hours")
            .format("YYYY-MM-DD"),
          $lte: moment(new Date(endDate))
            .utc()
            .add(8, "hours")
            .format("YYYY-MM-DD"),
        },
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        const gameCategories =
          record.gameCategories instanceof Map
            ? Object.fromEntries(record.gameCategories)
            : record.gameCategories;

        if (
          gameCategories &&
          gameCategories["Poker"] &&
          gameCategories["Poker"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Poker"]);

          if (gamecat["VG QIPAI"]) {
            totalTurnover += gamecat["VG QIPAI"].turnover || 0;
            totalWinLoss += gamecat["VG QIPAI"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "VG QIPAI",
          gamecategory: "Poker",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("VG QIPAI: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "VG QIPAI: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/vgqipai/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await OtherVGModal.find({
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        settle: true,
        cancel: { $ne: true },
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss +=
          (record.depositamount || 0) - (record.withdrawamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "VG QIPAI",
          gamecategory: "Poker",
          totalturnover: totalTurnover,
          totalwinloss: totalWinLoss,
        },
      });
    } catch (error) {
      console.log("VG QIPAI: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "VG QIPAI: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/vgqipai/kioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await GameDataLog.find({
        date: {
          $gte: moment(new Date(startDate))
            .utc()
            .add(8, "hours")
            .format("YYYY-MM-DD"),
          $lte: moment(new Date(endDate))
            .utc()
            .add(8, "hours")
            .format("YYYY-MM-DD"),
        },
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        const gameCategories =
          record.gameCategories instanceof Map
            ? Object.fromEntries(record.gameCategories)
            : record.gameCategories;

        if (
          gameCategories &&
          gameCategories["Poker"] &&
          gameCategories["Poker"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Poker"]);

          if (gamecat["VG QIPAI"]) {
            totalTurnover += Number(gamecat["VG QIPAI"].turnover || 0);
            totalWinLoss += Number(gamecat["VG QIPAI"].winloss || 0);
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "VG QIPAI",
          gamecategory: "Poker",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("VG QIPAI: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "VG QIPAI: Failed to fetch win/loss report",
      });
    }
  }
);
module.exports = router;
