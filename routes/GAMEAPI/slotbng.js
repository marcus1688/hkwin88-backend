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
const jwt = require("jsonwebtoken");
const moment = require("moment");
const GameWalletLog = require("../../models/gamewalletlog.model");
const Decimal = require("decimal.js");
const GameBNGGameModal = require("../../models/slot_bngDatabase.model");
const SlotBNGModal = require("../../models/slot_bng.model");

require("dotenv").config();

const webURL = "https://www.ezwin9.com/";
const bngAPIURL = "https://gate.c3.bng.games/op/";
const bngSecret = process.env.BNG_SECRET;
const bngProjectName = "ezwin9";
const cashierURL = "https://www.ezwin9.com/deposit";
const brandName = "EZWIN9";

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

function getCurrentFormattedDate() {
  return moment.utc().format("YYYY-MM-DD HH:mm:ss");
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

// router.post("/api/bng/compare-and-sync-games", async (req, res) => {
//   try {
//     console.log("🔄 Starting BNG games comparison and sync...");

//     // Get games from BNG API
//     const requestPayload = {
//       api_token: bngSecret,
//     };

//     const response = await axios.post(
//       `${bngAPIURL}/${bngProjectName}/api/v1/game/list/`,
//       requestPayload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//         timeout: 30000,
//       }
//     );

//     if (!response.data || !response.data.items) {
//       throw new Error("No game data received from BNG API");
//     }

//     const apiGames = response.data.items;
//     console.log(`📊 Found ${apiGames.length} games from BNG API`);

//     // Get all games from your database
//     const dbGames = await GameBNGGameModal.find(
//       {},
//       {
//         gameID: 1,
//         gameNameEN: 1,
//         maintenance: 1,
//         hot: 1,
//         _id: 1,
//       }
//     );

//     console.log(`📊 Found ${dbGames.length} games in database`);

//     // Create sets for comparison
//     const apiGameIds = new Set(apiGames.map((game) => game.game_id));
//     const dbGameIds = new Set(dbGames.map((game) => game.gameID));

//     console.log(
//       `🎯 API Game IDs:`,
//       Array.from(apiGameIds).slice(0, 10).join(", "),
//       "..."
//     );
//     console.log(
//       `🎯 DB Game IDs:`,
//       Array.from(dbGameIds).slice(0, 10).join(", "),
//       "..."
//     );

//     // Find missing games (in API but not in DB)
//     const missingGames = apiGames.filter(
//       (apiGame) => !dbGameIds.has(apiGame.game_id)
//     );

//     // Find extra games (in DB but not in API)
//     const extraGames = dbGames.filter(
//       (dbGame) => !apiGameIds.has(dbGame.gameID)
//     );

//     // Find existing games (in both API and DB)
//     const existingGames = dbGames.filter((dbGame) =>
//       apiGameIds.has(dbGame.gameID)
//     );

//     console.log(`📈 Missing games (in API, not in DB): ${missingGames.length}`);
//     console.log(`📉 Extra games (in DB, not in API): ${extraGames.length}`);
//     console.log(`✅ Existing games (in both): ${existingGames.length}`);

//     const updatePromises = [];
//     const results = {
//       missingGames: [],
//       extraGamesUpdated: [],
//       existingGamesUpdated: [],
//       errors: [],
//     };

//     // Handle extra games - set maintenance = true
//     console.log("\n🔧 Processing extra games (setting maintenance = true)...");
//     for (const extraGame of extraGames) {
//       if (!extraGame.maintenance) {
//         // Only update if maintenance is currently false
//         console.log(
//           `  🔧 Setting maintenance=true for: ${extraGame.gameID} - ${extraGame.gameNameEN}`
//         );

//         updatePromises.push(
//           GameBNGGameModal.findByIdAndUpdate(
//             extraGame._id,
//             { $set: { maintenance: true } },
//             { new: true }
//           )
//             .then((updated) => {
//               if (updated) {
//                 results.extraGamesUpdated.push({
//                   gameID: extraGame.gameID,
//                   gameName: extraGame.gameNameEN,
//                   action: "Set maintenance = true",
//                   reason: "Game not found in BNG API",
//                 });
//               }
//               return updated;
//             })
//             .catch((error) => {
//               results.errors.push({
//                 gameID: extraGame.gameID,
//                 error: error.message,
//                 action: "Failed to set maintenance = true",
//               });
//               return null;
//             })
//         );
//       } else {
//         console.log(
//           `  ⏭️ Already in maintenance: ${extraGame.gameID} - ${extraGame.gameNameEN}`
//         );
//         results.extraGamesUpdated.push({
//           gameID: extraGame.gameID,
//           gameName: extraGame.gameNameEN,
//           action: "Already in maintenance",
//           reason: "Game not found in BNG API",
//         });
//       }
//     }

//     // Handle existing games - set maintenance = false
//     console.log(
//       "\n✅ Processing existing games (setting maintenance = false)..."
//     );
//     for (const existingGame of existingGames) {
//       if (existingGame.maintenance) {
//         // Only update if maintenance is currently true
//         console.log(
//           `  ✅ Setting maintenance=false for: ${existingGame.gameID} - ${existingGame.gameNameEN}`
//         );

//         updatePromises.push(
//           GameBNGGameModal.findByIdAndUpdate(
//             existingGame._id,
//             { $set: { maintenance: false } },
//             { new: true }
//           )
//             .then((updated) => {
//               if (updated) {
//                 results.existingGamesUpdated.push({
//                   gameID: existingGame.gameID,
//                   gameName: existingGame.gameNameEN,
//                   action: "Set maintenance = false",
//                   reason: "Game found in BNG API",
//                 });
//               }
//               return updated;
//             })
//             .catch((error) => {
//               results.errors.push({
//                 gameID: existingGame.gameID,
//                 error: error.message,
//                 action: "Failed to set maintenance = false",
//               });
//               return null;
//             })
//         );
//       } else {
//         console.log(
//           `  ⏭️ Already active: ${existingGame.gameID} - ${existingGame.gameNameEN}`
//         );
//       }
//     }

//     // Process missing games - collect for return
//     console.log("\n📝 Processing missing games...");
//     for (const missingGame of missingGames) {
//       console.log(
//         `  📝 Missing: ${missingGame.game_id} - ${
//           missingGame.i18n?.en?.title || missingGame.game_name
//         }`
//       );
//       results.missingGames.push({
//         game_id: missingGame.game_id,
//         game_name: missingGame.game_name,
//         type: missingGame.type,
//         provider_name: missingGame.provider_name,
//         titles: {
//           en: missingGame.i18n?.en?.title || "",
//           zh: missingGame.i18n?.zh?.title || "",
//           zh_hant: missingGame.i18n?.["zh-hant"]?.title || "",
//           th: missingGame.i18n?.th?.title || "",
//         },
//         banners: {
//           en: missingGame.i18n?.en?.banner_path || "",
//           zh: missingGame.i18n?.zh?.banner_path || "",
//           zh_hant: missingGame.i18n?.["zh-hant"]?.banner_path || "",
//           th: missingGame.i18n?.th?.banner_path || "",
//         },
//         release_date: missingGame.release_date,
//         supported_bonuses: missingGame.supported_bonuses,
//         bet_factors: missingGame.bet_factors,
//         reason: "Game found in BNG API but not in database",
//       });
//     }

//     // Execute all updates
//     console.log(`\n🚀 Executing ${updatePromises.length} database updates...`);
//     const updateResults = await Promise.all(updatePromises);
//     const successfulUpdates = updateResults.filter((result) => result !== null);

//     console.log(`\n📊 SYNC RESULTS:`);
//     console.log(`📝 Missing games to add: ${results.missingGames.length}`);
//     console.log(
//       `🔧 Extra games set to maintenance: ${results.extraGamesUpdated.length}`
//     );
//     console.log(
//       `✅ Existing games activated: ${results.existingGamesUpdated.length}`
//     );
//     console.log(`❌ Update errors: ${results.errors.length}`);
//     console.log(`🔄 Total database updates: ${successfulUpdates.length}`);

//     return res.status(200).json({
//       success: true,
//       message: `Successfully compared ${apiGames.length} BNG API games with ${dbGames.length} database games. Updated ${successfulUpdates.length} games and found ${results.missingGames.length} missing games.`,
//       summary: {
//         totalApiGames: apiGames.length,
//         totalDbGames: dbGames.length,
//         missingGamesCount: results.missingGames.length,
//         extraGamesCount: extraGames.length,
//         existingGamesCount: existingGames.length,
//         updatesExecuted: successfulUpdates.length,
//         errors: results.errors.length,
//       },
//       results: {
//         // Games that exist in API but not in DB - these need to be added
//         missingGames: results.missingGames,

//         // Games that exist in DB but not in API - these were set to maintenance=true
//         extraGamesUpdated: results.extraGamesUpdated,

//         // Games that exist in both - these were set to maintenance=false
//         existingGamesUpdated: results.existingGamesUpdated,

//         // Any errors that occurred during updates
//         errors: results.errors,
//       },
//       recommendations: {
//         action:
//           "Review missing games and consider adding them to your database",
//         missingGamesNote:
//           results.missingGames.length > 0
//             ? "The missing games list contains all the data needed to create new database entries"
//             : "No missing games found - database is in sync with API",
//         maintenanceNote: `${results.extraGamesUpdated.length} games were set to maintenance mode because they're not available in the API`,
//         activeNote: `${results.existingGamesUpdated.length} games were activated because they're available in the API`,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error in BNG games comparison:", error);
//     return res.status(500).json({
//       success: false,
//       message: {
//         en: "Failed to compare and sync BNG games",
//         zh: "BNG游戏比较和同步失败",
//         ms: "Gagal membandingkan dan menyegerakkan permainan BNG",
//         zh_hk: "BNG遊戲比較和同步失敗",
//         id: "Gagal membandingkan dan menyinkronkan permainan BNG",
//       },
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// });

router.post("/api/bng/getprovidergamelist", async (req, res) => {
  try {
    const { provider_id } = req.body; // Optional provider_id filter

    console.log("🎮 BNG GetGameList Request:", {
      provider_id: provider_id || "all",
    });

    // Prepare request payload according to BNG API documentation
    const requestPayload = {
      api_token: bngSecret, // Using BNG_SECRET as API_TOKEN
    };

    // Add provider_id if specified
    // if (provider_id) {
    //   requestPayload.provider_id = provider_id;
    // }

    console.log("📤 BNG API Request Payload:", requestPayload);

    // Make API request to BNG
    const response = await axios.post(
      `${bngAPIURL}/${bngProjectName}/api/v1/game/list/`,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📥 BNG API Response received");
    console.log("Response data:", response.data);

    // Check if response has items
    if (!response.data || !response.data.items) {
      return res.status(200).json({
        success: false,
        message: {
          en: "BNG: No game data received from provider.",
          zh: "BNG: 未从提供商处接收到游戏数据。",
          ms: "BNG: Tiada data permainan diterima daripada pembekal.",
          zh_hk: "BNG: 未從提供商處接收到遊戲數據。",
          id: "BNG: Tidak ada data permainan yang diterima dari penyedia.",
        },
      });
    }

    const gameItems = response.data.items;
    console.log(`📊 Received ${gameItems.length} games from BNG API`);

    return res.status(200).json({
      success: true,
      gameList: response.data,
      message: {
        en: "Game list retrieved successfully.",
        zh: "游戏列表获取成功。",
        ms: "Senarai permainan berjaya diambil.",
        zh_hk: "遊戲列表獲取成功。",
        id: "Daftar permainan berhasil diambil.",
      },
    });
  } catch (error) {
    console.error("❌ BNG error in getting game list:", error);
    if (error.response) {
      console.error("BNG API Error Response:", error.response.data);
    }

    return res.status(200).json({
      success: false,
      message: {
        en: "BNG: Failed to retrieve game list. Please try again or contact customer service for assistance.",
        zh: "BNG: 获取游戏列表失败，请重试或联系客服以获得帮助。",
        ms: "BNG: Gagal mengambil senarai permainan. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "BNG: 獲取遊戲列表失敗，請重試或聯絡客服以獲得幫助。",
        id: "BNG: Gagal mengambil daftar permainan. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/bng/getgamelist", async (req, res) => {
  try {
    const games = await GameBNGGameModal.find({
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

    const reformattedGamelist = games.map((game) => ({
      GameCode: game.gameID,
      GameNameEN: game.gameNameEN,
      GameNameZH: game.gameNameCN,
      GameType: game.gameType,
      GameImage: game.imageUrlEN || "",
      Hot: game.hot,
      RTP: game.rtpRate,
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.error("BNG Error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "BNG: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "BNG: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "BNG: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "BNG: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "BNG: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/bng/launchGame", authenticateToken, async (req, res) => {
  try {
    const { gameCode, gameLang, clientPlatform, isDouble } = req.body;
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

    if (user.gameLock.bng.lock) {
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

    let lang = "en";

    if (gameLang === "en") {
      lang = "en";
    } else if (gameLang === "zh") {
      lang = "zh";
    } else if (gameLang === "ms") {
      lang = "id";
    } else if (gameLang === "id") {
      lang = "id";
    } else if (gameLang === "zh_hk") {
      lang = "zh-hant";
    }

    let platform = "desktop";
    if (clientPlatform === "web") {
      platform = "desktop";
    } else if (clientPlatform === "mobile") {
      platform = "mobile";
    }

    let logintoken;
    if (isDouble === true) {
      logintoken = `${user.gameId}2X:${generateRandomCode()}`;
    } else {
      logintoken = `${user.gameId}:${generateRandomCode()}`;
    }

    const timestamp = Date.now();

    const gameRunnerParams = new URLSearchParams({
      token: logintoken,
      game: gameCode,
      ts: timestamp.toString(),
      platform: platform,
      lang: lang,
      title: "EZWIN9",
      exit_url: webURL,
      cashier_url: cashierURL,
    });

    const response = await axios.get(
      `${bngAPIURL}/${bngProjectName}/game/url/?${gameRunnerParams.toString()}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Game-Launcher/1.0)",
        },
      }
    );

    if (!response.data.url) {
      console.log("BNG fail to launch game with error", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "BNG: Game launch failed. Please try again or customer service for assistance.",
          zh: "BNG: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "BNG: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "BNG: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "BNG: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      {
        bngGameToken: logintoken,
      },
      { new: true }
    );

    const gameName = isDouble === true ? "BNG 2X" : "BNG";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.url,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("BNG error in launching game", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "BNG: Game launch failed. Please try again or customer service for assistance.",
        zh: "BNG: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "BNG: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "BNG: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "BNG: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/bng", async (req, res) => {
  try {
    const {
      name,
      token,
      uid,
      session,
      game_id,
      game_name,
      provider_id,
      provider_name,
      c_at,
      sent_at,
      args,
    } = req.body;

    if (!name || !uid) {
      return res.status(200).json({
        uid: uid || "",
        error: { code: "INVALID_TOKEN" },
      });
    }

    switch (name) {
      case "login": {
        if (!token || !session || !game_id) {
          return res.status(200).json({
            uid: uid,
            error: { code: "INVALID_TOKEN" },
          });
        }

        const tokenParts = token.split(":");
        const username = tokenParts[0];

        const isDoubleBetting = username.endsWith("2X");
        const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

        const currentUser = await User.findOneAndUpdate(
          { gameId: actualGameId },
          { $inc: { bngbalanceVersion: 1 } },
          {
            new: true,
            projection: { wallet: 1, bngGameToken: 1, bngbalanceVersion: 1 },
          }
        );

        if (!currentUser || currentUser.bngGameToken !== token) {
          return res.status(200).json({
            uid: uid,
            error: { code: currentUser ? "EXPIRED_TOKEN" : "INVALID_TOKEN" },
          });
        }

        const actualAmount = isDoubleBetting
          ? currentUser.wallet * 0.5
          : currentUser.wallet;

        return res.status(200).json({
          uid,
          player: {
            id: username,
            brand: brandName,
            currency: "HKD",
            mode: "REAL",
            is_test: false,
          },
          balance: {
            value: roundToTwoDecimals(actualAmount).toString(),
            version: currentUser.bngbalanceVersion,
          },
          tag: "",
        });
      }

      case "transaction": {
        const tokenParts = token.split(":");
        const username = tokenParts[0];

        const isDoubleBetting = username.endsWith("2X");
        const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

        if (
          !token ||
          !session ||
          !args ||
          typeof args.round_id === "undefined"
        ) {
          return res.status(200).json({
            uid: uid,
            error: { code: "INVALID_TOKEN" },
          });
        }

        // Check for duplicate transaction using UID
        const existingTransaction = await SlotBNGModal.findOne(
          {
            tranId: uid,
          },
          {
            _id: 1,
          }
        ).lean();

        const currentUser = await User.findOne(
          { gameId: actualGameId },
          {
            wallet: 1,
            "gameLock.bng.lock": 1,
            bngGameToken: 1,
            bngbalanceVersion: 1,
            _id: 1,
          }
        );
        const newBalanceVersion = (currentUser.bngbalanceVersion || 0) + 1;

        if (existingTransaction) {
          await User.findByIdAndUpdate(currentUser._id, {
            $set: { bngbalanceVersion: newBalanceVersion },
          });

          const actualAmount = isDoubleBetting
            ? currentUser.wallet * 0.5
            : currentUser.wallet;

          return res.status(200).json({
            uid,
            balance: {
              value: roundToTwoDecimals(actualAmount).toString(),
              version: newBalanceVersion || 0,
            },
          });
        }

        if (!currentUser) {
          console.log("❌ User not found in transaction:", username);
          return res.status(200).json({
            uid: uid,
            error: { code: "SESSION_CLOSED" },
          });
        }

        if (
          currentUser.bngGameToken !== token ||
          currentUser.gameLock?.bng?.lock
        ) {
          console.log("❌ Invalid token in transaction or user game is lock");

          const actualAmount = isDoubleBetting
            ? currentUser.wallet * 0.5
            : currentUser.wallet;

          return res.status(200).json({
            uid: uid,
            balance: {
              value: roundToTwoDecimals(actualAmount).toString(),
              version: currentUser.bngbalanceVersion || 0,
            },
            error: { code: "SESSION_CLOSED" },
          });
        }

        const multiplier = isDoubleBetting ? 2 : 1;
        const betAmount =
          (args.bonus ? 0 : parseFloat(args.bet || 0)) * multiplier;
        const winAmount = parseFloat(args.win || 0) * multiplier;
        const netAmount = winAmount - betAmount;

        const updatedUserBalance = await User.findOneAndUpdate(
          {
            gameId: actualGameId,
            wallet: { $gte: roundToTwoDecimals(betAmount || 0) },
          },
          {
            $inc: { wallet: roundToTwoDecimals(netAmount) },
            $set: {
              bngbalanceVersion: newBalanceVersion,
            },
          },
          { new: true, projection: { wallet: 1, bngbalanceVersion: 1 } }
        ).lean();

        if (!updatedUserBalance) {
          await User.findByIdAndUpdate(currentUser._id, {
            $set: { bngbalanceVersion: newBalanceVersion },
          });

          const actualAmount = isDoubleBetting
            ? currentUser.wallet * 0.5
            : currentUser.wallet;

          return res.status(200).json({
            uid: uid,
            balance: {
              value: roundToTwoDecimals(actualAmount).toString(),
              version: newBalanceVersion || 0,
            },
            error: { code: "FUNDS_EXCEED" },
          });
        }

        const result = await SlotBNGModal.findOneAndUpdate(
          {
            betId: args.round_id,
            settleamount: 0,
            betamount: 0,
          },
          {
            $set: {
              settleamount: winAmount,
              betamount: betAmount,
              settle: true,
              bet: true,
            },
          },
          {
            new: true,
            lean: true,
          }
        );

        if (!result) {
          await SlotBNGModal.create({
            tranId: uid,
            username: username,
            betamount: betAmount,
            settleamount: winAmount,
            betId: args.round_id,
            settle: true,
            bet: true,
          });
        }

        const finalAmount = isDoubleBetting
          ? updatedUserBalance.wallet * 0.5
          : updatedUserBalance.wallet;

        return res.status(200).json({
          uid,
          balance: {
            value: roundToTwoDecimals(finalAmount).toString(),
            version: updatedUserBalance.bngbalanceVersion,
          },
        });
      }

      case "getbalance": {
        const tokenParts = token.split(":");
        const username = tokenParts[0];

        const isDoubleBetting = username.endsWith("2X");
        const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

        const currentUser = await User.findOneAndUpdate(
          { gameId: actualGameId },
          { $inc: { bngbalanceVersion: 1 } },
          { new: true, projection: { wallet: 1, bngbalanceVersion: 1 } }
        ).lean();

        const actualAmount = isDoubleBetting
          ? currentUser.wallet * 0.5
          : currentUser.wallet;

        return res.status(200).json({
          uid,
          balance: {
            value: roundToTwoDecimals(actualAmount).toString(),
            version: currentUser.bngbalanceVersion || 0,
          },
        });
      }

      case "rollback": {
        const isDoubleBetting = args.player.id.endsWith("2X");
        const actualGameId = isDoubleBetting
          ? args.player.id.slice(0, -2)
          : args.player.id;

        const currentUser = await User.findOne(
          { gameId: actualGameId },
          { wallet: 1, bngbalanceVersion: 1, _id: 1 }
        ).lean();

        const multiplier = isDoubleBetting ? 2 : 1;

        const betAmount = parseFloat(args.bet || 0) * multiplier;
        const winAmount = parseFloat(args.win || 0) * multiplier;

        const originalTransaction = await SlotBNGModal.findOne(
          { tranId: args.transaction_uid },
          { cancel: 1, betamount: 1 }
        ).lean();

        const newBalanceVersion = (currentUser.bngbalanceVersion || 0) + 1;

        if (!originalTransaction) {
          await SlotBNGModal.create({
            tranId: args.transaction_uid,
            username: args.player.id,
            betamount: betAmount,
            settleamount: winAmount,
            betId: args.round_id,
            settle: true,
            bet: true,
            cancel: true,
          });

          await User.findByIdAndUpdate(currentUser._id, {
            $set: { bngbalanceVersion: newBalanceVersion },
          });

          const actualAmount = isDoubleBetting
            ? currentUser.wallet * 0.5
            : currentUser.wallet;

          return res.status(200).json({
            uid,
            balance: {
              value: roundToTwoDecimals(actualAmount).toString(),
              version: newBalanceVersion,
            },
          });
        }

        if (originalTransaction.cancel) {
          await User.findByIdAndUpdate(currentUser._id, {
            $set: { bngbalanceVersion: newBalanceVersion },
          });

          const actualAmount = isDoubleBetting
            ? currentUser.wallet * 0.5
            : currentUser.wallet;

          return res.status(200).json({
            uid,
            balance: {
              value: roundToTwoDecimals(actualAmount).toString(),
              version: newBalanceVersion,
            },
          });
        }

        const netAmount = (betAmount || 0) - (winAmount || 0);

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: actualGameId },
            {
              $inc: { wallet: roundToTwoDecimals(netAmount) },
              $set: {
                bngbalanceVersion: newBalanceVersion,
              },
            },
            { new: true, projection: { wallet: 1, bngbalanceVersion: 1 } }
          ).lean(),

          SlotBNGModal.updateMany(
            { betId: args.round_id },
            { $set: { cancel: true } }
          ),
        ]);

        const finalAmount = isDoubleBetting
          ? updatedUserBalance.wallet * 0.5
          : updatedUserBalance.wallet;

        return res.status(200).json({
          uid,
          balance: {
            value: roundToTwoDecimals(finalAmount).toString(),
            version: updatedUserBalance.bngbalanceVersion,
          },
        });
      }

      case "logout": {
        return res.status(200).json({
          uid,
        });
      }

      default: {
        return res.status(500).json({
          msg: `Invalid Name ${uid}`,
        });
      }
    }
  } catch (error) {
    console.error("❌ BNG API Error:", error.message);

    return res.status(500).json({
      msg: `Internal Server Error`,
    });
  }
});

router.post("/api/bng/getturnoverforrebate", async (req, res) => {
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

    console.log("BNG QUERYING TIME", startDate, endDate);

    const records = await SlotBNGModal.find({
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
        console.warn(`BNG User not found for gameId: ${gameId}`);
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
        gamename: "BNG",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("BNG: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "BNG: Failed to fetch win/loss report",
        zh: "BNG: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/bng2x/getturnoverforrebate", async (req, res) => {
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

    console.log("BNG QUERYING TIME", startDate, endDate);

    const records = await SlotBNGModal.find({
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
        console.warn(`BNG2X User not found for gameId: ${gameId}`);
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
        gamename: "BNG2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("BNG: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "BNG: Failed to fetch win/loss report",
        zh: "BNG: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/bng/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotBNGModal.find({
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
          gamename: "BNG",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("BNG: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/bng2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotBNGModal.find({
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
          gamename: "BNG2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("BNG: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/bng/:userId/gamedata",
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

          if (slotGames["BNG"]) {
            totalTurnover += slotGames["BNG"].turnover || 0;
            totalWinLoss += slotGames["BNG"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "BNG",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("BNG: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/bng2x/:userId/gamedata",
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

          if (slotGames["BNG2X"]) {
            totalTurnover += slotGames["BNG2X"].turnover || 0;
            totalWinLoss += slotGames["BNG2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "BNG2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("BNG: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/bng/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotBNGModal.find({
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
          gamename: "BNG",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("BNG: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/bng2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotBNGModal.find({
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
          gamename: "BNG2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("BNG: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/bng/kioskreport",
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

          if (liveCasino["BNG"]) {
            totalTurnover += Number(liveCasino["BNG"].turnover || 0);
            totalWinLoss += Number(liveCasino["BNG"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "BNG",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("BNG: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/bng2x/kioskreport",
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

          if (liveCasino["BNG2X"]) {
            totalTurnover += Number(liveCasino["BNG2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["BNG2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "BNG2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("BNG: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "BNG: Failed to fetch win/loss report",
          zh: "BNG: 获取盈亏报告失败",
        },
      });
    }
  }
);

module.exports = router;
