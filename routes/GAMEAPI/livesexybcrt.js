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
const liveSexybcrtModal = require("../../models/live_sexybcrt.model");
const GameWalletLog = require("../../models/gamewalletlog.model");

require("dotenv").config();

//Staging
const sexybcrtPrefix = "ezwin9hkd";
const sexybcrtSecret = process.env.SEXYBCRT_SECRET;
const webURL = "https://www.ezwin9.com/";
const sexybcrtAPIURL = "https://gciap.usplaynet.com";

function generateBalanceTs() {
  return moment.utc().add(8, "hours").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
}

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

const allGameCombinations = [
  { code: "SEXYBCRT", type: "LIVE" },
  //   { code: "LUDO", type: "TABLE" },
  //   { code: "RT", type: "SLOT" },
  //   { code: "RT", type: "TABLE" },
  //   { code: "YESBINGO", type: "TABLE" },
  //   { code: "YESBINGO", type: "SLOT" },
  //   { code: "YESBINGO", type: "FH" },
  //   { code: "YESBINGO", type: "BINGO" },
  //   { code: "SEXYBCRT", type: "OTHER" },
];

// Generate gameForbidden parameter based on current gameCode and gameType
const generateGameForbidden = (currentGameCode, currentGameType) => {
  // Start with an empty forbidden object
  const forbidden = {};

  // Loop through all game combinations
  allGameCombinations.forEach((game) => {
    // Skip the current game code entirely - we don't want to disable different types of the same game
    if (game.code === currentGameCode) {
      return;
    }

    // Add other game codes to forbidden list
    if (!forbidden[game.code]) {
      forbidden[game.code] = {};
    }

    if (!forbidden[game.code][game.type]) {
      forbidden[game.code][game.type] = ["ALL"];
    }
  });

  return JSON.stringify(forbidden);
};

