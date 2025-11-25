const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const { authenticateToken } = require("../../auth/auth");
const { authenticateAdminToken } = require("../../auth/adminAuth");
const {
  User,
  adminUserWalletLog,
  GameDataLog,
} = require("../../models/users.model");
const { v4: uuidv4 } = require("uuid");
const querystring = require("querystring");
const moment = require("moment");
const { errorMonitor } = require("events");
const SlotKaGamingModal = require("../../models/slot_kagaming.model");
const GameWalletLog = require("../../models/gamewalletlog.model");
const Decimal = require("decimal.js");
require("dotenv").config();

//Staging
const kaGamingPartnerName = "gamingsoft-ezwin9hkd";
const kaGamingCallbackKey = process.env.KAGAMING_CALLBACKSECRET;
const kaGamingSecretKey = process.env.KAGAMING_SECRET;
const webURL = "https://www.ezwin9.com/";
const kagamingAPIURL =
  "https://site-sgp1.1gamehub.com/integrations/gamingsoft-ezwin9hkd/rpc?";
const cashierURL = "https://www.ezwin9.com/deposit";

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

function generateKAGamingHash(params, secretKey) {
  try {
    // Remove hash parameter if it exists (important for verification)
    const filteredParams = { ...params };
    delete filteredParams.hash;

    const sortedKeys = Object.keys(filteredParams).sort();

    // Create payload string by joining sorted parameters
    const payloadParts = [];
    sortedKeys.forEach((key) => {
      const value = filteredParams[key];
      // Handle empty values as empty strings
      const paramValue =
        value !== undefined && value !== null ? value.toString() : "";
      payloadParts.push(`${key}=${paramValue}`);
    });

    const payloadString = payloadParts.join("&");

    const hmac = crypto.createHmac("sha256", secretKey);
    hmac.update(payloadString);
    const hash = hmac.digest("hex");

    return hash;
  } catch (error) {
    console.error("Error generating KA Gaming hash:", error);
    throw error;
  }
}

