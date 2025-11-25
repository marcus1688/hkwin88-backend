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
const SlotKingMakerModal = require("../../models/slot_kingmaker.model");
const GameWalletLog = require("../../models/gamewalletlog.model");
const GameKingMakerGameModal = require("../../models/slot_kingmakerDatabase.model");

require("dotenv").config();

//Staging

const kingMakerSecret = process.env.KINGMAKER_SECRET;
const kingMakerID = "ezwin9";
const webURL = "https://www.ezwin9.com/";
const kingMakerAPIURL = "https://api.queenmakergames.co";
const kingMakerOpenGameURL = "https://lobby.queenmakergames.co";
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

function generateUniqueTransactionId(prefix) {
  const uuid = uuidv4().replace(/-/g, "");
  return `${prefix}-${uuid.substring(0, 40)}`;
}

const generateRandomCode = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
};

// router.post("/api/kingmaker/getprovidergamelist", async (req, res) => {
//   try {
//     const payload = {
//       lang: "en-US",
//       platformtype: 1,
//     };

//     // Make the API request
//     const response = await axios.get(`${kingMakerAPIURL}/api/games`, {
//       params: payload, // Query parameters go in params
//       headers: {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         "X-QM-ClientId": kingMakerID,
//         "X-QM-ClientSecret": kingMakerSecret,
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       gameLobby: response.data,
//       message: {
//         en: "Game launched successfully.",
//         zh: "游戏启动成功。",
//       },
//     });
//   } catch (error) {
//     console.log("KINGMAKER error in launching game", error.response.data);
//     return res.status(200).json({
//       success: false,
//       message: {
//         en: "KINGMAKER: Game launch failed. Please try again or customer service for assistance.",
//         zh: "KINGMAKER: 游戏启动失败，请重试或联系客服以获得帮助。",
//       },
//     });
//   }
// });

// router.post("/api/kingmaker/comparegames", async (req, res) => {
//   try {
//     // Get games from KingMaker API
//     const payload = {
//       lang: "en-US",
//       platformtype: 1,
//     };

//     console.log("Fetching games from KingMaker API...");

//     const response = await axios.get(`${kingMakerAPIURL}/api/games`, {
//       params: payload,
//       headers: {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         "X-QM-ClientId": kingMakerID,
//         "X-QM-ClientSecret": kingMakerSecret,
//       },
//     });

//     const apiGames = response.data.games;

//     if (!apiGames || apiGames.length === 0) {
//       return res.status(200).json({
//         success: false,
//         message: {
//           en: "No games found from KingMaker API",
//           zh: "从KingMaker API未找到游戏",
//         },
//       });
//     }

//     console.log(`Found ${apiGames.length} games from KingMaker API`);

//     // Get all games from database
//     const dbGames = await GameKingMakerGameModal.find(
//       {},
//       { gameID: 1, gameNameEN: 1, maintenance: 1 }
//     );
//     console.log(`Found ${dbGames.length} games in database`);

//     // Extract game codes from API
//     const apiGameCodes = apiGames.map((game) => game.code);
//     const dbGameIds = dbGames.map((game) => game.gameID);

//     console.log("Comparing games...");

//     // Find missing games (in API but not in database)
//     const missingGames = apiGames.filter(
//       (apiGame) => !dbGameIds.includes(apiGame.code)
//     );

//     // Find extra games (in database but not in API)
//     const extraGames = dbGames.filter(
//       (dbGame) => !apiGameCodes.includes(dbGame.gameID)
//     );

//     // Find existing games (in both API and database)
//     const existingGames = dbGames.filter((dbGame) =>
//       apiGameCodes.includes(dbGame.gameID)
//     );

//     console.log(`Missing games: ${missingGames.length}`);
//     console.log(`Extra games: ${extraGames.length}`);
//     console.log(`Existing games: ${existingGames.length}`);

//     // Update maintenance status
//     let maintenanceUpdated = 0;

//     // Set maintenance = true for extra games (games in DB but not in API)
//     if (extraGames.length > 0) {
//       console.log("Setting maintenance = true for extra games...");

//       const extraGameIds = extraGames.map((game) => game._id);
//       const extraUpdateResult = await GameKingMakerGameModal.updateMany(
//         { _id: { $in: extraGameIds } },
//         { $set: { maintenance: true } }
//       );

//       console.log(
//         `Set maintenance = true for ${extraUpdateResult.modifiedCount} extra games`
//       );
//       maintenanceUpdated += extraUpdateResult.modifiedCount;
//     }

//     // Set maintenance = false for existing games (games in both DB and API)
//     if (existingGames.length > 0) {
//       console.log("Setting maintenance = false for existing games...");

//       const existingGameIds = existingGames.map((game) => game._id);
//       const existingUpdateResult = await GameKingMakerGameModal.updateMany(
//         { _id: { $in: existingGameIds } },
//         { $set: { maintenance: false } }
//       );