router.post("/api/sexybcrt/launchGame", authenticateToken, async (req, res) => {
  try {
    //  gamelang === en or cn
    // gamecode === SEXYBCRT && LIVE || LUDO && TABLE || RT && SLOT || YESBINGO && TABLE || YESBINGO && SLOT
    // gameType === LIVE || TABLE || SLOT
    const { gameLang, gameType } = req.body;
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

    if (user.gameLock.sexybcrt.lock) {
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

    let lang = "cn";

    if (gameLang === "en") {
      lang = "en";
    } else if (gameLang === "zh") {
      lang = "cn";
    } else if (gameLang === "zh_hk") {
      lang = "cn";
    } else if (gameLang === "ms") {
      lang = "en";
    } else if (gameLang === "id") {
      lang = "en";
    }

    const currencyConfigs = {
      HKD: {
        suffix: "HKD",
        betLimits: {
          SEXYBCRT: {
            LIVE: {
              limitId: [120201],
            },
          },
        },
      },
    };

    const createAccount = async (currency, config) => {
      const options = {
        method: "POST",
        url: `${sexybcrtAPIURL}/wallet/createMember`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        data: querystring.stringify({
          cert: sexybcrtSecret,
          agentId: sexybcrtPrefix,
          userId: `${user.gameId}${config.suffix}`,
          currency: currency,
          language: lang,
          userName: `${user.username}${config.suffix}`,
          betLimit: JSON.stringify(config.betLimits),
        }),
      };

      const response = await axios.request(options);
      return {
        currency,
        status: response.data.status,
        desc: response.data.desc,
      };
    };

    const results = await Promise.all([
      createAccount("HKD", currencyConfigs.HKD),
    ]);

    for (const result of results) {
      if (result.status === "1031" || result.status === "1047") {
        return res.status(200).json({
          success: false,
          message: {
            en: "Game under maintenance. Please try again later.",
            zh: "游戏正在维护中，请稍后再试。",
            ms: "Permainan sedang diselenggara, sila cuba lagi nanti.",
            zh_hk: "遊戲而家維護緊，老闆遲啲再試下",
            id: "Permainan sedang dalam pemeliharaan. Silakan coba lagi nanti.",
          },
        });
      }

      if (result.status !== "0000" && result.status !== "1001") {
        console.log(
          `SEXYBCRT error in registering ${result.currency} account:`,
          result.desc
        );
        return res.status(200).json({
          success: false,
          message: {
            en: "SEXYBCRT: Game launch failed. Please try again or contact customer service for assistance.",
            zh: "SEXYBCRT: 游戏启动失败，请重试或联系客服以获得帮助。",
            ms: "SEXYBCRT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "SEXYBCRT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
            id: "SEXYBCRT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }
    }

    // const gameUsername =
    //   gameCode === "RT" ? `${user.username}MY` : `${user.username}AU`;
    const gameUsername = `${user.gameId}HKD`;
    // const gameForbidden = generateGameForbidden(gameCode, gameType);

    const launchOptions = {
      method: "POST",
      url: `${sexybcrtAPIURL}/wallet/login`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: querystring.stringify({
        cert: sexybcrtSecret,
        agentId: sexybcrtPrefix,
        userId: gameUsername,
        externalURL: webURL,
        platform: "SEXYBCRT",
        language: lang,
        gameType: "LIVE",
        // gameForbidden: gameForbidden,
        // gameForbidden: '{"RT":{"SLOT":["ALL"]}, "SEXYBCRT":{"LIVE":["ALL"]}}',
      }),
    };

    const launchResponse = await axios.request(launchOptions);

    if (
      launchResponse.data.status === "1031" ||
      launchResponse.data.status === "1047"
    ) {
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

    if (launchResponse.data.status !== "0000") {
      console.log("SEXYBCRT error in launching game", launchResponse.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "SEXYBCRT: Game launch failed. Please try again or contact customer service for assistance.",
          zh: "SEXYBCRT: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "SEXYBCRT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "SEXYBCRT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "SEXYBCRT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "SEXYBCRT"
    );

    return res.status(200).json({
      success: true,
      gameLobby: launchResponse.data.url,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("SEXYBCRT error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "SEXYBCRT: Game launch failed. Please try again or customer service for assistance.",
        zh: "SEXYBCRT: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "SEXYBCRT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "SEXYBCRT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "SEXYBCRT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/sexybaccarat", async (req, res) => {
  try {
    const { message, key } = req.body;

    // Validation checks
    if (!message || !key) {
      return res.status(200).json({
        status: "1036",
        desc: "Invalid parameters",
        userId: null,
        balance: null,
        balanceTs: null,
      });
    }

    if (key !== sexybcrtSecret) {
      return res.status(200).json({
        status: "1008",
        desc: "Invalid token",
        userId: null,
        balance: null,
        balanceTs: null,
      });
    }

    const originalPayload = JSON.parse(message);
    const { action } = originalPayload;
    const validateUser = async (userId, extraFields = {}) => {
      const cleanUsername = userId.replace(/(my|au|hkd)$/i, "").toUpperCase();
      // Default fields to retrieve plus any extra fields needed for specific actions
      const fields = {
        username: 1,
        wallet: 1,
        _id: 1,
        gameId: 1,
        ...extraFields,
      };

      return await User.findOne({ gameId: cleanUsername }, fields).lean();
    };

    const createResponse = (status, desc, user = null, extraFields = {}) => {
      const baseResponse = {
        status,
        desc,
        ...(user && {
          balance: roundToTwoDecimals(user.wallet),
          balanceTs: generateBalanceTs(),
        }),
        ...extraFields,
      };
      return baseResponse;
    };

    // Handle different actions
    switch (action) {
      case "getBalance": {
        const { userId } = originalPayload;
        const currentUser = await validateUser(userId);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        return res.status(200).json(
          createResponse("0000", "Success", currentUser, {
            userId: currentUser.gameId,
          })
        );
      }

      case "bet": {
        const betTransactions = originalPayload.txns || [];
        if (!betTransactions.length) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        // Validate user once - assuming all transactions have the same userId
        const userId = betTransactions[0].userId;
        const currentUser = await validateUser(userId, {
          "gameLock.sexybcrt.lock": 1,
        });

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (currentUser.gameLock.sexybcrt.lock) {
          return res
            .status(200)
            .json(createResponse("1013", "Account is Lock"));
        }

        let totalBetAmount = 0;
        const processedTransactions = [];
        const newTransactions = [];

        const platformTxIds = betTransactions.map((txn) => txn.platformTxId);
        const existingTransactionsMap = {};

        const existingTransactions = await liveSexybcrtModal
          .find(
            {
              roundId: { $in: platformTxIds },
              $or: [{ bet: true }, { cancel: true }],
            },
            { roundId: 1 }
          )
          .lean();

        existingTransactions.forEach((txn) => {
          existingTransactionsMap[txn.roundId] = true;
        });

        for (const transaction of betTransactions) {
          const { platformTxId, betAmount, platform } = transaction;

          if (existingTransactionsMap[platformTxId]) {
            processedTransactions.push({
              platformTxId,
              status: "skipped",
              message: "Transaction already exists",
            });
            continue;
          }

          // Add to total bet amount
          totalBetAmount += betAmount;

          // Store transaction details for later processing
          newTransactions.push({
            platformTxId,
            betAmount: roundToTwoDecimals(betAmount),
            platform,
          });
        }

        // Check if user has enough balance for all bets
        if (totalBetAmount > 0) {
          const updatedUserBalance = await User.findOneAndUpdate(
            {
              gameId: currentUser.gameId,
              wallet: { $gte: roundToTwoDecimals(totalBetAmount) },
            },
            { $inc: { wallet: -roundToTwoDecimals(totalBetAmount) } },
            { new: true, projection: { wallet: 1 } }
          ).lean();

          if (!updatedUserBalance) {
            const latestUser = await User.findOne(
              { gameId: currentUser.gameId },
              { wallet: 1 }
            ).lean();

            return res
              .status(200)
              .json(createResponse("1018", "Not Enough Balance", latestUser));
          }

          if (newTransactions.length > 0) {
            await liveSexybcrtModal.insertMany(
              newTransactions.map((txn) => ({
                username: currentUser.gameId,
                roundId: txn.platformTxId,
                bet: true,
                platform: txn.platform,
                betamount: txn.betAmount,
              }))
            );

            newTransactions.forEach((txn) => {
              processedTransactions.push({
                platformTxId: txn.platformTxId,
                status: "success",
                betAmount: txn.betAmount,
              });
            });
          }

          return res
            .status(200)
            .json(createResponse("0000", "Success", updatedUserBalance));
        } else {
          // If all transactions were skipped (already exist)
          return res
            .status(200)
            .json(createResponse("0000", "Success", currentUser));
        }
      }

      case "cancelBet": {
        const cancelBetTransactions = originalPayload.txns || [];
        if (!cancelBetTransactions.length) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        // Validate user once - assuming all transactions have the same userId
        const userId = cancelBetTransactions[0].userId;
        const currentUser = await validateUser(userId);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        const platformTxIds = cancelBetTransactions.map(
          (txn) => txn.platformTxId
        );

        // First check which transactions can be processed
        const [existingBetTransactions, existingSettledTransactions] =
          await Promise.all([
            liveSexybcrtModal
              .find(
                { roundId: { $in: platformTxIds }, bet: true },
                { roundId: 1, betamount: 1 }
              )
              .lean(),
            liveSexybcrtModal
              .find(
                {
                  roundId: { $in: platformTxIds },
                  $or: [{ cancel: true }, { settle: true }],
                },
                { roundId: 1 }
              )
              .lean(),
          ]);

        // Create maps for faster lookup
        const betTransactionsMap = {};
        existingBetTransactions.forEach((txn) => {
          betTransactionsMap[txn.roundId] = txn.betamount;
        });

        const settledTransactionsMap = {};
        existingSettledTransactions.forEach((txn) => {
          settledTransactionsMap[txn.roundId] = true;
        });

        let totalCancelAmount = 0;
        const processedTransactions = [];
        const transactionsToUpdate = [];

        // Process each transaction in the array
        for (const transaction of cancelBetTransactions) {
          const { platformTxId } = transaction;

          if (settledTransactionsMap[platformTxId]) {
            processedTransactions.push({
              platformTxId,
              status: "skipped",
              message: "Already processed",
            });
            continue;
          }

          const betAmount = betTransactionsMap[platformTxId];
          if (betAmount) {
            totalCancelAmount += betAmount;

            // Add to transactions to update
            transactionsToUpdate.push({
              platformTxId,
              cancelAmount: betAmount,
            });
          } else {
            transactionsToUpdate.push({
              platformTxId,
              cancelAmount: 0,
            });
          }
        }
        if (transactionsToUpdate.length > 0) {
          // Execute a bulk update operation
          const bulkOps = transactionsToUpdate.map((txn) => ({
            updateOne: {
              filter: { roundId: txn.platformTxId },
              update: { $set: { cancel: true } },
              upsert: true,
            },
          }));

          const [updatedUserBalance] = await Promise.all([
            User.findOneAndUpdate(
              { gameId: currentUser.gameId },
              { $inc: { wallet: roundToTwoDecimals(totalCancelAmount) } },
              { new: true, projection: { wallet: 1 } }
            ).lean(),
            liveSexybcrtModal.bulkWrite(bulkOps),
          ]);

          // Add processed transactions to the response
          transactionsToUpdate.forEach((txn) => {
            processedTransactions.push({
              platformTxId: txn.platformTxId,
              status: "success",
              cancelAmount: txn.cancelAmount,
            });
          });
          return res
            .status(200)
            .json(createResponse("0000", "Success", updatedUserBalance));
        } else {
          // If no transactions to process
          return res
            .status(200)
            .json(createResponse("0000", "Success", currentUser));
        }
      }

      case "adjustBet": {
        const adjustBetTransaction = originalPayload.txns?.[0];
        if (!adjustBetTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const { userId, roundId, adjustAmount, betAmount, platformTxId } =
          adjustBetTransaction;

        const [currentUser, existingTransaction, existingSettledTransaction] =
          await Promise.all([
            validateUser(userId),
            liveSexybcrtModal
              .findOne({ roundId: platformTxId, bet: true }, { _id: 1 })
              .lean(),
            liveSexybcrtModal
              .findOne({ roundId: platformTxId, adjusted: true }, { _id: 1 })
              .lean(),
          ]);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (!existingTransaction) {
          console.log(
            `No existing transaction found for adjustBet action. platformTxId: ${platformTxId}`
          );
          return res
            .status(200)
            .json(createResponse("0000", "Success", currentUser));
        }

        if (existingSettledTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed", currentUser));
        }

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            { $inc: { wallet: roundToTwoDecimals(adjustAmount) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.findOneAndUpdate(
            { roundId: platformTxId },
            {
              $set: {
                adjusted: true,
                betamount: roundToTwoDecimals(betAmount),
              },
            },
            { upsert: true, new: true }
          ),
        ]);

        return res
          .status(200)
          .json(createResponse("0000", "Success", updatedUserBalance));
      }

      case "voidBet": {
        const voidBetTransactions = originalPayload.txns || [];
        if (!voidBetTransactions.length) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        // Group transactions by userId
        const transactionsByUser = {};
        for (const transaction of voidBetTransactions) {
          const { userId } = transaction;
          if (!transactionsByUser[userId]) {
            transactionsByUser[userId] = [];
          }
          transactionsByUser[userId].push(transaction);
        }

        const results = [];

        // Process each user's transactions separately
        for (const userId in transactionsByUser) {
          const userTransactions = transactionsByUser[userId];
          const currentUser = await validateUser(userId);

          if (!currentUser) {
            results.push({
              userId,
              status: "failed",
              message: "Invalid user Id",
            });
            continue; // Skip to next user
          }

          const platformTxIds = userTransactions.map((txn) => txn.platformTxId);

          // Batch fetch existing transactions
          const [existingBetTransactions, existingVoidTransactions] =
            await Promise.all([
              liveSexybcrtModal
                .find(
                  { roundId: { $in: platformTxIds }, bet: true },
                  { roundId: 1, betamount: 1 }
                )
                .lean(),
              liveSexybcrtModal
                .find(
                  { roundId: { $in: platformTxIds }, void: true },
                  { roundId: 1 }
                )
                .lean(),
            ]);

          // Create maps for faster lookup
          const betTransactionsMap = {};
          existingBetTransactions.forEach((txn) => {
            betTransactionsMap[txn.roundId] = txn.betamount;
          });

          const voidTransactionsMap = {};
          existingVoidTransactions.forEach((txn) => {
            voidTransactionsMap[txn.roundId] = true;
          });

          let totalRefundAmount = 0;
          const processedTxns = [];
          const transactionsToUpdate = [];

          // Process each transaction
          for (const transaction of userTransactions) {
            const { platformTxId, betAmount, voidType } = transaction;

            // Skip already voided transactions
            if (voidTransactionsMap[platformTxId]) {
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "Already processed",
              });
              continue;
            }

            // Get the bet amount from our map
            const existingBetAmount = betTransactionsMap[platformTxId];
            if (!existingBetAmount) {
              console.log(
                `No existing transaction found for voidBet action. platformTxId: ${platformTxId}`
              );
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "No bet transaction found",
              });
              continue;
            }

            // Add to total refund amount and transaction updates
            totalRefundAmount += betAmount || existingBetAmount;

            // Add to our transactions to update
            transactionsToUpdate.push({
              platformTxId,
              voidType,
              refundAmount: roundToTwoDecimals(betAmount || existingBetAmount),
            });
          }

          // If there are transactions to process
          if (transactionsToUpdate.length > 0) {
            // Prepare bulk update operations
            const bulkOps = transactionsToUpdate.map((txn) => ({
              updateOne: {
                filter: { roundId: txn.platformTxId },
                update: {
                  $set: {
                    void: true,
                    ...(txn.voidType === 9 && {
                      remark: "Potentially Cheating",
                    }),
                  },
                },
                upsert: true,
              },
            }));

            // Execute DB operations in parallel
            const [updatedUserBalance] = await Promise.all([
              User.findOneAndUpdate(
                { gameId: currentUser.gameId },
                { $inc: { wallet: roundToTwoDecimals(totalRefundAmount) } },
                { new: true, projection: { wallet: 1 } }
              ).lean(),
              liveSexybcrtModal.bulkWrite(bulkOps),
            ]);

            // Prepare transaction results for response
            transactionsToUpdate.forEach((txn) => {
              processedTxns.push({
                platformTxId: txn.platformTxId,
                status: "success",
                refundAmount: txn.refundAmount,
              });
            });

            results.push({
              userId,
              status: "success",
              processedTxns,
              totalRefundAmount: roundToTwoDecimals(totalRefundAmount),
              updatedBalance: updatedUserBalance.wallet,
            });
          } else if (processedTxns.length > 0) {
            results.push({
              userId,
              status: "success",
              processedTxns,
              totalRefundAmount: 0,
              message: "No transactions to process",
            });
          }
        }

        // Return overall response
        return res
          .status(200)
          .json(createResponse("0000", "Success", { results }));
      }

      case "unvoidBet": {
        const unVoidBetTransaction = originalPayload.txns?.[0];
        if (!unVoidBetTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const { userId, roundId, voidType, platformTxId } =
          unVoidBetTransaction;
        const [currentUser, existingTransaction, existingUnVoidTransaction] =
          await Promise.all([
            validateUser(userId),
            liveSexybcrtModal
              .findOne({ roundId: platformTxId, bet: true }, { betamount: 1 })
              .lean(),
            liveSexybcrtModal
              .findOne({ roundId: platformTxId, void: false }, { _id: 1 })
              .lean(),
          ]);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (!existingTransaction) {
          console.log(
            `No existing transaction found for unvoidBet action. platformTxId: ${platformTxId}`
          );
          return res.status(200).json(createResponse("0000", "Success"));
        }

        if (existingUnVoidTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed"));
        }

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            {
              $inc: {
                wallet: -roundToTwoDecimals(existingTransaction.betamount),
              },
            },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.findOneAndUpdate(
            { roundId: platformTxId },
            {
              $set: {
                void: false,
                ...(voidType === 9 && { remark: "Potentially Cheating" }),
              },
            },
            { upsert: true, new: true }
          ),
        ]);

        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "refund": {
        const refundTransactions = originalPayload.txns;
        if (!refundTransactions || refundTransactions.length === 0) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const refundGroups = {};
        const platformTxIds = [];

        refundTransactions.forEach((txn) => {
          const {
            userId,
            platformTxId,
            betAmount,
            winAmount,
            refundPlatformTxId,
          } = txn;

          // Group by the original bet transaction (refundPlatformTxId)
          if (!refundGroups[refundPlatformTxId]) {
            refundGroups[refundPlatformTxId] = {
              userId: userId, // All refund transactions for same original bet should have same userId
              totalBetAmount: 0,
              totalWinAmount: 0,
              platformTxIds: [],
            };
          }

          refundGroups[refundPlatformTxId].totalBetAmount +=
            parseFloat(betAmount) || 0;
          refundGroups[refundPlatformTxId].totalWinAmount +=
            parseFloat(winAmount) || 0;
          refundGroups[refundPlatformTxId].platformTxIds.push(platformTxId);
          platformTxIds.push(platformTxId);
        });

        const uniqueUserIds = [
          ...new Set(Object.values(refundGroups).map((group) => group.userId)),
        ];

        const userValidationPromises = uniqueUserIds.map((userId) =>
          validateUser(userId)
        );
        const users = await Promise.all(userValidationPromises);

        const invalidUserIndex = users.findIndex((user) => !user);
        if (invalidUserIndex !== -1) {
          return res
            .status(200)
            .json(createResponse("1000", `Invalid user Id`));
        }

        const originalBetIds = Object.keys(refundGroups);

        const [existingTransactions, existingRefundedTransactions] =
          await Promise.all([
            liveSexybcrtModal
              .find({ roundId: { $in: originalBetIds }, bet: true }, { _id: 1 })
              .lean(),
            liveSexybcrtModal
              .find(
                { roundId: { $in: originalBetIds }, refunded: true },
                { _id: 1 }
              )
              .lean(),
          ]);

        if (existingTransactions.length === 0) {
          console.log(
            `No existing transactions found for refund action. platformTxIds: ${platformTxIds.join(
              ", "
            )}`
          );
          return res.status(200).json(createResponse("0000", "Success"));
        }

        if (existingRefundedTransactions.length > 0) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed"));
        }

        const userUpdatePromises = [];

        Object.keys(refundGroups).forEach((refundPlatformTxId) => {
          const refundData = refundGroups[refundPlatformTxId];
          const userId = refundData.userId;

          const user = users.find(
            (u) => u.gameId === userId || u.userId === userId
          );
          if (user) {
            const netRefundAmount = roundToTwoDecimals(
              refundData.totalWinAmount - refundData.totalBetAmount
            );

            userUpdatePromises.push(
              User.findOneAndUpdate(
                { gameId: user.gameId },
                { $inc: { wallet: netRefundAmount } },
                { new: true, projection: { wallet: 1, gameId: 1 } }
              ).lean()
            );
          }
        });

        const [updatedUserBalance] = await Promise.all([
          Promise.all(userUpdatePromises),

          liveSexybcrtModal.updateMany(
            { roundId: { $in: originalBetIds } },
            { $set: { refunded: true } }
          ),
        ]);

        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "settle": {
        const settleTransactions = originalPayload.txns || [];
        if (!settleTransactions.length) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        // Group transactions by userId
        const transactionsByUser = {};
        for (const transaction of settleTransactions) {
          const { userId } = transaction;
          if (!transactionsByUser[userId]) {
            transactionsByUser[userId] = [];
          }
          transactionsByUser[userId].push(transaction);
        }

        const results = [];

        // Process each user's transactions separately
        for (const userId in transactionsByUser) {
          const userTransactions = transactionsByUser[userId];
          const currentUser = await validateUser(userId);

          if (!currentUser) {
            results.push({
              userId,
              status: "failed",
              message: "Invalid user Id",
            });
            continue; // Skip to next user
          }

          // Batch fetch existing transactions
          const platformTxIds = userTransactions.map((txn) => txn.platformTxId);

          const [existingBetTransactions, existingSettledTransactions] =
            await Promise.all([
              liveSexybcrtModal
                .find(
                  { roundId: { $in: platformTxIds }, bet: true },
                  { roundId: 1 }
                )
                .lean(),
              liveSexybcrtModal
                .find(
                  {
                    roundId: { $in: platformTxIds },
                    $or: [{ cancel: true }, { settle: true }],
                  },
                  { roundId: 1 }
                )
                .lean(),
            ]);

          // Create maps for faster lookup
          const betTransactionsMap = {};
          existingBetTransactions.forEach((txn) => {
            betTransactionsMap[txn.roundId] = true;
          });

          const settledTransactionsMap = {};
          existingSettledTransactions.forEach((txn) => {
            settledTransactionsMap[txn.roundId] = true;
          });

          let totalWinAmount = 0;
          let totalTurnover = 0;
          const processedTxns = [];
          const transactionsToUpdate = [];
          const userBetTotals = {};

          // Process each transaction
          for (const transaction of userTransactions) {
            const { platformTxId, winAmount, betAmount, turnover } =
              transaction;

            // Skip already settled transactions
            if (settledTransactionsMap[platformTxId]) {
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "Already processed",
              });
              continue;
            }

            // Skip if no bet transaction exists
            if (!betTransactionsMap[platformTxId]) {
              console.log(
                `No existing transaction found for settle action. platformTxId: ${platformTxId}`
              );
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "No bet transaction found",
              });
              continue;
            }

            // Add to total amounts
            totalWinAmount += winAmount;
            totalTurnover += turnover || betAmount;

            // Add to transactions to update
            transactionsToUpdate.push({
              platformTxId,
              winAmount: roundToTwoDecimals(winAmount),
            });

            if (!userBetTotals[currentUser._id]) {
              userBetTotals[currentUser._id] = 0;
            }
            userBetTotals[currentUser._id] += roundToTwoDecimals(betAmount);
          }

          // If there are transactions to process
          if (transactionsToUpdate.length > 0) {
            // Prepare bulk operations
            const bulkOps = transactionsToUpdate.map((txn) => ({
              updateOne: {
                filter: { roundId: txn.platformTxId },
                update: {
                  $set: {
                    settle: true,
                    settleamount: txn.winAmount,
                  },
                },
                upsert: true,
              },
            }));

            const updatedUserBalance = await User.findOneAndUpdate(
              { gameId: currentUser.gameId },
              { $inc: { wallet: roundToTwoDecimals(totalWinAmount) } },
              { new: true, projection: { wallet: 1 } }
            ).lean();

            // Execute bulk update
            await liveSexybcrtModal.bulkWrite(bulkOps);

            // Add processed transactions to the response
            transactionsToUpdate.forEach((txn) => {
              processedTxns.push({
                platformTxId: txn.platformTxId,
                status: "success",
                winAmount: txn.winAmount,
              });
            });

            results.push({
              userId,
              status: "success",
              processedTxns,
              totalWinAmount: roundToTwoDecimals(totalWinAmount),
              updatedBalance: updatedUserBalance.wallet,
            });
          } else if (processedTxns.length > 0) {
            results.push({
              userId,
              status: "success",
              processedTxns,
              totalWinAmount: 0,
              message: "No wins to process",
            });
          }
        }

        // Return overall response
        return res
          .status(200)
          .json(createResponse("0000", "Success", { results }));
      }

      case "unsettle": {
        const unSettleTransactions = originalPayload.txns;
        if (!unSettleTransactions || unSettleTransactions.length === 0) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const uniqueUserIds = [
          ...new Set(unSettleTransactions.map((txn) => txn.userId)),
        ];
        const platformTxIds = unSettleTransactions.map(
          (txn) => txn.platformTxId
        );

        const userValidationPromises = uniqueUserIds.map((userId) =>
          validateUser(userId)
        );
        const users = await Promise.all(userValidationPromises);

        const invalidUserIndex = users.findIndex((user) => !user);
        if (invalidUserIndex !== -1) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        const userMap = {};
        users.forEach((user) => {
          userMap[user.gameId] = user;
        });

        const [existingTransactions, existingSettledTransactions] =
          await Promise.all([
            liveSexybcrtModal
              .find(
                { roundId: { $in: platformTxIds }, bet: true },
                { _id: 1, roundId: 1 }
              )
              .lean(),
            liveSexybcrtModal
              .find(
                {
                  roundId: { $in: platformTxIds },
                  settle: true,
                },
                { roundId: 1, settleamount: 1, userId: 1 }
              )
              .lean(),
          ]);

        if (existingTransactions.length === 0) {
          console.log(
            `No existing transactions found for unsettle action. platformTxIds: ${platformTxIds.join(
              ", "
            )}`
          );
          return res.status(200).json(createResponse("0000", "Success"));
        }

        if (existingSettledTransactions.length === 0) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed"));
        }

        const userSettleAmounts = {};

        existingSettledTransactions.forEach((settledTxn) => {
          const originalTxn = unSettleTransactions.find(
            (txn) => txn.platformTxId === settledTxn.roundId
          );
          if (originalTxn) {
            const userId = originalTxn.userId;
            if (!userSettleAmounts[userId]) {
              userSettleAmounts[userId] = 0;
            }
            userSettleAmounts[userId] +=
              parseFloat(settledTxn.settleamount) || 0;
          }
        });
        const userUpdatePromises = [];

        Object.keys(userSettleAmounts).forEach((userId) => {
          const totalSettleAmount = roundToTwoDecimals(
            userSettleAmounts[userId]
          );

          const cleanUserId = userId.replace(/(my|au|hkd)$/i, "").toUpperCase();
          // Find the user's gameId for the update
          const user = users.find((u) => u.gameId === cleanUserId);
          if (user) {
            userUpdatePromises.push(
              User.findOneAndUpdate(
                { gameId: user.gameId },
                { $inc: { wallet: -totalSettleAmount } },
                { new: true, projection: { wallet: 1, gameId: 1 } }
              ).lean()
            );
          }
        });

        const [updatedUserBalances] = await Promise.all([
          Promise.all(userUpdatePromises),

          liveSexybcrtModal.updateMany(
            { roundId: { $in: platformTxIds } },
            { $set: { settle: false } }
          ),
        ]);

        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "voidSettle": {
        const voidSettleTransaction = originalPayload.txns?.[0];
        if (!voidSettleTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const { userId, roundId, betAmount, voidType, platformTxId } =
          voidSettleTransaction;
        const [currentUser, existingTransaction, existingSettledTransaction] =
          await Promise.all([
            validateUser(userId),
            liveSexybcrtModal
              .findOne(
                { roundId: platformTxId, bet: true },
                { settleamount: 1 }
              )
              .lean(),
            liveSexybcrtModal
              .findOne({ roundId: platformTxId, settle: false }, { _id: 1 })
              .lean(),
          ]);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (!existingTransaction) {
          console.log(
            `No existing transaction found for voidSettle action. platformTxId: ${platformTxId}`
          );
          return res.status(200).json(createResponse("0000", "Success"));
        }

        if (existingSettledTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed"));
        }

        let tobeDeducted = 0;

        tobeDeducted = betAmount - existingTransaction.settleamount;

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            { $inc: { wallet: roundToTwoDecimals(tobeDeducted) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.findOneAndUpdate(
            { roundId: platformTxId },
            {
              $set: {
                void: true,
                settle: false,
                ...(voidType === 9 && { remark: "Potentially Cheating" }),
              },
            },
            { upsert: true, new: true }
          ),
        ]);

        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "unvoidSettle": {
        const unVoidSettleTransaction = originalPayload.txns?.[0];
        if (!unVoidSettleTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const { userId, roundId, voidType, platformTxId } =
          unVoidSettleTransaction;
        const [currentUser, existingTransaction, existingSettledTransaction] =
          await Promise.all([
            validateUser(userId),
            liveSexybcrtModal
              .findOne(
                { roundId: platformTxId, bet: true },
                { settleamount: 1, betamount: 1 }
              )
              .lean(),
            liveSexybcrtModal
              .findOne({ roundId: platformTxId, void: false }, { _id: 1 })
              .lean(),
          ]);
        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (!existingTransaction) {
          console.log(
            `No existing transaction found for unvoidSettle action. platformTxId: ${platformTxId}`
          );
          return res.status(200).json(createResponse("0000", "Success"));
        }

        if (existingSettledTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed"));
        }

        const toUpdateAmt =
          (existingTransaction.settleamount || 0) -
          (existingTransaction.betamount || 0);
        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            {
              $inc: {
                wallet: roundToTwoDecimals(toUpdateAmt),
              },
            },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.findOneAndUpdate(
            { roundId: platformTxId },
            {
              $set: {
                void: false,
                settle: true,
                ...(voidType === 9 && { remark: "Potentially Cheating" }),
              },
            },
            { upsert: true, new: true }
          ),
        ]);

        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "betNSettle": {
        const betNsettleTransaction = originalPayload.txns?.[0];
        if (!betNsettleTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const {
          userId,
          roundId,
          winAmount,
          requireAmount,
          betAmount,
          platformTxId,
          platform,
        } = betNsettleTransaction;
        const [currentUser, existingSettledTransaction] = await Promise.all([
          validateUser(userId, { "gameLock.sexybcrt.lock": 1 }),
          liveSexybcrtModal
            .findOne(
              {
                roundId: platformTxId,
                $or: [{ cancel: true }, { settle: true }],
              },
              { _id: 1 }
            )
            .lean(),
        ]);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (currentUser.gameLock?.sexybcrt?.lock) {
          return res
            .status(200)
            .json(createResponse("1013", "Account is Lock"));
        }

        if (existingSettledTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Success", currentUser));
        }

        const requiredAmount = requireAmount ? requireAmount : betAmount;

        const updateAmount = winAmount - betAmount;

        const updatedUserBalance = await User.findOneAndUpdate(
          {
            gameId: currentUser.gameId,
            wallet: { $gte: roundToTwoDecimals(requiredAmount) },
          },
          { $inc: { wallet: roundToTwoDecimals(updateAmount) } },
          { new: true, projection: { wallet: 1 } }
        ).lean();

        if (!updatedUserBalance) {
          const latestUser = await User.findOne(
            { gameId: currentUser.gameId },
            { wallet: 1 }
          ).lean();

          return res
            .status(200)
            .json(createResponse("1018", "Not Enough Balance", latestUser));
        }

        await liveSexybcrtModal.create({
          username: currentUser.gameId,
          roundId: platformTxId,
          bet: true,
          settle: true,
          platform,
          settleamount: roundToTwoDecimals(winAmount),
          betamount: roundToTwoDecimals(betAmount),
        });

        return res
          .status(200)
          .json(createResponse("0000", "Success", updatedUserBalance));
      }

      case "cancelBetNSettle": {
        const cancelBetNSettleTransactions = originalPayload.txns || [];
        if (!cancelBetNSettleTransactions.length) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        // Group transactions by userId for efficient processing
        const transactionsByUser = {};
        for (const transaction of cancelBetNSettleTransactions) {
          const { userId } = transaction;
          if (!transactionsByUser[userId]) {
            transactionsByUser[userId] = [];
          }
          transactionsByUser[userId].push(transaction);
        }

        // Process each user's transactions separately
        for (const userId in transactionsByUser) {
          const userTransactions = transactionsByUser[userId];
          const currentUser = await validateUser(userId);

          if (!currentUser) {
            continue; // Skip to next user
          }

          // Get all platformTxIds for this user
          const platformTxIds = userTransactions.map((txn) => txn.platformTxId);

          // Batch fetch existing transactions
          const [existingSettledTransactions, existingCanceledTransactions] =
            await Promise.all([
              liveSexybcrtModal
                .find(
                  {
                    roundId: { $in: platformTxIds },
                    $or: [{ bet: true }, { settle: true }],
                  },
                  { roundId: 1, betamount: 1, settleamount: 1 }
                )
                .lean(),
              liveSexybcrtModal
                .find(
                  { roundId: { $in: platformTxIds }, cancel: true },
                  { roundId: 1 }
                )
                .lean(),
            ]);

          // Create maps for faster lookup
          const settledTransactionsMap = {};
          existingSettledTransactions.forEach((txn) => {
            settledTransactionsMap[txn.roundId] = {
              betAmount: txn.betamount || 0,
              settleAmount: txn.settleamount || 0,
            };
          });

          const canceledTransactionsMap = {};
          existingCanceledTransactions.forEach((txn) => {
            canceledTransactionsMap[txn.roundId] = true;
          });

          let totalAdjustmentAmount = 0;
          const processedTxns = [];
          const transactionsToUpdate = [];

          // Process each transaction
          for (const transaction of userTransactions) {
            const { platformTxId } = transaction;

            // Skip already canceled transactions
            if (canceledTransactionsMap[platformTxId]) {
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "Already cancelled",
              });
              continue;
            }

            // Get the settled transaction details from our map
            const settledDetails = settledTransactionsMap[platformTxId];
            if (!settledDetails) {
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "No original transaction found",
              });
              continue;
            }

            // Calculate adjustment amount
            const adjustmentAmount =
              settledDetails.betAmount - settledDetails.settleAmount;

            // Add to total adjustment and transactions to update
            totalAdjustmentAmount += adjustmentAmount;

            transactionsToUpdate.push({
              platformTxId,
              adjustmentAmount: roundToTwoDecimals(adjustmentAmount),
            });
          }

          // If there are transactions to process
          if (transactionsToUpdate.length > 0) {
            // Prepare bulk update operations
            const bulkOps = transactionsToUpdate.map((txn) => ({
              updateOne: {
                filter: { roundId: txn.platformTxId },
                update: { $set: { cancel: true, settle: false, bet: false } },
                upsert: true,
              },
            }));

            // Execute DB operations in parallel
            const [updatedUserBalance] = await Promise.all([
              User.findOneAndUpdate(
                { gameId: currentUser.gameId },
                { $inc: { wallet: roundToTwoDecimals(totalAdjustmentAmount) } },
                { new: true, projection: { wallet: 1 } }
              ).lean(),
              liveSexybcrtModal.bulkWrite(bulkOps),
            ]);

            // Prepare transaction results for response
            transactionsToUpdate.forEach((txn) => {
              processedTxns.push({
                platformTxId: txn.platformTxId,
                status: "success",
                adjustmentAmount: txn.adjustmentAmount,
              });
            });

            return res
              .status(200)
              .json(createResponse("0000", "Success", updatedUserBalance));
          } else if (processedTxns.length > 0) {
            return res
              .status(200)
              .json(createResponse("0000", "Success", currentUser));
          }
        }

        // Return overall response
        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "freeSpin": {
        const freeSpinTransaction = originalPayload.txns?.[0];
        if (!freeSpinTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const {
          userId,
          roundId,
          winAmount,
          betAmount,
          platformTxId,
          platform,
        } = freeSpinTransaction;
        const [currentUser, existingTransaction] = await Promise.all([
          validateUser(userId),
          liveSexybcrtModal
            .findOne({ roundId: platformTxId, freespin: true }, { _id: 1 })
            .lean(),
        ]);
        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (existingTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed"));
        }

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            { $inc: { wallet: roundToTwoDecimals(winAmount) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.create({
            username: currentUser.gameId,
            roundId: platformTxId,
            freespin: true,
            platform,
            betamount: roundToTwoDecimals(betAmount),
            settleamount: roundToTwoDecimals(winAmount),
          }),
        ]);

        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "give": {
        const giveTransaction = originalPayload.txns?.[0];
        if (!giveTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const { userId, amount, promotionTxId, platform } = giveTransaction;
        const [currentUser, existingTransaction] = await Promise.all([
          validateUser(userId),
          liveSexybcrtModal
            .findOne({ roundId: promotionTxId, promo: true }, { _id: 1 })
            .lean(),
        ]);
        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (existingTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed"));
        }

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            { $inc: { wallet: roundToTwoDecimals(amount) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.create({
            username: currentUser.gameId,
            roundId: promotionTxId,
            promo: true,
            platform,
            settleamount: roundToTwoDecimals(amount),
          }),
        ]);

        return res.status(200).json(createResponse("0000", "Success"));
      }

      case "resettle": {
        const reSettleTransactions = originalPayload.txns || [];
        if (!reSettleTransactions.length) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        // Group transactions by userId for efficient processing
        const transactionsByUser = {};
        for (const transaction of reSettleTransactions) {
          const { userId } = transaction;
          if (!transactionsByUser[userId]) {
            transactionsByUser[userId] = [];
          }
          transactionsByUser[userId].push(transaction);
        }

        const results = [];

        // Process each user's transactions separately
        for (const userId in transactionsByUser) {
          const userTransactions = transactionsByUser[userId];
          const currentUser = await validateUser(userId);

          if (!currentUser) {
            results.push({
              userId,
              status: "failed",
              message: "Invalid user Id",
            });
            continue; // Skip to next user
          }

          // Get all platformTxIds for this user
          const platformTxIds = userTransactions.map((txn) => txn.platformTxId);

          // Create a map of new win amounts by platformTxId
          const newWinAmountsMap = {};
          userTransactions.forEach((txn) => {
            newWinAmountsMap[txn.platformTxId] = txn.winAmount;
          });

          // Batch fetch existing transactions
          const [existingTransactions, existingReSettledTransactions] =
            await Promise.all([
              liveSexybcrtModal
                .find(
                  {
                    roundId: { $in: platformTxIds },
                    $or: [{ bet: true }, { settle: true }],
                  },
                  { roundId: 1, settleamount: 1 }
                )
                .lean(),
              liveSexybcrtModal
                .find(
                  { roundId: { $in: platformTxIds }, resettle: true },
                  { roundId: 1 }
                )
                .lean(),
            ]);

          // Create maps for faster lookup
          const transactionsMap = {};
          existingTransactions.forEach((txn) => {
            transactionsMap[txn.roundId] = {
              settleAmount: txn.settleamount || 0,
            };
          });

          const reSettledTransactionsMap = {};
          existingReSettledTransactions.forEach((txn) => {
            reSettledTransactionsMap[txn.roundId] = true;
          });

          let totalAdjustmentAmount = 0;
          const processedTxns = [];
          const transactionsToUpdate = [];

          // Process each transaction
          for (const platformTxId of platformTxIds) {
            // Skip already resettled transactions
            if (reSettledTransactionsMap[platformTxId]) {
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "Already processed",
              });
              continue;
            }

            // Get the existing transaction details
            const existingDetails = transactionsMap[platformTxId];
            if (!existingDetails) {
              console.log(
                `No existing transaction found for resettle action. platformTxId: ${platformTxId}`
              );
              processedTxns.push({
                platformTxId,
                status: "skipped",
                message: "No original transaction found",
              });
              continue;
            }

            // Calculate adjustment amount
            const oldWinAmount = existingDetails.settleAmount;
            const newWinAmount = newWinAmountsMap[platformTxId];
            const adjustmentAmount = newWinAmount - oldWinAmount;

            // Add to total adjustment and transactions to update
            totalAdjustmentAmount += adjustmentAmount;

            transactionsToUpdate.push({
              platformTxId,
              oldWinAmount: roundToTwoDecimals(oldWinAmount),
              newWinAmount: roundToTwoDecimals(newWinAmount),
              adjustmentAmount: roundToTwoDecimals(adjustmentAmount),
            });
          }

          // If there are transactions to process
          if (transactionsToUpdate.length > 0) {
            // Prepare bulk update operations
            const bulkOps = transactionsToUpdate.map((txn) => ({
              updateOne: {
                filter: { roundId: txn.platformTxId },
                update: {
                  $set: {
                    resettle: true,
                    settleamount: txn.newWinAmount,
                  },
                },
                upsert: true,
              },
            }));

            // Execute DB operations in parallel
            const [updatedUserBalance] = await Promise.all([
              User.findOneAndUpdate(
                { gameId: currentUser.gameId },
                { $inc: { wallet: roundToTwoDecimals(totalAdjustmentAmount) } },
                { new: true, projection: { wallet: 1 } }
              ).lean(),
              liveSexybcrtModal.bulkWrite(bulkOps),
            ]);

            // Prepare transaction results for response
            transactionsToUpdate.forEach((txn) => {
              processedTxns.push({
                platformTxId: txn.platformTxId,
                status: "success",
                oldWinAmount: txn.oldWinAmount,
                newWinAmount: txn.newWinAmount,
                adjustmentAmount: txn.adjustmentAmount,
              });
            });

            results.push({
              userId,
              status: "success",
              processedTxns,
              totalAdjustmentAmount: roundToTwoDecimals(totalAdjustmentAmount),
              updatedBalance: updatedUserBalance.wallet,
            });
          } else if (processedTxns.length > 0) {
            results.push({
              userId,
              status: "success",
              processedTxns,
              totalAdjustmentAmount: 0,
              message: "No balance adjustment needed",
            });
          }
        }

        // Return overall response
        return res
          .status(200)
          .json(createResponse("0000", "Success", { results }));
      }

      case "tip": {
        const tipTransaction = originalPayload.txns?.[0];
        if (!tipTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const { userId, tip, platformTxId } = tipTransaction;

        // Execute queries in parallel with field projection
        const [currentUser, existingTipTransaction] = await Promise.all([
          validateUser(userId),
          liveSexybcrtModal
            .findOne(
              {
                roundId: platformTxId,
              },
              { _id: 1 }
            )
            .lean(),
        ]);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        if (existingTipTransaction) {
          return res
            .status(200)
            .json(createResponse("0000", "Already processed", currentUser));
        }

        // Execute updates in parallel
        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            { $inc: { wallet: -roundToTwoDecimals(tip) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.create({
            username: currentUser.gameId,
            roundId: platformTxId,
            tip: true,
            betamount: roundToTwoDecimals(tip),
          }),
        ]);

        return res
          .status(200)
          .json(createResponse("0000", "Success", updatedUserBalance));
      }

      case "cancelTip": {
        const cancelTipTransaction = originalPayload.txns?.[0];
        if (!cancelTipTransaction) {
          return res
            .status(200)
            .json(createResponse("1036", "Invalid parameters"));
        }

        const { userId, platformTxId } = cancelTipTransaction;

        // Execute queries in parallel with field projection
        const [currentUser, existingTipTransaction] = await Promise.all([
          validateUser(userId),
          liveSexybcrtModal
            .findOne({ roundId: platformTxId, tip: true }, { betamount: 1 })
            .lean(),
        ]);

        if (!currentUser) {
          return res
            .status(200)
            .json(createResponse("1000", "Invalid user Id"));
        }

        // Calculate refund amount
        let refundAmount = 0;
        if (existingTipTransaction) {
          refundAmount += existingTipTransaction.betamount;
        }

        // Execute updates in parallel
        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: currentUser.gameId },
            { $inc: { wallet: roundToTwoDecimals(refundAmount) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveSexybcrtModal.findOneAndUpdate(
            { roundId: platformTxId },
            {
              $set: {
                tip: false,
                cancelTip: true,
                remark: "Tip has been cancelled",
              },
            },
            { upsert: true, new: true }
          ),
        ]);

        return res
          .status(200)
          .json(createResponse("0000", "Success", updatedUserBalance));
      }

      default:
        return res.status(400).json(createResponse("1036", "Invalid action"));
    }
  } catch (error) {
    console.error("SEXYBCRT Error in calling ae96 API:", error.message);
    return res.status(500).json({
      status: "9999",
      desc: "Fail",
    });
  }
});

router.post("/api/sexybcrt/getturnoverforrebate", async (req, res) => {
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

    console.log("SEXYBCRT QUERYING TIME", startDate, endDate);

    const records = await liveSexybcrtModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      platform: "SEXYBCRT",
      $and: [
        { $or: [{ cancel: false }, { cancel: { $exists: false } }] },
        { $or: [{ void: false }, { void: { $exists: false } }] },
        { $or: [{ refunded: false }, { refunded: { $exists: false } }] },
        { $or: [{ tip: false }, { tip: { $exists: false } }] },
      ],
      remark: { $ne: "Tip has been cancelled" },
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
        gamename: "SEXYBCRT",
        gamecategory: "Live Casino",
        users: playerSummary, // Return player summary for each user
      },
    });
  } catch (error) {
    console.log("SEXYBCRT: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      error: "SEXYBCRT: Failed to fetch win/loss report",
    });
  }
});