router.post("/api/kagaming/getgamelist", async (req, res) => {
  try {
    let requestURL = `${kagamingAPIURL}action=available_games&secret=${kaGamingSecretKey}&brands=115`;

    const response = await axios.get(requestURL, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.data.response) {
      console.log(response.data, "error launching ka gaming");
      return res.status(200).json({
        success: false,
        message: {
          en: "KA GAMING: Game launch failed. Please try again or customer service for assistance.",
          zh: "KA GAMING: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "KA GAMING: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "KA GAMING: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "KA GAMING: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }
    const games = response.data.response || [];

    const filteredGames = games.filter((game) => {
      const isSlots = game.categories && game.categories.includes("slots");

      const thumbnail500x500 = game.media?.thumbnails?.[`500x500`];
      const hasPngThumbnail =
        thumbnail500x500 && thumbnail500x500.endsWith(".png");

      return isSlots && hasPngThumbnail;
    });

    const reformattedGamelist = filteredGames.map((game) => ({
      GameCode: game.id,
      GameNameEN: game.name,
      GameType: "Slot",
      GameImage: game.media?.thumbnails?.["500x500"] || "",
      GameImageZH: game.media?.thumbnails?.["500x500"] || "",
      Hot: false,
      RTP: "96.00%",
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.error("KA Gaming API Error:", error);

    return res.status(200).json({
      success: false,
      message: {
        en: "KA GAMING: Game launch failed. Please try again or customer service for assistance.",
        zh: "KA GAMING: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "KA GAMING: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "KA GAMING: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "KA GAMING: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/kagaming/launchGame", authenticateToken, async (req, res) => {
  try {
    const { gameLang, gameCode, isDouble } = req.body;

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

    if (user.gameLock.kagaming.lock) {
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

    let lang = "zh";

    if (gameLang === "en") {
      lang = "en";
    } else if (gameLang === "zh") {
      lang = "zh";
    } else if (gameLang === "zh_hk") {
      lang = "zh";
    } else if (gameLang === "ms") {
      lang = "ms";
    } else if (gameLang === "id") {
      lang = "id";
    }

    let username;
    if (isDouble === true) {
      username = `${user.gameId}2X`;
    } else {
      username = `${user.gameId}`;
    }

    let clientIp = req.headers["x-forwarded-for"] || req.ip;
    clientIp = clientIp.split(",")[0].trim();

    const queryParams = querystring.stringify({
      action: "real_play",
      secret: kaGamingSecretKey,
      game_id: gameCode,
      player_id: username,
      currency: "HKD",
      ip_address: clientIp,
      return_url: webURL,
      deposit_url: cashierURL,
      language: lang,
    });

    const response = await axios.get(`${kagamingAPIURL}${queryParams}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.data.response) {
      console.log(response.data, "error launching ka gaming");
      return res.status(200).json({
        success: false,
        message: {
          en: "KA GAMING: Game launch failed. Please try again or customer service for assistance.",
          zh: "KA GAMING: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "KA GAMING: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "KA GAMING: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "KA GAMING: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const gameName = isDouble === true ? "KA GAMING 2X" : "KA GAMING";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.response.game_url,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.error("KA Gaming launch game error:", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "KA GAMING: Game launch failed. Please try again or customer service for assistance.",
        zh: "KA GAMING: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "KA GAMING: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "KA GAMING: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "KA GAMING: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/kagaming", async (req, res) => {
  try {
    const {
      action,
      player_id,
      currency,
      hash,
      amount,
      freerounds_id,
      transaction_id,
      round_id,
    } = req.query;
    const myhash = generateKAGamingHash(req.query, kaGamingCallbackKey);

    if (hash !== myhash) {
      return res.status(200).json({
        status: 401,
        error: {
          code: "ERR006",
        },
      });
    }

    const isDoubleBetting = player_id.endsWith("2X");
    const actualGameId = isDoubleBetting ? player_id.slice(0, -2) : player_id;

    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { wallet: 1, _id: 1, username: 1, "gameLock.kagaming.lock": 1 }
    ).lean();

    if (!currentUser) {
      return res.status(200).json({
        status: 404,
        error: {
          code: "ERR005",
        },
      });
    }

    switch (action) {
      case "balance":
        if (currency !== "HKD") {
          return res.status(200).json({
            status: 400,
            error: {
              code: "ERR008",
            },
          });
        }

        const balanceDecimal = new Decimal(Number(currentUser.wallet) || 0);
        const finalBalance = isDoubleBetting
          ? balanceDecimal.mul(50).toDecimalPlaces(0).toNumber()
          : balanceDecimal.mul(100).toDecimalPlaces(0).toNumber();

        return res.status(200).json({
          status: 200,
          balance: finalBalance,
          currency: "HKD",
        });

      case "bet":
        // Check if user is locked
        if (currentUser.gameLock?.kagaming?.lock) {
          return res.status(200).json({
            status: 403,
            error: {
              code: "ERR005",
              message: "您已被封鎖，請聯繫客服。",
              display: true,
            },
          });
        }

        // Check for existing transaction
        const existingBetTransaction = await SlotKaGamingModal.findOne(
          { transId: transaction_id },
          { _id: 1, cancel: true }
        ).lean();

        if (existingBetTransaction) {
          if (existingBetTransaction.cancel) {
            return res.status(200).json({
              status: 400,
              error: {
                code: "ERR001",
              },
            });
          }

          const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);
          const finalBalance = isDoubleBetting
            ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
            : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

          return res.status(200).json({
            status: 200,
            balance: finalBalance,
            currency: "HKD",
          });
        }

        const betAmountDecimal = new Decimal(Number(amount) || 0).div(100);

        const actualBetAmount = isDoubleBetting
          ? betAmountDecimal.mul(2)
          : betAmountDecimal;

        let updatedUserAfterBet = currentUser;

        if (!freerounds_id) {
          updatedUserAfterBet = await User.findOneAndUpdate(
            {
              gameId: actualGameId,
              wallet: { $gte: actualBetAmount.toNumber() },
            },
            { $inc: { wallet: -actualBetAmount.toNumber() } },
            { new: true, projection: { wallet: 1, username: 1 } }
          ).lean();

          if (!updatedUserAfterBet) {
            return res.status(200).json({
              status: 400,
              error: { code: "ERR003" },
            });
          }

          await SlotKaGamingModal.create({
            username: player_id,
            transId: transaction_id,
            betId: round_id,
            bet: true,
            betamount: actualBetAmount.toNumber(),
          });
        } else {
          await SlotKaGamingModal.create({
            username: player_id,
            transId: transaction_id,
            betId: round_id,
            bet: true,
            betamount: 0,
          });
        }

        const walletDecimal = new Decimal(
          Number(updatedUserAfterBet.wallet) || 0
        );
        const finalBetBalance = isDoubleBetting
          ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
          : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

        return res.status(200).json({
          status: 200,
          balance: finalBetBalance,
          currency: "HKD",
        });

      case "win":
        const [existingWinTransaction, existingSettledTransaction] =
          await Promise.all([
            SlotKaGamingModal.findOne(
              { betId: round_id },
              { _id: 1, betamount: 1, settle: 1, cancel: 1 }
            ).lean(),
            SlotKaGamingModal.findOne(
              {
                settleId: transaction_id,
                $or: [{ cancel: true }, { settle: true }],
              },
              { _id: 1 }
            ).lean(),
          ]);

        if (!existingWinTransaction) {
          return res.status(200).json({
            status: 400,
            error: {
              code: "ERR001",
            },
          });
        }

        if (existingSettledTransaction) {
          const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);
          const finalBalance = isDoubleBetting
            ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
            : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

          return res.status(200).json({
            status: 200,
            balance: finalBalance,
            currency: "HKD",
          });
        }

        const winAmountDecimal = new Decimal(Number(amount) || 0).div(100);
        const actualWinAmount = isDoubleBetting
          ? winAmountDecimal.mul(2).toNumber()
          : winAmountDecimal.toNumber();

        const updatedBetRecord = await SlotKaGamingModal.findOneAndUpdate(
          { betId: round_id, settle: { $ne: true } },
          {
            settle: true,
            settleamount: actualWinAmount,
            settleId: transaction_id,
          },
          { new: true }
        ).lean();

        if (!updatedBetRecord) {
          await SlotKaGamingModal.create({
            username: player_id,
            betId: round_id,
            settleId: transaction_id,
            settle: true,
            settleamount: actualWinAmount,
            bet: true,
            betamount: 0,
          });
        }

        const updatedUserAfterWin = await User.findOneAndUpdate(
          { gameId: actualGameId },
          { $inc: { wallet: actualWinAmount } },
          { new: true, projection: { wallet: 1 } }
        ).lean();

        const winWalletDecimal = new Decimal(
          Number(updatedUserAfterWin.wallet) || 0
        );
        const winFinalBalance = isDoubleBetting
          ? winWalletDecimal.mul(50).toDecimalPlaces(0).toNumber()
          : winWalletDecimal.mul(100).toDecimalPlaces(0).toNumber();

        return res.status(200).json({
          status: 200,
          balance: winFinalBalance,
          currency: "HKD",
        });

      case "cancel":
        // Find existing transaction
        const existingCancelTransaction = await SlotKaGamingModal.findOne(
          { transId: transaction_id },
          { betamount: 1, cancel: 1, _id: 1 }
        ).lean();

        if (!existingCancelTransaction) {
          await SlotKaGamingModal.create({
            username: player_id,
            betId: round_id,
            transId: transaction_id,
            cancel: true,
          });
        }

        if (!existingCancelTransaction || existingCancelTransaction.cancel) {
          const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);
          const finalBalance = isDoubleBetting
            ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
            : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

          return res.status(200).json({
            status: 200,
            balance: finalBalance,
            currency: "HKD",
          });
        }

        const [updatedUserAfterCancel] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: actualGameId },
            { $inc: { wallet: existingCancelTransaction.betamount || 0 } },
            { new: true, projection: { wallet: 1, username: 1 } }
          ).lean(),
          SlotKaGamingModal.findOneAndUpdate(
            { transId: transaction_id },
            { cancel: true },
            { new: false }
          ),
        ]);

        const cancelWalletDecimal = new Decimal(
          Number(updatedUserAfterCancel.wallet) || 0
        );
        const cancelFinalBalance = isDoubleBetting
          ? cancelWalletDecimal.mul(50).toDecimalPlaces(0).toNumber()
          : cancelWalletDecimal.mul(100).toDecimalPlaces(0).toNumber();

        return res.status(200).json({
          status: 200,
          balance: cancelFinalBalance,
          currency: "HKD",
        });

      default:
        return res.status(200).json({
          status: 400,
          error: { code: "ERR009" }, // Unknown action
        });
    }
  } catch (error) {
    console.error("Ka gaming: Error in game provider calling api:", error);
    return res.status(200).json({
      status: 500,
      error: {
        code: "ERR001",
      },
    });
  }
});

router.post("/api/kagaming/getturnoverforrebate", async (req, res) => {
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

    console.log("KA GAMING QUERYING TIME", startDate, endDate);

    const records = await SlotKaGamingModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      cancel: { $ne: true },
      username: { $not: /2X$/ },
      settle: true,
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

      if (!actualUsername) {
        console.warn(`KA GAMING  User not found for gameId: ${gameId}`);
        return;
      }

      if (!playerSummary[actualUsername]) {
        playerSummary[actualUsername] = { turnover: 0, winloss: 0 };
      }

      playerSummary[actualUsername].turnover += record.betamount || 0;

      playerSummary[actualUsername].winloss +=
        (record.settleamount || 0) - (record.betamount || 0);
    });
    // Format the turnover and win/loss for each player to two decimal places
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
        gamename: "KA GAMING",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("KA GAMING: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "KA GAMING: Failed to fetch win/loss report",
        zh: "KA GAMING: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/kagaming2x/getturnoverforrebate", async (req, res) => {
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

    console.log("KA GAMING QUERYING TIME", startDate, endDate);

    const records = await SlotKaGamingModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      cancel: { $ne: true },
      username: /2X$/,
      settle: true,
    });

    const uniqueGameIds = [
      ...new Set(records.map((record) => record.username.slice(0, -2))),
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
      const gameId = record.username.slice(0, -2);
      const actualUsername = gameIdToUsername[gameId];

      if (!actualUsername) {
        console.warn(`KA GAMING2x User not found for gameId: ${gameId}`);
        return;
      }

      if (!playerSummary[actualUsername]) {
        playerSummary[actualUsername] = { turnover: 0, winloss: 0 };
      }

      playerSummary[actualUsername].turnover += record.betamount || 0;

      playerSummary[actualUsername].winloss +=
        (record.settleamount || 0) - (record.betamount || 0);
    });
    // Format the turnover and win/loss for each player to two decimal places
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
        gamename: "KA GAMING2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("KA GAMING: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "KA GAMING: Failed to fetch win/loss report",
        zh: "KA GAMING: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/kagaming/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotKaGamingModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },

        settle: true,
      });

      // Aggregate turnover and win/loss for each player
      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;
        totalWinLoss += (record.settleamount || 0) - (record.betamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));
      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KA GAMING: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kagaming2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotKaGamingModal.find({
        username: `${user.gameId}2X`,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },

        settle: true,
      });

      // Aggregate turnover and win/loss for each player
      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;
        totalWinLoss += (record.settleamount || 0) - (record.betamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));
      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KA GAMING: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kagaming/:userId/gamedata",
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

      // Sum up the values for EVOLUTION under Live Casino
      records.forEach((record) => {
        // Convert Mongoose Map to Plain Object
        const gameCategories =
          record.gameCategories instanceof Map
            ? Object.fromEntries(record.gameCategories)
            : record.gameCategories;

        if (
          gameCategories &&
          gameCategories["Slot Games"] &&
          gameCategories["Slot Games"] instanceof Map
        ) {
          const slotGames = Object.fromEntries(gameCategories["Slot Games"]);

          if (slotGames["KA GAMING"]) {
            totalTurnover += slotGames["KA GAMING"].turnover || 0;
            totalWinLoss += slotGames["KA GAMING"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KA GAMING: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kagaming2x/:userId/gamedata",
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

      // Sum up the values for EVOLUTION under Live Casino
      records.forEach((record) => {
        // Convert Mongoose Map to Plain Object
        const gameCategories =
          record.gameCategories instanceof Map
            ? Object.fromEntries(record.gameCategories)
            : record.gameCategories;

        if (
          gameCategories &&
          gameCategories["Slot Games"] &&
          gameCategories["Slot Games"] instanceof Map
        ) {
          const slotGames = Object.fromEntries(gameCategories["Slot Games"]);

          if (slotGames["KA GAMING2X"]) {
            totalTurnover += slotGames["KA GAMING2X"].turnover || 0;
            totalWinLoss += slotGames["KA GAMING2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KA GAMING: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kagaming/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotKaGamingModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },
        username: { $not: /2X$/ },
        settle: true,
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss += (record.betamount || 0) - (record.settleamount || 0);
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KA GAMING: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kagaming2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotKaGamingModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },
        username: /2X$/,
        settle: true,
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss += (record.betamount || 0) - (record.settleamount || 0);
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KA GAMING: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kagaming/kioskreport",
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
          gameCategories["Slot Games"] &&
          gameCategories["Slot Games"] instanceof Map
        ) {
          const liveCasino = Object.fromEntries(gameCategories["Slot Games"]);

          if (liveCasino["KA GAMING"]) {
            totalTurnover += Number(liveCasino["KA GAMING"].turnover || 0);
            totalWinLoss += Number(liveCasino["KA GAMING"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KA GAMING: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kagaming2x/kioskreport",
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
          gameCategories["Slot Games"] &&
          gameCategories["Slot Games"] instanceof Map
        ) {
          const liveCasino = Object.fromEntries(gameCategories["Slot Games"]);

          if (liveCasino["KA GAMING2X"]) {
            totalTurnover += Number(liveCasino["KA GAMING2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["KA GAMING2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KA GAMING2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KA GAMING: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KA GAMING: Failed to fetch win/loss report",
          zh: "KA GAMING: 获取盈亏报告失败",
        },
      });
    }
  }
);

module.exports = router;