//       console.log(
//         `Set maintenance = false for ${existingUpdateResult.modifiedCount} existing games`
//       );
//       maintenanceUpdated += existingUpdateResult.modifiedCount;
//     }

//     // Prepare response data
//     const missingGameCodes = missingGames.map((game) => ({
//       code: game.code,
//       name: game.name,
//       externalId: game.externalid,
//       description: game.description,
//     }));

//     const extraGameDetails = extraGames.map((game) => ({
//       gameID: game.gameID,
//       gameNameEN: game.gameNameEN,
//       maintenanceStatus: true, // Will be set to true
//     }));

//     const existingGameDetails = existingGames.map((game) => ({
//       gameID: game.gameID,
//       gameNameEN: game.gameNameEN,
//       maintenanceStatus: false, // Will be set to false
//     }));

//     // Log examples
//     console.log("\n=== COMPARISON SUMMARY ===");
//     console.log(`Total API games: ${apiGames.length}`);
//     console.log(`Total DB games: ${dbGames.length}`);
//     console.log(`Missing from DB: ${missingGames.length}`);
//     console.log(`Extra in DB: ${extraGames.length}`);
//     console.log(`Existing in both: ${existingGames.length}`);
//     console.log(`Maintenance status updated: ${maintenanceUpdated}`);

//     if (missingGames.length > 0) {
//       console.log("\n=== MISSING GAMES (First 5) ===");
//       missingGames.slice(0, 5).forEach((game) => {
//         console.log(`- Code: ${game.code}, Name: ${game.name}`);
//       });
//     }