router.get(
  "/admin/api/sexybcrt/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await liveSexybcrtModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        platform: "SEXYBCRT",
        $and: [
          { $or: [{ cancel: false }, { cancel: { $exists: false } }] },
          { $or: [{ void: false }, { void: { $exists: false } }] },
          { $or: [{ refunded: false }, { refunded: { $exists: false } }] },
          { $or: [{ tip: false }, { tip: { $exists: false } }] },
        ],
        remark: { $ne: "Tip has been cancelled" },
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
          gamename: "SEXYBCRT",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("SEXYBCRT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "SEXYBCRT: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/sexybcrt/:userId/gamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await GameDataLog.find({
        username: user.username,
        date: {
          $gte: moment(new Date(startDate)).utc().format("YYYY-MM-DD"),
          $lte: moment(new Date(endDate)).utc().format("YYYY-MM-DD"),
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
          const horse = Object.fromEntries(gameCategories["Live Casino"]);

          if (horse["SEXYBCRT"]) {
            totalTurnover += horse["SEXYBCRT"].turnover || 0;
            totalWinLoss += horse["SEXYBCRT"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "SEXYBCRT",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("SEXYBCRT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "SEXYBCRT: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/sexybcrt/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await liveSexybcrtModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        platform: "SEXYBCRT",
        $and: [
          { $or: [{ cancel: false }, { cancel: { $exists: false } }] },
          { $or: [{ void: false }, { void: { $exists: false } }] },
          { $or: [{ refunded: false }, { refunded: { $exists: false } }] },
          { $or: [{ tip: false }, { tip: { $exists: false } }] },
        ],
        remark: { $ne: "Tip has been cancelled" },
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
          gamename: "SEXYBCRT",
          gamecategory: "Live Casino",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("SEXYBCRT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "SEXYBCRT: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/sexybcrt/kioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await GameDataLog.find({
        date: {
          $gte: moment(new Date(startDate)).utc().format("YYYY-MM-DD"),
          $lte: moment(new Date(endDate)).utc().format("YYYY-MM-DD"),
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
          const horse = Object.fromEntries(gameCategories["Live Casino"]);

          if (horse["SEXYBCRT"]) {
            totalTurnover += Number(horse["SEXYBCRT"].turnover || 0);
            totalWinLoss += Number(horse["SEXYBCRT"].winloss || 0);
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "SEXYBCRT",
          gamecategory: "Live Casino",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("SEXYBCRT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "SEXYBCRT: Failed to fetch win/loss report",
      });
    }
  }
);
module.exports = router;
