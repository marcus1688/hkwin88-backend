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
const evolutionAPIURL = "https://babylonkzmaster.evo-games.com";
const evolutionToken = "376487569d78385cc157959db21df1a2d706d3da";
const evolutionCasinoID = "subinfiin8000001";

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

function generateSignature(params, secretKey) {
  // Remove null/undefined/empty values
  const filtered = Object.entries(params).filter(
    ([_, v]) => v !== undefined && v !== ""
  );

  const sorted = filtered.sort(([a], [b]) => a.localeCompare(b));

  const paramString = sorted.map(([k, v]) => `${k}=${v}`).join("&");

  const finalString = `${paramString}&key=${secretKey}`;
  console.log(finalString);
  return crypto.createHash("md5").update(finalString).digest("hex");
}

router.post(
  "/api/evolution/launchGame",
  authenticateToken,
  async (req, res) => {
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

      if (user.gameLock?.evolution?.lock) {
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

      const sessionId = `${user.gameId}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const requestUuid = `req_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      let clientIp = req.headers["x-forwarded-for"] || req.ip;
      clientIp = clientIp.split(",")[0].trim();

      let lang = "zh-Hant";

      if (gameLang === "en") {
        lang = "en-US";
      } else if (gameLang === "zh") {
        lang = "zh-Hans";
      } else if (gameLang === "zh_hk") {
        lang = "zh-Hant";
      } else if (gameLang === "ms") {
        lang = "ms";
      } else if (gameLang === "id") {
        lang = "id";
      }

      const requestBody = {
        uuid: requestUuid,
        player: {
          id: user.gameId,
          update: true,
          nickname: user.username,
          language: lang,
          currency: "HKD",
          session: {
            id: sessionId,
            ip: clientIp,
          },
        },
        config: {
          brand: {
            id: "1",
            skin: "1",
          },
          urls: {
            cashier: `${webURL}deposit`,
            lobby: `${webURL}`,
            sessionTimeout: `${webURL}`,
          },
        },
      };
      const MAX_TOKENS = 3;

      // ✅ Convert Mongoose Map to plain object
      const currentTokens = user.evolutionGameTokens?.toObject
        ? user.evolutionGameTokens.toObject()
        : user.evolutionGameTokens || {};

      // If it's still a Map, convert it
      const plainTokens =
        currentTokens instanceof Map
          ? Object.fromEntries(currentTokens)
          : currentTokens;

      const tokenArray = Object.entries(plainTokens)
        .map(([key, value]) => ({
          key,
          value,
          timestamp: key.includes("session_") ? parseInt(key.split("_")[1]) : 0,
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // Sort descending (newest first)

      // Keep only the 2 most recent tokens if we already have 3+
      const tokensToKeep = tokenArray.slice(0, MAX_TOKENS - 1);

      // Build new tokens object (plain object)
      const newTokens = {};
      tokensToKeep.forEach(({ key, value }) => {
        newTokens[key] = value;
      });

      // Add the new session token
      const newKey = `session_${Date.now()}`;
      newTokens[newKey] = sessionId;

      // ✅ Update using $set with plain object
      await User.findByIdAndUpdate(
        user._id,
        {
          $set: {
            evolutionGameTokens: newTokens,
          },
        },
        { new: true }
      );
      const response = await axios.post(
        `${evolutionAPIURL}/ua/v1/${evolutionCasinoID}/${evolutionToken}`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.entry) {
        console.log(
          "EVOLUTION error in launching game",
          response.data,
          response.data.Description
        );
        return res.status(200).json({
          success: false,
          message: {
            en: "EVOLUTION: Game launch failed. Please try again or customer service for assistance.",
            zh: "EVOLUTION: 游戏启动失败，请重试或联系客服以获得帮助。",
            ms: "EVOLUTION: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "EVOLUTION: 遊戲開唔到，老闆試多次或者搵客服幫手。",
            id: "EVOLUTION: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      await GameWalletLogAttempt(
        user.username,
        "Transfer In",
        "Seamless",
        roundToTwoDecimals(user.wallet),
        "EVOLUTION"
      );

      return res.status(200).json({
        success: true,
        gameLobby: `${evolutionAPIURL}${response.data.entryEmbedded}`,
        message: {
          en: "Game launched successfully.",
          zh: "游戏启动成功。",
          ms: "Permainan berjaya dimulakan.",
          zh_hk: "遊戲啟動成功。",
          id: "Permainan berhasil diluncurkan.",
        },
      });
    } catch (error) {
      console.error("Evolution error launching game Error message:", error);

      return res.status(200).json({
        success: false,
        message: {
          en: "EVOLUTION: Game launch failed. Please try again or customer service for assistance.",
          zh: "EVOLUTION: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "EVOLUTION: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "EVOLUTION: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "EVOLUTION: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }
  }
);

router.post("/api/evolution/sid", async (req, res) => {
  try {
    const { sid, userId, uuid, channel } = req.body;

    if (!userId || !uuid || !channel?.type) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const channelType = channel.type;

    const currentUser = await User.findOne(
      { gameId: userId },
      { username: 1, wallet: 1, _id: 1, gameId: 1 }
    ).lean();

    if (!currentUser) {
      console.log("invalid token failed 2");
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const sessionId = `${currentUser.gameId}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const updatedUser = await User.findOneAndUpdate(
      { _id: currentUser._id },
      {
        $set: {
          [`evolutionGameTokens.${channelType}`]: sessionId,
        },
      },
      { new: true }
    );

    return res.status(200).json({ status: "OK", sid: sessionId, uuid });
  } catch (error) {
    console.error("Evolution error in validate check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/check", async (req, res) => {
  try {
    const { sid, userId, uuid } = req.body;
    if (!sid || !userId || !uuid) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const currentUser = await User.aggregate([
      {
        $match: { gameId: userId },
      },
      {
        $project: {
          username: 1,
          wallet: 1,
          hasValidToken: {
            $in: [
              sid,
              {
                $map: {
                  input: { $objectToArray: "$evolutionGameTokens" },
                  as: "token",
                  in: "$$token.v",
                },
              },
            ],
          },
        },
      },
      {
        $match: { hasValidToken: true },
      },
    ]);

    if (!currentUser || currentUser.length === 0) {
      console.log("invalid token failed 2");
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }
    return res.status(200).json({ status: "OK", uuid, sid });
  } catch (error) {
    console.error("Evolution error in validate check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/balance", async (req, res) => {
  try {
    const { sid, userId, uuid, game } = req.body;
    if (!sid || !userId || !uuid) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const currentUser = await User.aggregate([
      {
        $match: { gameId: userId },
      },
      {
        $project: {
          username: 1,
          wallet: 1,
          hasValidToken: {
            $in: [
              sid,
              {
                $map: {
                  input: { $objectToArray: "$evolutionGameTokens" },
                  as: "token",
                  in: "$$token.v",
                },
              },
            ],
          },
        },
      },
      {
        $match: { hasValidToken: true },
      },
    ]);

    if (!currentUser || currentUser.length === 0) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }
    return res.status(200).json({
      status: "OK",
      balance: roundToTwoDecimals(currentUser[0].wallet),
      bonus: 0,
      uuid,
    });
  } catch (error) {
    console.error("Evolution error in balance check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/debit", async (req, res) => {
  try {
    const { sid, userId, uuid, game, transaction } = req.body;
    if (!sid || !userId || !uuid || !transaction) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const transactions = Array.isArray(transaction)
      ? transaction
      : [transaction];

    const transactionIds = transactions.map((trans) => trans.refId);

    const [userResult, existingBets] = await Promise.all([
      User.aggregate([
        {
          $match: { gameId: userId },
        },
        {
          $project: {
            username: 1,
            wallet: 1,
            "gameLock.evolution.lock": 1,
            _id: 1,
            hasValidToken: {
              $in: [
                sid,
                {
                  $map: {
                    input: { $objectToArray: "$evolutionGameTokens" },
                    as: "token",
                    in: "$$token.v",
                  },
                },
              ],
            },
          },
        },
        {
          $match: { hasValidToken: true },
        },
      ]),
      LiveEvolutionModal.find(
        {
          tranId: { $in: transactionIds },
        },
        { _id: 1, cancel: 1 }
      ).lean(),
    ]);

    const currentUser = userResult[0];

    if (!currentUser) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    if (currentUser.gameLock?.evolution?.lock) {
      return res.status(200).json({ status: "ACCOUNT_LOCKED" });
    }

    if (existingBets.length > 0) {
      const hasCancelledBet = existingBets.some((bet) => bet.cancel);

      if (hasCancelledBet) {
        return res.status(200).json({ status: "FINAL_ERROR_ACTION_FAILED" });
      }

      return res.status(200).json({ status: "BET_ALREADY_EXIST" });
    }

    const totalAmount = transactions.reduce(
      (sum, trans) => sum + trans.amount,
      0
    );

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: roundToTwoDecimals(totalAmount) },
      },
      { $inc: { wallet: -roundToTwoDecimals(totalAmount) } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({ status: "INSUFFICIENT_FUNDS" });
    }

    const betRecords = transactions.map((trans) => ({
      betId: trans.id,
      tranId: trans.refId,
      username: userId,
      betamount: roundToTwoDecimals(trans.amount),
      bet: true,
      gameId: game?.id,
    }));

    await LiveEvolutionModal.insertMany(betRecords);

    return res.status(200).json({
      status: "OK",
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      bonus: 0,
      uuid,
    });
  } catch (error) {
    console.error("Evolution error in balance check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/credit", async (req, res) => {
  try {
    const { sid, userId, uuid, game, transaction } = req.body;
    if (!sid || !userId || !uuid || !transaction) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const transactions = Array.isArray(transaction)
      ? transaction
      : [transaction];
    const transactionRefIds = transactions.map((trans) => trans.refId);

    const [currentUser, existingBets, settledOrCancelledBets] =
      await Promise.all([
        User.findOne(
          { gameId: userId },
          {
            username: 1,
            wallet: 1,
            _id: 1,
          }
        ).lean(),
        LiveEvolutionModal.find(
          {
            tranId: { $in: transactionRefIds },
          },
          { _id: 1, cancel: 1, settle: 1 }
        ).lean(),
        LiveEvolutionModal.find(
          {
            tranId: { $in: transactionRefIds },
            $or: [{ settle: true }, { cancel: true }],
          },
          { _id: 1 }
        ).lean(),
      ]);

    if (!currentUser) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    if (!existingBets || existingBets.length === 0) {
      return res.status(200).json({ status: "BET_DOES_NOT_EXIST" });
    }

    if (settledOrCancelledBets.length > 0) {
      return res.status(200).json({ status: "BET_ALREADY_SETTLED" });
    }

    const totalAmount = transactions.reduce(
      (sum, trans) => sum + trans.amount,
      0
    );

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: roundToTwoDecimals(totalAmount) } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      LiveEvolutionModal.bulkWrite([
        ...transactions.map((trans, index) => ({
          updateOne: {
            filter: { tranId: trans.refId },
            update: {
              $set: {
                settleamount: index === 0 ? roundToTwoDecimals(totalAmount) : 0,
                settleId: trans.id,
                settle: true,
              },
            },
          },
        })),
      ]),
    ]);

    return res.status(200).json({
      status: "OK",
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      bonus: 0,
      uuid,
    });
  } catch (error) {
    console.error("Evolution error in balance check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/cancel", async (req, res) => {
  try {
    const { sid, userId, uuid, game, transaction } = req.body;
    if (!sid || !userId || !uuid || !transaction) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const transactions = Array.isArray(transaction)
      ? transaction
      : [transaction];
    const transactionRefIds = transactions.map((trans) => trans.refId);

    const [currentUser, existingBets, settledOrCancelledBets] =
      await Promise.all([
        User.findOne(
          { gameId: userId },
          {
            username: 1,
            wallet: 1,
            _id: 1,
          }
        ).lean(),
        LiveEvolutionModal.find(
          {
            tranId: { $in: transactionRefIds },
          },
          { _id: 1, cancel: 1, settle: 1 }
        ).lean(),
        LiveEvolutionModal.find(
          {
            tranId: { $in: transactionRefIds },
            $or: [{ settle: true }, { cancel: true }],
          },
          { _id: 1 }
        ).lean(),
      ]);
    if (!currentUser) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    if (!existingBets || existingBets.length === 0) {
      const betRecords = transactions.map((trans) => ({
        tranId: trans.refId,
        cancelId: trans.id,
        username: userId,
        betamount: roundToTwoDecimals(trans.amount),
        cancel: true,
      }));

      await LiveEvolutionModal.insertMany(betRecords);

      return res.status(200).json({ status: "BET_DOES_NOT_EXIST" });
    }

    if (settledOrCancelledBets.length > 0) {
      return res.status(200).json({ status: "BET_ALREADY_SETTLED" });
    }

    const totalAmount = transactions.reduce(
      (sum, trans) => sum + trans.amount,
      0
    );

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: roundToTwoDecimals(totalAmount) } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      LiveEvolutionModal.bulkWrite([
        ...transactions.map((trans, index) => ({
          updateOne: {
            filter: { tranId: trans.refId },
            update: {
              $set: {
                cancelId: trans.id,
                cancel: true,
              },
            },
          },
        })),
      ]),
    ]);

    return res.status(200).json({
      status: "OK",
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      bonus: 0,
      uuid,
    });
  } catch (error) {
    console.error("Evolution error in balance check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/promo_payout", async (req, res) => {
  try {
    const { sid, userId, uuid, game, promoTransaction } = req.body;
    if (!sid || !userId || !uuid || !promoTransaction) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const transactions = Array.isArray(promoTransaction)
      ? promoTransaction
      : [promoTransaction];
    const transactionIds = transactions.map((trans) => trans.id);

    const [currentUser, existingBets] = await Promise.all([
      User.findOne(
        { gameId: userId },
        {
          username: 1,
          wallet: 1,
          _id: 1,
        }
      ).lean(),
      LiveEvolutionModal.find(
        {
          promoId: { $in: transactionIds },
        },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({ status: "INVALID_TOKEN_ID" });
    }

    if (existingBets.length > 0) {
      return res.status(200).json({ status: "BET_ALREADY_SETTLED" });
    }

    const totalAmount = transactions.reduce(
      (sum, trans) => sum + trans.amount,
      0
    );

    const promoRecords = transactions.map((trans, index) => ({
      promoId: trans.id,
      username: userId,
      settleamount: index === 0 ? roundToTwoDecimals(totalAmount) : 0,
      bet: true,
      settle: true,
      betamount: 0,
      gameId: game?.id || null,
    }));

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: roundToTwoDecimals(totalAmount) } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      LiveEvolutionModal.insertMany(promoRecords),
    ]);

    return res.status(200).json({
      status: "OK",
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      bonus: 0,
      uuid,
    });
  } catch (error) {
    console.error("Evolution error in balance check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/close", async (req, res) => {
  try {
    const { sid, userId, uuid, game } = req.body;
    if (!sid || !userId || !uuid) {
      return res.status(200).json({ status: "INVALID_PARAMETER" });
    }

    const [currentUser] = await Promise.all([
      User.findOne(
        { gameId: userId },
        {
          username: 1,
          wallet: 1,
          _id: 1,
        }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({ status: "INVALID_TOKEN_ID" });
    }

    if (game?.id) {
      const updateResult = await LiveEvolutionModal.updateMany(
        {
          gameId: game.id,
        },
        {
          $set: {
            settle: true,
          },
        }
      );
    }

    return res.status(200).json({
      status: "OK",
      balance: roundToTwoDecimals(currentUser.wallet),
      bonus: 0,
      uuid,
    });
  } catch (error) {
    console.error("Evolution error in balance check:", error);
    return res.status(200).json({ status: "UNKNOWN_ERROR" });
  }
});

router.post("/api/evolution/getturnoverforrebate", async (req, res) => {
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

    console.log("EVOLUTION QUERYING TIME", startDate, endDate);

    const records = await LiveEvolutionModal.find({
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
        (record.settleamount || 0) - (record.betamount || 0);
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
        gamename: "EVOLUTION",
        gamecategory: "Live Casino",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("EVOLUTION: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      error: "EVOLUTION: Failed to fetch win/loss report",
    });
  }
});

router.get(
  "/admin/api/evolution/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await LiveEvolutionModal.find({
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

        totalWinLoss += (record.settleamount || 0) - (record.betamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "EVOLUTION",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("EVOLUTION: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "EVOLUTION: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/evolution/:userId/gamedata",
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
          gameCategories["Live Casino"] &&
          gameCategories["Live Casino"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Live Casino"]);

          if (gamecat["EVOLUTION"]) {
            totalTurnover += gamecat["EVOLUTION"].turnover || 0;
            totalWinLoss += gamecat["EVOLUTION"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "EVOLUTION",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("EVOLUTION: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "EVOLUTION: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/evolution/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await LiveEvolutionModal.find({
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

        totalWinLoss += (record.betamount || 0) - (record.settleamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "EVOLUTION",
          gamecategory: "Live Casino",
          totalturnover: totalTurnover,
          totalwinloss: totalWinLoss,
        },
      });
    } catch (error) {
      console.log("EVOLUTION: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "EVOLUTION: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/evolution/kioskreport",
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
          gameCategories["Live Casino"] &&
          gameCategories["Live Casino"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Live Casino"]);

          if (gamecat["EVOLUTION"]) {
            totalTurnover += Number(gamecat["EVOLUTION"].turnover || 0);
            totalWinLoss += Number(gamecat["EVOLUTION"].winloss || 0);
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "EVOLUTION",
          gamecategory: "Live Casino",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("EVOLUTION: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "EVOLUTION: Failed to fetch win/loss report",
      });
    }
  }
);

module.exports = router;