//     if (extraGames.length > 0) {
//       console.log("\n=== EXTRA GAMES (First 5) ===");
//       extraGames.slice(0, 5).forEach((game) => {
//         console.log(
//           `- GameID: ${game.gameID}, Name: ${game.gameNameEN} -> maintenance = true`
//         );
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: {
//         en: `Comparison completed. Found ${missingGames.length} missing games, ${extraGames.length} extra games. Updated maintenance status for ${maintenanceUpdated} games.`,
//         zh: `比较完成。发现 ${missingGames.length} 个缺失游戏，${extraGames.length} 个额外游戏。更新了 ${maintenanceUpdated} 个游戏的维护状态。`,
//       },
//       summary: {
//         totalApiGames: apiGames.length,
//         totalDbGames: dbGames.length,
//         missingGamesCount: missingGames.length,
//         extraGamesCount: extraGames.length,
//         existingGamesCount: existingGames.length,
//         maintenanceUpdatedCount: maintenanceUpdated,
//       },
//       missingGames: missingGameCodes, // Games in API but not in DB
//       extraGames: extraGameDetails.slice(0, 20), // First 20 extra games (in DB but not in API)
//       existingGames: existingGameDetails.slice(0, 10), // First 10 existing games (for reference)
//       actions: {
//         missingGames:
//           "These games exist in KingMaker API but not in your database",
//         extraGames:
//           "These games exist in your database but not in KingMaker API - maintenance set to true",
//         existingGames: "These games exist in both - maintenance set to false",
//       },
//     });
//   } catch (error) {
//     console.error("Error comparing KingMaker games:", error);

//     return res.status(500).json({
//       success: false,
//       message: {
//         en: "Failed to compare games",
//         zh: "比较游戏失败",
//       },
//       error: error.message,
//     });
//   }
// });

// router.post("/api/kingmaker/syncgames/direct", async (req, res) => {
//   try {
//     // Get games from API
//     const payload = {
//       lang: "en-US",
//       platformtype: 1,
//     };

//     const response = await axios.get(`${kingMakerAPIURL}/api/games`, {
//       params: payload,
//       headers: {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         "X-QM-ClientId": kingMakerID,
//         "X-QM-ClientSecret": kingMakerSecret,
//       },
//     });

//     const apiGames = response.data.games;

//     if (!apiGames || apiGames.length === 0) {
//       return res.status(200).json({
//         success: false,
//         message: {
//           en: "No games found from KingMaker API",
//           zh: "从KingMaker API未找到游戏",
//         },
//       });
//     }

//     console.log(`Found ${apiGames.length} games from KingMaker API`);

//     const now = moment().utc();
//     let updatedCount = 0;

//     // Use direct collection access to bypass all mongoose middleware
//     const collection = GameKingMakerGameModal.collection;

//     // Process each game
//     for (let i = 0; i < apiGames.length; i++) {
//       const apiGame = apiGames[i];
//       const gameCode = apiGame.code;
//       const createdAtTime = moment(now)
//         .subtract(i * 30, "minutes")
//         .toDate();

//       try {
//         // Direct MongoDB update bypassing mongoose completely
//         const result = await collection.updateOne(
//           { gameID: gameCode },
//           {
//             $set: {
//               createdAt: createdAtTime,
//             },
//           }
//         );

//         if (result.matchedCount > 0) {
//           updatedCount++;
//           console.log(
//             `✅ Direct update: ${gameCode} -> ${moment(createdAtTime).format(
//               "YYYY-MM-DD HH:mm:ss"
//             )} UTC`
//           );
//         } else {
//           console.log(`❌ Not found: ${gameCode}`);
//         }
//       } catch (updateError) {
//         console.error(`Error updating ${gameCode}:`, updateError.message);
//       }
//     }

//     console.log(`\nDirect update completed: ${updatedCount} games updated`);

//     return res.status(200).json({
//       success: true,
//       message: {
//         en: `Direct update completed: ${updatedCount} games updated out of ${apiGames.length} total`,
//         zh: `直接更新完成：${updatedCount} 个游戏已更新，总共 ${apiGames.length} 个`,
//       },
//       summary: {
//         totalApiGames: apiGames.length,
//         updatedGames: updatedCount,
//       },
//       examples: apiGames.slice(0, 5).map((game, index) => ({
//         gameID: game.code,
//         gameName: game.name,
//         createdAt:
//           moment(now)
//             .subtract(index * 30, "minutes")
//             .format("YYYY-MM-DD HH:mm:ss") + " UTC",
//       })),
//     });
//   } catch (error) {
//     console.error("Error in direct update:", error);

//     return res.status(500).json({
//       success: false,
//       message: {
//         en: "Failed to directly update games",
//         zh: "直接更新游戏失败",
//       },
//       error: error.message,
//     });
//   }
// });

router.post("/api/kingmaker/getgamelist", async (req, res) => {
  try {
    const games = await GameKingMakerGameModal.find({
      $and: [
        {
          $or: [{ maintenance: false }, { maintenance: { $exists: false } }],
        },
        {
          imageUrlEN: { $exists: true, $ne: null, $ne: "" },
        },
      ],
    }).sort({
      hot: -1,
      createdAt: -1,
    });

    if (!games || games.length === 0) {
      return res.status(200).json({
        success: false,
        message: {
          en: "No games found. Please try again later.",
          zh: "未找到游戏。请稍后再试。",
          ms: "Tiada permainan ditemui. Sila cuba lagi kemudian.",
          zh_hk: "搵唔到遊戲。老闆麻煩再試下或者聯絡客服。",
          id: "Tidak ada permainan ditemukan. Silakan coba lagi nanti.",
        },
      });
    }

    // Transform data into the desired format
    const reformattedGamelist = games.map((game) => ({
      GameCode: game.gameID,
      GameNameEN: game.gameNameEN,
      GameNameZH: game.gameNameCN,
      GameNameHK: game.gameNameHK,
      GameType: game.gameType,
      GameImage: game.imageUrlEN || "",
      GameImageZH: game.imageUrlCN || "",
      GameImageID: game.imageUrlID || "",
      Hot: game.hot || false,
      RTP: game.rtpRate,
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.log("KINGMAKER error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "KINGMAKER: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "KINGMAKER: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "KINGMAKER: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "KINGMAKER: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "KINGMAKER: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post(
  "/api/kingmaker/launchGame",
  authenticateToken,
  async (req, res) => {
    try {
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

      if (user.gameLock.kingmaker.lock) {
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

      let clientIp = req.headers["x-forwarded-for"] || req.ip;
      clientIp = clientIp.split(",")[0].trim();

      const { gameLang, gameCode, isDouble, clientPlatform } = req.body;

      let lang = "zh-CN";

      if (gameLang === "en") {
        lang = "en-US";
      } else if (gameLang === "zh") {
        lang = "zh-CN";
      } else if (gameLang === "zh_hk") {
        lang = "zh-CN";
      } else if (gameLang === "ms") {
        lang = "en-US";
      } else if (gameLang === "id") {
        lang = "id-ID";
      }

      let playerId;
      if (isDouble === true) {
        playerId = `${user.gameId}2X`;
      } else {
        playerId = `${user.gameId}`;
      }

      let platform = 1;
      if (clientPlatform === "web") {
        platform = 0;
      } else if (clientPlatform === "mobile") {
        platform = 1;
      }

      const payload = {
        ipaddress: clientIp,
        username: user.username,
        userid: playerId,
        lang: lang,
        cur: "HKD",
        betlimitid: 2,
        istestplayer: false,
        platformtype: platform,
        loginurl: webURL,
        cashierurl: cashierURL,
      };

      // Make the API request
      const response = await axios.post(
        `${kingMakerAPIURL}/api/player/authorize`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-QM-ClientId": kingMakerID,
            "X-QM-ClientSecret": kingMakerSecret,
          },
        }
      );

      if (!response.data.authtoken) {
        console.log("KINGMAKER launch game error", response.data);
        return res.status(200).json({
          success: false,
          message: {
            en: "KINGMAKER: Game launch failed. Please try again or customer service for assistance.",
            zh: "KINGMAKER: 游戏启动失败，请重试或联系客服以获得帮助。",
            ms: "KINGMAKER: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "KINGMAKER: 遊戲開唔到，老闆試多次或者搵客服幫手。",
            id: "KINGMAKER: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      const fullGameUrl = `${kingMakerOpenGameURL}/gamelauncher?gpcode=KMQM&gcode=${gameCode}&token=${response.data.authtoken}&lang=${lang}`;

      const gameName = isDouble === true ? "KINGMAKER 2X" : "KINGMAKER";

      await GameWalletLogAttempt(
        user.username,
        "Transfer In",
        "Seamless",
        roundToTwoDecimals(user.wallet),
        gameName
      );

      return res.status(200).json({
        success: true,
        gameLobby: fullGameUrl,
        message: {
          en: "Game launched successfully.",
          zh: "游戏启动成功。",
          ms: "Permainan berjaya dimulakan.",
          zh_hk: "遊戲啟動成功。",
          id: "Permainan berhasil diluncurkan.",
        },
      });
    } catch (error) {
      console.log("KINGMAKER error in launching game", error);
      return res.status(200).json({
        success: false,
        message: {
          en: "KINGMAKER: Game launch failed. Please try again or customer service for assistance.",
          zh: "KINGMAKER: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "KINGMAKER: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "KINGMAKER: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "KINGMAKER: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }
  }
);

router.post("/api/prodkingmaker/wallet/balance", async (req, res) => {
  try {
    const clientSecret = req.headers["x-qm-clientsecret"];
    const clientId = req.headers["x-qm-clientid"];

    if (clientSecret !== kingMakerSecret || clientId !== kingMakerID) {
      return res.status(200).json({
        err: 30,
        errdesc: "Invalid Credential",
      });
    }

    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(200).json({
        err: 300,
        errdesc: "Invalid arguments: users is missing",
      });
    }

    const userResponses = await Promise.all(
      users.map(async (user) => {
        const { userid, brandcode, cur } = user;

        if (!userid) {
          return {
            err: 300,
            errdesc: "Invalid arguments: userid is missing",
          };
        }

        const isDoubleBetting = userid.endsWith("2X");
        const actualGameId = isDoubleBetting ? userid.slice(0, -2) : userid;

        try {
          const userRecord = await User.findOne(
            { gameId: actualGameId },
            { wallet: 1, _id: 1 }
          ).lean();
          if (!userRecord) {
            return {
              userid: userid,
              err: 300,
              errdesc: "User not found",
            };
          }

          const actualAmount = isDoubleBetting
            ? userRecord.wallet * 0.5
            : userRecord.wallet;

          return {
            userid,
            wallets: [
              {
                code: "MainWallet",
                bal: roundToTwoDecimals(actualAmount),
                cur: "HKD",
              },
            ],
          };
        } catch (error) {
          console.error(`Error processing user ${userid}:`, error);
          return {
            userid,
            err: 900,
            errdesc: "System error while fetching user balance",
          };
        }
      })
    );

    return res.status(200).json({
      users: userResponses,
    });
  } catch (error) {
    console.error(
      "KINGMAKER: Error in game provider calling ae96 get balance api:",
      error.message
    );
    return res.status(200).json({
      err: 900,
      errdesc: "System Error: Unable to obtain balance",
    });
  }
});

router.post("/api/prodkingmaker/wallet/debit", async (req, res) => {
  try {
    // Credential validation
    const clientSecret = req.headers["x-qm-clientsecret"];
    const clientId = req.headers["x-qm-clientid"];

    if (clientSecret !== kingMakerSecret || clientId !== kingMakerID) {
      return res.status(200).json({
        err: 30,
        errdesc: "Invalid Credential",
      });
    }

    const { transactional, transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(200).json({
        err: 300,
        errdesc: "Invalid arguments: transactions are missing",
      });
    }

    const responseTransactions = [];
    const allPtxIds = transactions.map((tx) => tx.ptxid).filter(Boolean);
    const existingTransactionsMap = {};

    if (allPtxIds.length > 0) {
      const existingTransactions = await SlotKingMakerModal.find(
        { betId: { $in: allPtxIds } },
        { betId: 1, opBetId: 1 }
      ).lean();

      existingTransactions.forEach((tx) => {
        existingTransactionsMap[tx.betId] = tx.opBetId;
      });
    }

    let transactionalError = null; // Track the first error for transactional mode

    for (const tx of transactions) {
      const operatorTransactionID = generateUniqueTransactionId("bet");
      const {
        userid,
        amt,
        cur,
        ptxid,
        txtype,
        walletcode,
        isbuyingame,
        gamecode,
      } = tx;

      if (!userid || !ptxid || !txtype) {
        const error = {
          ptxid,
          err: 300,
          errdesc: "Invalid arguments in transaction",
        };
        responseTransactions.push(error);

        if (transactional) {
          transactionalError = error;
          break;
        }
        continue;
      }

      try {
        // Check for existing transaction using the pre-fetched map
        if (existingTransactionsMap[ptxid]) {
          const isDoubleBetting = userid.endsWith("2X");
          const actualGameId = isDoubleBetting ? userid.slice(0, -2) : userid;

          const userWallet = await User.findOne(
            { gameId: actualGameId },
            { wallet: 1, _id: 1 }
          ).lean();

          const actualAmount = isDoubleBetting
            ? userWallet.wallet * 0.5
            : userWallet.wallet;

          responseTransactions.push({
            txid: existingTransactionsMap[ptxid],
            ptxid,
            bal: roundToTwoDecimals(actualAmount),
            cur: "HKD",
            dup: true,
          });
          continue;
        }

        const isDoubleBetting = userid.endsWith("2X");
        const actualGameId = isDoubleBetting ? userid.slice(0, -2) : userid;

        const userRecord = await User.findOne(
          { gameId: actualGameId },
          { username: 1, wallet: 1, "gameLock.kingmaker.lock": 1 }
        ).lean();

        if (!userRecord) {
          const error = {
            ptxid,
            err: 300,
            errdesc: "User not found",
          };
          responseTransactions.push(error);

          if (transactional) {
            transactionalError = error;
            break;
          }
          continue;
        }

        if (userRecord.gameLock?.kingmaker?.lock) {
          const error = {
            ptxid,
            err: 20,
            errdesc: "Account banned",
          };
          responseTransactions.push(error);

          if (transactional) {
            transactionalError = error;
            break;
          }
          continue;
        }

        const actualBetAmt = isDoubleBetting
          ? roundToTwoDecimals(amt) * 2
          : roundToTwoDecimals(amt);

        if (isbuyingame) {
          if (txtype === 500) {
            await SlotKingMakerModal.create({
              username: userid,
              opBetId: operatorTransactionID,
              betamount: actualBetAmt,
              betId: ptxid,
              bet: true,
            });

            const actualAmount = isDoubleBetting
              ? userRecord.wallet * 0.5
              : userRecord.wallet;

            responseTransactions.push({
              txid: operatorTransactionID,
              ptxid,
              bal: roundToTwoDecimals(actualAmount),
              cur: "HKD",
              dup: false,
            });
          } else if (txtype >= 600 && txtype <= 611) {
            const updatedUserBalance = await User.findOneAndUpdate(
              {
                gameId: actualGameId,
                wallet: { $gte: actualBetAmt },
              },
              { $inc: { wallet: -actualBetAmt } },
              { new: true, projection: { wallet: 1 } }
            ).lean();

            if (!updatedUserBalance) {
              const error = {
                ptxid,
                err: 100,
                errdesc: "Insufficient funds",
              };
              responseTransactions.push(error);

              if (transactional) {
                transactionalError = error;
                break;
              }
              continue;
            }

            await SlotKingMakerModal.create({
              username: userid,
              opBetId: operatorTransactionID,
              betamount: actualBetAmt,
              betId: ptxid,
              bet: true,
            });

            const actualAmount = isDoubleBetting
              ? updatedUserBalance.wallet * 0.5
              : updatedUserBalance.wallet;

            responseTransactions.push({
              txid: operatorTransactionID,
              ptxid,
              bal: roundToTwoDecimals(actualAmount),
              cur: "HKD",
              dup: false,
            });
          }
        } else {
          const updatedUserBalance = await User.findOneAndUpdate(
            {
              gameId: actualGameId,
              wallet: { $gte: actualBetAmt },
            },
            { $inc: { wallet: -actualBetAmt } },
            { new: true, projection: { wallet: 1 } }
          ).lean();

          if (!updatedUserBalance) {
            const error = {
              ptxid,
              err: 100,
              errdesc: "Insufficient funds",
            };
            responseTransactions.push(error);

            if (transactional) {
              transactionalError = error;
              break;
            }
            continue;
          }

          await SlotKingMakerModal.create({
            username: userid,
            opBetId: operatorTransactionID,
            betamount: actualBetAmt,
            betId: ptxid,
            bet: true,
          });

          const actualAmount = isDoubleBetting
            ? updatedUserBalance.wallet * 0.5
            : updatedUserBalance.wallet;

          responseTransactions.push({
            txid: operatorTransactionID,
            ptxid,
            bal: roundToTwoDecimals(actualAmount),
            cur: "HKD",
            dup: false,
          });
        }
      } catch (error) {
        console.error(`Error processing transaction ${ptxid}:`, error.message);
        const transactionError = {
          ptxid,
          err: 900,
          errdesc: "System error while processing transaction",
        };
        responseTransactions.push(transactionError);

        if (transactional) {
          transactionalError = transactionError;
          break;
        }
      }
    }

    // Handle transactional mode errors
    if (transactional && transactionalError) {
      return res.status(200).json({
        err: transactionalError.err,
        errdesc: transactionalError.errdesc,
        transactions: [],
      });
    }

    return res.status(200).json({
      transactions: responseTransactions,
    });
  } catch (error) {
    console.error(
      "KINGMAKER: Error in game provider calling ae96 debit api:",
      error.message
    );
    return res.status(200).json({
      err: 900,
      errdesc: "System Error: Unable to obtain balance",
      transactions: [],
    });
  }
});

router.post("/api/prodkingmaker/wallet/credit", async (req, res) => {
  try {
    const clientSecret = req.headers["x-qm-clientsecret"];
    const clientId = req.headers["x-qm-clientid"];

    // Credential Validation
    if (clientSecret !== kingMakerSecret || clientId !== kingMakerID) {
      return res.status(200).json({
        err: 30,
        errdesc: "Invalid Credential",
      });
    }

    const { transactions } = req.body;

    // Validate 'transactions' array
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(200).json({
        err: 300,
        errdesc: "Invalid arguments: transactions are missing",
      });
    }

    const responseTransactions = [];
    const allPtxIds = transactions.map((tx) => tx.ptxid).filter(Boolean);
    const allRefPtxIds = transactions
      .map((tx) => tx.refptxid || tx.roundid)
      .filter(Boolean);

    // Batch fetch existing transactions
    const [settledTransactions, existingBetTransactions] = await Promise.all([
      allPtxIds.length > 0
        ? SlotKingMakerModal.find(
            { betId: { $in: allPtxIds }, settle: true },
            { betId: 1, opSettleId: 1 }
          ).lean()
        : [],
      allRefPtxIds.length > 0
        ? SlotKingMakerModal.find(
            { betId: { $in: allRefPtxIds }, bet: true },
            { betId: 1 }
          ).lean()
        : [],
    ]);

    const settledTransactionsMap = {};
    const existingBetTransactionsMap = {};

    settledTransactions.forEach((tx) => {
      settledTransactionsMap[tx.betId] = tx.opSettleId;
    });

    existingBetTransactions.forEach((tx) => {
      existingBetTransactionsMap[tx.betId] = true;
    });

    for (const tx of transactions) {
      const operatorTransactionID = generateUniqueTransactionId("settle");
      const {
        userid,
        amt,
        ptxid,
        txtype,
        refptxid,
        turnover,
        isbuyingame,
        gamecode,
        roundid,
      } = tx;

      if (!userid || !ptxid || !txtype) {
        responseTransactions.push({
          ptxid,
          err: 300,
          errdesc: "Invalid arguments in transaction",
        });
        continue;
      }

      try {
        const isDoubleBetting = userid.endsWith("2X");
        const actualGameId = isDoubleBetting ? userid.slice(0, -2) : userid;

        // Check for existing settled transaction using the pre-fetched map
        if (settledTransactionsMap[ptxid]) {
          // Only fetch user if needed - for duplicate transactions
          const userWallet = await User.findOne(
            { gameId: actualGameId },
            { wallet: 1, _id: 1 }
          ).lean();

          const actualAmount = isDoubleBetting
            ? userWallet.wallet * 0.5
            : userWallet.wallet;

          responseTransactions.push({
            txid: settledTransactionsMap[ptxid],
            ptxid,
            bal: roundToTwoDecimals(actualAmount),
            cur: "HKD",
            dup: true,
          });
          continue;
        }

        // Find user with lean query and minimal fields
        const userRecord = await User.findOne(
          { gameId: actualGameId },
          { username: 1, wallet: 1, _id: 1 }
        ).lean();

        if (!userRecord) {
          responseTransactions.push({
            ptxid,
            err: 300,
            errdesc: "User not found",
          });
          continue;
        }

        const actualWinAmt = isDoubleBetting
          ? roundToTwoDecimals(amt) * 2
          : roundToTwoDecimals(amt);

        if (isbuyingame) {
          if (txtype === 510 || txtype === 520) {
            await SlotKingMakerModal.create({
              username: userid,
              settleamount: actualWinAmt,
              opSettleId: operatorTransactionID,
              betId: ptxid,
              settle: true,
            });

            const actualAmount = isDoubleBetting
              ? (userRecord?.wallet || 0) * 0.5
              : userRecord?.wallet || 0;

            responseTransactions.push({
              txid: operatorTransactionID,
              ptxid,
              bal: roundToTwoDecimals(actualAmount),
              cur: "HKD",
              dup: false,
            });
          } else if (txtype === 600 || txtype === 611) {
            if (txtype === 611) {
              const actualAmount = isDoubleBetting
                ? (userRecord?.wallet || 0) * 0.5
                : userRecord?.wallet || 0;

              const refId = refptxid || roundid;
              if (!existingBetTransactionsMap[refId]) {
                responseTransactions.push({
                  txid: operatorTransactionID,
                  ptxid,
                  err: 600,
                  errdesc: "Referenced transaction does not exist",
                  bal: roundToTwoDecimals(actualAmount),
                  cur: "HKD",
                  dup: false,
                });
                continue;
              }
            }

            // Execute updates in parallel
            const [updatedUserBalance] = await Promise.all([
              User.findOneAndUpdate(
                { gameId: actualGameId },
                { $inc: { wallet: actualWinAmt } },
                { new: true, projection: { wallet: 1 } }
              ).lean(),

              SlotKingMakerModal.create({
                username: userid,
                settleamount: actualWinAmt,
                opSettleId: operatorTransactionID,
                betId: ptxid,
                settle: true,
              }),
            ]);

            const actualAmount = isDoubleBetting
              ? updatedUserBalance.wallet * 0.5
              : updatedUserBalance.wallet;

            responseTransactions.push({
              txid: operatorTransactionID,
              ptxid,
              bal: roundToTwoDecimals(actualAmount),
              cur: "HKD",
              dup: false,
            });
          }
        } else {
          if (txtype !== 530) {
            const refId = refptxid || roundid;
            if (!existingBetTransactionsMap[refId]) {
              responseTransactions.push({
                ptxid,
                txid: operatorTransactionID,
                err: 600,
                errdesc: "Referenced transaction does not exist",
              });
              continue;
            }
          }

          // Execute updates in parallel
          const [updatedUserBalance] = await Promise.all([
            User.findOneAndUpdate(
              { gameId: actualGameId },
              { $inc: { wallet: actualWinAmt } },
              { new: true, projection: { wallet: 1 } }
            ).lean(),

            SlotKingMakerModal.create({
              username: userid,
              settleamount: actualWinAmt,
              opSettleId: operatorTransactionID,
              betId: ptxid,
              settle: true,
            }),
          ]);

          const actualAmount = isDoubleBetting
            ? updatedUserBalance.wallet * 0.5
            : updatedUserBalance.wallet;

          responseTransactions.push({
            txid: operatorTransactionID,
            ptxid,
            bal: roundToTwoDecimals(actualAmount),
            cur: "HKD",
            dup: false,
          });
        }
      } catch (error) {
        console.error(
          `Error processing credit transaction ${ptxid}:`,
          error.message
        );

        responseTransactions.push({
          ptxid,
          err: 900,
          errdesc: "System error while processing transaction",
        });
      }
    }

    return res.status(200).json({
      transactions: responseTransactions,
    });
  } catch (error) {
    console.error("KINGMAKER: Error in wallet credit API:", error.message);
    return res.status(200).json({
      err: 900,
      errdesc: "System Error: Unable to process request",
      transactions: [],
    });
  }
});

router.post("/api/prodkingmaker/wallet/reward", async (req, res) => {
  try {
    const clientSecret = req.headers["x-qm-clientsecret"];
    const clientId = req.headers["x-qm-clientid"];

    // Credential Validation
    if (clientSecret !== kingMakerSecret || clientId !== kingMakerID) {
      return res.status(200).json({
        err: 30,
        errdesc: "Invalid Credential",
      });
    }

    const { transactions } = req.body;

    // Validate 'transactions' array
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(200).json({
        err: 300,
        errdesc: "Invalid arguments: transactions are missing",
      });
    }

    const responseTransactions = [];
    const allPtxIds = transactions.map((tx) => tx.ptxid).filter(Boolean);
    const settledTransactionsMap = {};

    // Batch fetch existing transactions
    if (allPtxIds.length > 0) {
      const settledTransactions = await SlotKingMakerModal.find(
        { betId: { $in: allPtxIds }, settle: true },
        { betId: 1, opSettleId: 1 }
      ).lean();

      settledTransactions.forEach((tx) => {
        settledTransactionsMap[tx.betId] = tx.opSettleId;
      });
    }

    for (const tx of transactions) {
      const operatorTransactionID = generateUniqueTransactionId("reward");
      const { userid, amt, ptxid } = tx;

      if (!userid || !ptxid) {
        responseTransactions.push({
          ptxid,
          err: 300,
          errdesc: "Invalid arguments in transaction",
        });
        continue;
      }

      try {
        const isDoubleBetting = userid.endsWith("2X");
        const actualGameId = isDoubleBetting ? userid.slice(0, -2) : userid;

        // Check for existing settled transaction using the pre-fetched map
        if (settledTransactionsMap[ptxid]) {
          // Only fetch user if needed - for duplicate transactions
          const userWallet = await User.findOne(
            { gameId: actualGameId },
            { wallet: 1, _id: 1 }
          ).lean();

          const actualAmount = isDoubleBetting
            ? userWallet.wallet * 0.5
            : userWallet.wallet;

          responseTransactions.push({
            txid: settledTransactionsMap[ptxid],
            bal: roundToTwoDecimals(actualAmount),
            ptxid,
            dup: true,
          });
          continue;
        }

        // Find user with lean query and minimal fields
        const userRecord = await User.findOne(
          { gameId: actualGameId },
          { username: 1, wallet: 1 }
        ).lean();

        if (!userRecord) {
          responseTransactions.push({
            ptxid,
            err: 300,
            errdesc: "User not found",
          });
          continue;
        }

        const actualWinAmt = isDoubleBetting
          ? roundToTwoDecimals(amt) * 2
          : roundToTwoDecimals(amt);

        // Execute updates in parallel
        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: actualGameId },
            { $inc: { wallet: actualWinAmt } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          SlotKingMakerModal.create({
            username: userid,
            settleamount: actualWinAmt,
            opSettleId: operatorTransactionID,
            betId: ptxid,
            settle: true,
          }),
        ]);

        const actualAmount = isDoubleBetting
          ? updatedUserBalance.wallet * 0.5
          : updatedUserBalance.wallet;

        responseTransactions.push({
          txid: operatorTransactionID,
          ptxid,
          bal: roundToTwoDecimals(actualAmount),
          cur: "HKD",
          dup: false,
        });
      } catch (error) {
        console.error(
          `Error processing reward transaction ${ptxid}:`,
          error.message
        );

        responseTransactions.push({
          ptxid,
          err: 900,
          errdesc: "System error while processing transaction",
        });
      }
    }

    return res.status(200).json({
      transactions: responseTransactions,
    });
  } catch (error) {
    console.error("KINGMAKER: Error in wallet reward API:", error.message);
    return res.status(200).json({
      err: 900,
      errdesc: "System Error: Unable to process request",
      transactions: [],
    });
  }
});

router.post("/api/kingmaker/getturnoverforrebate", async (req, res) => {
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

    console.log("KINGMAKER QUERYING TIME", startDate, endDate);

    const records = await SlotKingMakerModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      username: { $not: /2X$/ },
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
        console.warn(`KINGMAKER User not found for gameId: ${gameId}`);
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
        gamename: "KINGMAKER",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("KINGMAKER: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "KINGMAKER: Failed to fetch win/loss report",
        zh: "KINGMAKER: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/kingmaker2x/getturnoverforrebate", async (req, res) => {
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

    console.log("KINGMAKER QUERYING TIME", startDate, endDate);

    const records = await SlotKingMakerModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      username: /2X$/,
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
        console.warn(`KINGMAKER2x User not found for gameId: ${gameId}`);
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
        gamename: "KINGMAKER2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("KINGMAKER: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "KINGMAKER: Failed to fetch win/loss report",
        zh: "KINGMAKER: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/kingmaker/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotKingMakerModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
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
          gamename: "KINGMAKER",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KINGMAKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kingmaker2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotKingMakerModal.find({
        username: `${user.gameId}2X`,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
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
          gamename: "KINGMAKER2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KINGMAKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kingmaker/:userId/gamedata",
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

          if (slotGames["KINGMAKER"]) {
            totalTurnover += slotGames["KINGMAKER"].turnover || 0;
            totalWinLoss += slotGames["KINGMAKER"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KINGMAKER",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KINGMAKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kingmaker2x/:userId/gamedata",
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

          if (slotGames["KINGMAKER2X"]) {
            totalTurnover += slotGames["KINGMAKER2X"].turnover || 0;
            totalWinLoss += slotGames["KINGMAKER2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KINGMAKER2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("KINGMAKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kingmaker/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotKingMakerModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        username: { $not: /2X$/ },
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
          gamename: "KINGMAKER",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KINGMAKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kingmaker2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotKingMakerModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        username: /2X$/,
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
          gamename: "KINGMAKER2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KINGMAKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kingmaker/kioskreport",
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

          if (liveCasino["KINGMAKER"]) {
            totalTurnover += Number(liveCasino["KINGMAKER"].turnover || 0);
            totalWinLoss += Number(liveCasino["KINGMAKER"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KINGMAKER",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KINGMAKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/kingmaker2x/kioskreport",
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

          if (liveCasino["KINGMAKER2X"]) {
            totalTurnover += Number(liveCasino["KINGMAKER2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["KINGMAKER2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "KINGMAKER2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("KINGMAKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "KINGMAKER: Failed to fetch win/loss report",
          zh: "KINGMAKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

module.exports = router;
