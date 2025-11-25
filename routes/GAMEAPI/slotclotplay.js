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
const SlotClotplayModal = require("../../models/slot_clotplay.model");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const GameWalletLog = require("../../models/gamewalletlog.model");
const GameClotPlayGameModal = require("../../models/slot_clotplayDatabase.model");
const Decimal = require("decimal.js");
require("dotenv").config();

const clotplaySecret = process.env.CLOTPLAY_SECRET;
const webURL = "https://www.ezwin9.com/";
const clotplayAPIURL = "https://api.coldboxservice.com/api/MOGI";
const clotplayAgent = "ezwin9";

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

function generateSignature(...inputs) {
  // Filter out undefined or null inputs
  const validInputs = inputs.filter(
    (input) => input !== undefined && input !== null
  );

  // Join the valid inputs into a single string
  const stringToHash = validInputs.join("");

  return crypto.createHash("md5").update(stringToHash).digest("hex");
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

// async function updateHabaneroManualOrderTimestamps() {
//   try {
//     // List of gameIDs in order (va-golden-empire2 = latest, lucky-7 = oldest)
//     const gameIds = [
//       "aztec-wish",
//       "va-mahjong-self-drawn-win-3",
//       "trigod-fortune",
//       "va-golden-empire2",
//       "va-mahjong-self-drawn-win-4",
//       "boxing-vs-muay-thai",
//       "legend-slot-nezha",
//       "candy-party",
//       "va-hot-ace",
//       "tanzania-king",
//     ];

//     // Start from current time for the latest game (va-golden-empire2)
//     const startTime = new Date();

//     // Process each gameID with 30-minute intervals
//     for (let i = 0; i < gameIds.length; i++) {
//       const gameId = gameIds[i];

//       // Calculate timestamp: latest game gets current time, each subsequent game is 30 minutes older
//       const timestamp = new Date(startTime.getTime() - i * 30 * 60 * 1000); // 30 minutes = 30 * 60 * 1000 milliseconds

//       // Update the document directly in the collection, bypassing schema timestamps
//       const result = await GameClotPlayGameModal.collection.updateOne(
//         { gameID: gameId },
//         {
//           $set: {
//             createdAt: timestamp,
//             updatedAt: timestamp,
//           },
//         }
//       );

//       if (result.matchedCount > 0) {
//         console.log(
//           `Updated Habanero gameID ${gameId} with timestamp: ${timestamp.toISOString()}`
//         );
//       } else {
//         console.log(`Habanero GameID ${gameId} not found in database`);
//       }
//     }

//     console.log("Habanero manual order timestamp update completed!");

//     // Verify the updates by fetching and displaying the results
//     const updatedGames = await GameClotPlayGameModal.find(
//       { gameID: { $in: gameIds } },
//       { gameID: 1, createdAt: 1, gameNameEN: 1, hot: 1 }
//     ).sort({ createdAt: -1 });

//     console.log(
//       "\nVerification - Habanero Games ordered by createdAt (newest first):"
//     );
//     updatedGames.forEach((game, index) => {
//       console.log(
//         `${index + 1}. GameID: ${
//           game.gameID
//         }, CreatedAt: ${game.createdAt.toISOString()}, Hot: ${
//           game.hot
//         }, Name: ${game.gameNameEN}`
//       );
//     });

//     console.log(
//       `\nTotal games updated: ${updatedGames.length}/${gameIds.length}`
//     );
//   } catch (error) {
//     console.error("Error updating Habanero manual order timestamps:", error);
//   }
// }

// // Call the function
// updateHabaneroManualOrderTimestamps();

// router.post("/api/clotplay/updatetimestampsbyorder", async (req, res) => {
//   try {
//     const mongoose = require("mongoose");
//     const { startDateTime = null } = req.body;

//     console.log("Starting ClotPlay timestamp update based on API order...");

//     // Make API request to get current game list
//     const response = await axios.get(`${clotplayAPIURL}/get-game-list`, {
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: clotplaySecret,
//       },
//     });

//     // Check if API returned successful response
//     if (response.data.code !== 0) {
//       console.error("ClotPlay API Error:", response.data);
//       return res.status(400).json({
//         success: false,
//         error: response.data,
//         message: {
//           en: `ClotPlay API Error: ${response.data.message || "Unknown error"}`,
//           zh: `ClotPlay API 错误: ${response.data.message || "未知错误"}`,
//           ms: `Ralat API ClotPlay: ${
//             response.data.message || "Ralat tidak diketahui"
//           }`,
//           zh_hk: `ClotPlay API 錯誤: ${response.data.message || "未知錯誤"}`,
//           id: `Kesalahan API ClotPlay: ${
//             response.data.message || "Kesalahan tidak diketahui"
//           }`,
//         },
//       });
//     }

//     // Extract slugs in order from API response
//     const apiGames = response.data.data || [];
//     const slugsInOrder = apiGames.map((game) => game.slug);

//     console.log(`Found ${slugsInOrder.length} games in API response`);
//     console.log("Game slugs in API order:", slugsInOrder.join(", "));

//     // Use custom start time or current time
//     const startTime = startDateTime
//       ? moment(startDateTime).utc()
//       : moment().utc();

//     if (startDateTime && !startTime.isValid()) {
//       return res.status(400).json({
//         success: false,
//         message: {
//           en: "Invalid startDateTime format. Please use ISO 8601 format (e.g., '2024-01-01T00:00:00Z').",
//           zh: "无效的开始时间格式。请使用 ISO 8601 格式。",
//           ms: "Format masa permulaan tidak sah. Sila gunakan format ISO 8601.",
//           zh_hk: "無效的開始時間格式。請使用 ISO 8601 格式。",
//           id: "Format startDateTime tidak valid. Harap gunakan format ISO 8601.",
//         },
//       });
//     }

//     console.log(`Starting timestamp: ${startTime.toISOString()}`);

//     // Use direct MongoDB collection to bypass Mongoose timestamps
//     const db = mongoose.connection.db;
//     const collection = db.collection("gameclotplaygamemodals"); // Replace with your actual collection name

//     const bulkOps = [];

//     // Prepare timestamp updates for games based on API order
//     for (let i = 0; i < slugsInOrder.length; i++) {
//       const slug = slugsInOrder[i];

//       // Calculate timestamp: first game gets current time, each subsequent game gets 30 minutes earlier
//       const gameTimestamp = moment(startTime)
//         .subtract(i * 30, "minutes")
//         .utc()
//         .toDate();

//       console.log(
//         `Game ${i + 1}: ${slug} will get timestamp: ${moment(
//           gameTimestamp
//         ).toISOString()}`
//       );

//       bulkOps.push({
//         updateOne: {
//           filter: { gameID: slug },
//           update: {
//             $set: {
//               createdAt: gameTimestamp,
//               updatedAt: new Date(),
//             },
//           },
//         },
//       });
//     }

//     // Execute bulk operation directly on MongoDB collection
//     console.log("Executing bulk timestamp updates via direct MongoDB...");
//     const bulkResult = await collection.bulkWrite(bulkOps);

//     console.log("Bulk write result:", {
//       matchedCount: bulkResult.matchedCount,
//       modifiedCount: bulkResult.modifiedCount,
//       upsertedCount: bulkResult.upsertedCount,
//     });

//     // Verify the updates by fetching the updated documents
//     const updatedGames = await GameClotPlayGameModal.find(
//       { gameID: { $in: slugsInOrder } },
//       { gameID: 1, gameNameEN: 1, gameNameCN: 1, createdAt: 1, updatedAt: 1 }
//     ).sort({ createdAt: -1 });

//     // Separate found and not found games
//     const foundGameIds = updatedGames.map((game) => game.gameID);
//     const notFoundGames = slugsInOrder.filter(
//       (slug) => !foundGameIds.includes(slug)
//     );

//     const foundGames = updatedGames.map((game) => ({
//       gameID: game.gameID,
//       gameNameEN: game.gameNameEN,
//       gameNameCN: game.gameNameCN,
//       newCreatedAt: game.createdAt,
//       apiPosition: slugsInOrder.indexOf(game.gameID) + 1,
//       minutesFromLatest: slugsInOrder.indexOf(game.gameID) * 30,
//     }));

//     // Get detailed info about missing games from API data
//     const missingGamesDetails = notFoundGames.map((slug) => {
//       const apiGame = apiGames.find((game) => game.slug === slug);

//       return {
//         slug: slug,
//         gameNameEN: apiGame?.name || "Unknown",
//         gameNameCN: apiGame?.name_cn || "Unknown",
//         apiPosition: slugsInOrder.indexOf(slug) + 1,
//         expectedTimestamp: moment(startTime)
//           .subtract(slugsInOrder.indexOf(slug) * 30, "minutes")
//           .utc()
//           .toISOString(),
//       };
//     });

//     console.log(
//       `Successfully updated timestamps for ${foundGames.length} games`
//     );
//     console.log(`Games not found in database: ${notFoundGames.length}`);

//     return res.status(200).json({
//       success: true,
//       message: `Successfully updated timestamps for ${bulkResult.modifiedCount} ClotPlay games based on API order using direct MongoDB operations.`,
//       data: {
//         totalApiGames: slugsInOrder.length,
//         gamesFoundAndUpdated: bulkResult.modifiedCount,
//         gamesMatched: bulkResult.matchedCount,
//         gamesNotFoundInDb: notFoundGames.length,
//         timeRange: {
//           latest: {
//             gameSlug: foundGames[0]?.gameID,
//             gameName: foundGames[0]?.gameNameEN,
//             createdAt: foundGames[0]?.newCreatedAt,
//             position: 1,
//           },
//           oldest: {
//             gameSlug: foundGames[foundGames.length - 1]?.gameID,
//             gameName: foundGames[foundGames.length - 1]?.gameNameEN,
//             createdAt: foundGames[foundGames.length - 1]?.newCreatedAt,
//             position: foundGames.length,
//           },
//         },
//         updatedGames: foundGames.map((game) => ({
//           gameID: game.gameID,
//           gameNameEN: game.gameNameEN,
//           gameNameCN: game.gameNameCN,
//           apiPosition: game.apiPosition,
//           minutesFromLatest: game.minutesFromLatest,
//           createdAt: game.newCreatedAt,
//         })),
//         gamesNotFoundInDatabase: missingGamesDetails,
//         bulkWriteStats: {
//           matchedCount: bulkResult.matchedCount,
//           modifiedCount: bulkResult.modifiedCount,
//           upsertedCount: bulkResult.upsertedCount,
//         },
//         apiOrder: slugsInOrder,
//         timestampInfo: {
//           startTime: startTime.toISOString(),
//           intervalMinutes: 30,
//           totalTimeSpan: `${(slugsInOrder.length - 1) * 30} minutes`,
//           endTime: moment(startTime)
//             .subtract((slugsInOrder.length - 1) * 30, "minutes")
//             .utc()
//             .toISOString(),
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error in ClotPlay timestamp update:", error);
//     return res.status(500).json({
//       success: false,
//       error: error.message,
//       message: {
//         en: "ClotPlay: Timestamp update failed. Please try again or contact customer service for assistance.",
//         zh: "ClotPlay: 时间戳更新失败，请重试或联系客服以获得帮助。",
//         ms: "ClotPlay: Kemaskini cap masa gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
//         zh_hk: "ClotPlay: 時間戳更新失敗，請重試或聯絡客服以獲得幫助。",
//         id: "ClotPlay: Pembaruan timestamp gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
//       },
//     });
//   }
// });

router.post("/api/clotplay/comparegames", async (req, res) => {
  try {
    console.log("Getting ClotPlay game list for comparison...");

    // Make API request to get current game list
    const response = await axios.get(`${clotplayAPIURL}/get-game-list`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: clotplaySecret,
      },
    });

    // Check if API returned successful response
    if (response.data.code !== 0) {
      console.error("ClotPlay API Error:", response.data);
      return res.status(400).json({
        success: false,
        error: response.data,
        message: {
          en: `ClotPlay API Error: ${response.data.message || "Unknown error"}`,
          zh: `ClotPlay API 错误: ${response.data.message || "未知错误"}`,
          ms: `Ralat API ClotPlay: ${
            response.data.message || "Ralat tidak diketahui"
          }`,
          zh_hk: `ClotPlay API 錯誤: ${response.data.message || "未知錯誤"}`,
          id: `Kesalahan API ClotPlay: ${
            response.data.message || "Kesalahan tidak diketahui"
          }`,
        },
      });
    }

    // Get all games from database
    const dbGames = await GameClotPlayGameModal.find(
      {},
      {
        gameID: 1,
        gameNameEN: 1,
        gameNameCN: 1,
        maintenance: 1,
      }
    );

    // Extract slugs from API response
    const apiGames = response.data.data || [];
    const apiSlugs = apiGames.map((game) => game.slug);

    // Extract game IDs from database
    const dbGameIds = dbGames.map((game) => game.gameID);

    console.log("API Game Slugs:", apiSlugs);
    console.log("Database Game IDs:", dbGameIds);

    // Find games that exist in database but not in API (these should be set to maintenance)
    const extraGamesInDb = dbGameIds.filter(
      (gameId) => !apiSlugs.includes(gameId)
    );

    // Find games that exist in API but not in database
    const missingGamesInDb = apiSlugs.filter(
      (slug) => !dbGameIds.includes(slug)
    );

    // Find games that exist in both (these should be set to active - maintenance: false)
    const activeGames = dbGameIds.filter((gameId) => apiSlugs.includes(gameId));

    console.log("Extra games in DB (will set to maintenance):", extraGamesInDb);
    console.log("Missing games in DB:", missingGamesInDb);
    console.log("Active games (will set maintenance to false):", activeGames);

    // Create detailed missing games info with API data
    const missingGamesDetails = missingGamesInDb.map((slug) => {
      const apiGame = apiGames.find((game) => game.slug === slug);

      return {
        slug: slug,
        gameNameEN: apiGame?.name || "Unknown",
        gameNameCN: apiGame?.name_cn || "Unknown",
        category: apiGame?.category || "Unknown",
        isMaintenance: apiGame?.isMaintenance || 0,
        isNew: apiGame?.isNew || 0,
        isPopular: apiGame?.isPopular || 0,
        thumbnails: {
          en: {
            portrait: apiGame?.thumbnails?.en?.portrait || null,
            square: apiGame?.thumbnails?.en?.square || null,
          },
          cn: {
            portrait: apiGame?.thumbnails?.cn?.portrait || null,
            square: apiGame?.thumbnails?.cn?.square || null,
          },
        },
        created_at: apiGame?.created_at || null,
        updated_at: apiGame?.updated_at || null,
      };
    });

    // Update maintenance status for extra games (set to true)
    let extraUpdateResult = { modifiedCount: 0 };
    if (extraGamesInDb.length > 0) {
      extraUpdateResult = await GameClotPlayGameModal.updateMany(
        { gameID: { $in: extraGamesInDb } },
        { $set: { maintenance: true } }
      );
      console.log(
        `Updated ${extraUpdateResult.modifiedCount} games to maintenance mode`
      );
    }

    // Update maintenance status for active games (set to false)
    let activeUpdateResult = { modifiedCount: 0 };
    if (activeGames.length > 0) {
      activeUpdateResult = await GameClotPlayGameModal.updateMany(
        { gameID: { $in: activeGames } },
        { $set: { maintenance: false } }
      );
      console.log(
        `Updated ${activeUpdateResult.modifiedCount} games to active mode`
      );
    }

    // Get details of extra games in DB
    const extraGamesDetails = await GameClotPlayGameModal.find(
      { gameID: { $in: extraGamesInDb } },
      { gameID: 1, gameNameEN: 1, gameNameCN: 1, maintenance: 1 }
    );

    return res.status(200).json({
      success: true,
      data: {
        comparison: {
          totalApiGames: apiSlugs.length,
          totalDbGames: dbGameIds.length,
          extraGamesInDb: {
            count: extraGamesInDb.length,
            games: extraGamesDetails.map((game) => ({
              gameID: game.gameID,
              gameNameEN: game.gameNameEN,
              gameNameCN: game.gameNameCN,
              maintenance: game.maintenance,
            })),
            action: "Set to maintenance: true",
          },
          activeGames: {
            count: activeGames.length,
            games: activeGames,
            action: "Set to maintenance: false",
          },
          missingGamesInDb: {
            count: missingGamesInDb.length,
            games: missingGamesDetails,
            action:
              "No action taken - these games exist in API but not in database",
          },
        },
        updateResults: {
          extraGamesSetToMaintenance: extraUpdateResult.modifiedCount,
          activeGamesSetToActive: activeUpdateResult.modifiedCount,
          totalGamesUpdated:
            extraUpdateResult.modifiedCount + activeUpdateResult.modifiedCount,
        },
      },
      message: {
        en: "ClotPlay game comparison completed successfully.",
        zh: "ClotPlay游戏比较完成成功。",
        ms: "Perbandingan permainan ClotPlay berjaya diselesaikan.",
        zh_hk: "ClotPlay遊戲比較完成成功。",
        id: "Perbandingan permainan ClotPlay berhasil diselesaikan.",
      },
    });
  } catch (error) {
    console.log(
      "ClotPlay error in comparing games",
      error.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      error: error.message,
      message: {
        en: "ClotPlay: Game comparison failed. Please try again or contact customer service for assistance.",
        zh: "ClotPlay: 游戏比较失败，请重试或联系客服以获得帮助。",
        ms: "ClotPlay: Perbandingan permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "ClotPlay: 遊戲比較失敗，請重試或聯絡客服以獲得幫助。",
        id: "ClotPlay: Perbandingan permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/clotplay/supportlanguage", async (req, res) => {
  try {
    // Make the API request
    const response = await axios.get(
      `${clotplayAPIURL}/languages`,

      {
        headers: {
          "Content-Type": "application/json",
          Authorization: clotplaySecret,
        },
      }
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
      },
    });
  } catch (error) {
    console.log("SLOT4D error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "SLOT4D: Game launch failed. Please try again or customer service for assistance.",
        zh: "SLOT4D: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "SLOT4D: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/clotplay/getprovidergamelist", async (req, res) => {
  try {
    // Make the API request
    const response = await axios.get(
      `${clotplayAPIURL}/get-game-list`,

      {
        headers: {
          "Content-Type": "application/json",
          Authorization: clotplaySecret,
        },
      }
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
      },
    });
  } catch (error) {
    console.log("SLOT4D error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "SLOT4D: Game launch failed. Please try again or customer service for assistance.",
        zh: "SLOT4D: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "SLOT4D: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/clotplay/getgamelist", async (req, res) => {
  try {
    const games = await GameClotPlayGameModal.find({
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
      GameNameHK: game.gameNameHK,
      GameType: game.gameType,
      GameImage: game.imageUrlEN || "",
      GameImageZH: game.imageUrlCN,
      Hot: game.hot,
      RTP: game.rtpRate,
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.error("Error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "CLOTPLAY: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "CLOTPLAY: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "CLOTPLAY: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "CLOTPLAY: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "CLOTPLAY: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/clotplay/launchGame", authenticateToken, async (req, res) => {
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

    if (user.gameLock.clotplay.lock) {
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
      lang = "cn";
    } else if (gameLang === "zh_hk") {
      lang = "cn";
    } else if (gameLang === "ms") {
      lang = "ind";
    } else if (gameLang === "id") {
      lang = "ind";
    }

    let username;
    if (isDouble === true) {
      username = `${user.gameId}2X`;
    } else {
      username = `${user.gameId}`;
    }

    const payload = {
      player_unique_id: username,
      player_name: user.username,
      player_currency: "HKD",
      game_id: gameCode,
      is_demo: false,
      language: lang,
      agent_code: clotplayAgent,
    };

    const response = await axios.post(
      `${clotplayAPIURL}/launch-game `,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: clotplaySecret,
        },
      }
    );

    if (response.data.code !== 0) {
      if (response.data.code === 1020 || response.data.code === 4004) {
        console.log("CLOTPLAY Maintenance");
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
      console.log("CLOTPLAY error in launching game", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "CLOTPLAY: Game launch failed. Please try again or contact customer service for assistance.",
          zh: "CLOTPLAY: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "CLOTPLAY: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "CLOTPLAY: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "CLOTPLAY: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const gameName = isDouble === true ? "CLOTPLAY 2X" : "CLOTPLAY";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.data.game_url,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("CLOTPLAY error in launching game", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "CLOTPLAY: Game launch failed. Please try again or customer service for assistance.",
        zh: "CLOTPLAY: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "CLOTPLAY: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "CLOTPLAY: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "CLOTPLAY: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.get("/api/clotplay/api/seamless/getBalance", async (req, res) => {
  try {
    const { player_unique_id, agent_code } = req.query;

    if (req.headers.authorization !== clotplaySecret) {
      return res.status(401).json({
        code: 1011,
        data: null,
      });
    }

    if (!player_unique_id || !agent_code) {
      return res.status(200).json({
        code: 1000,
        data: null,
      });
    }

    if (agent_code !== clotplayAgent) {
      return res.status(401).json({
        code: 1018,
        data: null,
      });
    }

    const isDoubleBetting = player_unique_id.endsWith("2X");
    const actualGameId = isDoubleBetting
      ? player_unique_id.slice(0, -2)
      : player_unique_id;

    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { wallet: 1 }
    ).lean();
    if (!currentUser) {
      return res.status(404).json({
        code: 1009,
        data: null,
      });
    }
    const walletValue = Number(currentUser.wallet);

    const finalBalance = isDoubleBetting
      ? new Decimal(walletValue).mul(0.5).toDecimalPlaces(4)
      : new Decimal(walletValue).toDecimalPlaces(4);

    return res.status(200).json({
      code: 0,
      data: {
        balance: finalBalance.toNumber(),
      },
    });
  } catch (error) {
    console.error(
      "CLOTPLAY: Error in game provider calling ae96 get balance api:",
      error.message
    );
    return res.status(200).json({
      code: 100,
      data: null,
    });
  }
});

router.post("/api/clotplay/api/seamless/betSettlement", async (req, res) => {
  try {
    const {
      player_unique_id,
      bet,
      win,
      currency,
      transaction_id,
      game_round_id,
      agent_code,
    } = req.body;

    if (req.headers.authorization !== clotplaySecret) {
      return res.status(401).json({
        code: 1011,
        data: null,
      });
    }

    if (
      !player_unique_id ||
      !transaction_id ||
      !game_round_id ||
      bet === null ||
      bet === undefined ||
      win === null ||
      win === undefined
    ) {
      return res.status(200).json({
        code: 1000,
        data: null,
      });
    }

    if (agent_code !== clotplayAgent) {
      return res.status(401).json({
        code: 1018,
        data: null,
      });
    }

    const isDoubleBetting = player_unique_id.endsWith("2X");
    const actualGameId = isDoubleBetting
      ? player_unique_id.slice(0, -2)
      : player_unique_id;

    const [currentUser, existingBet] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        {
          wallet: 1,
          "gameLock.clotplay.lock": 1,
          _id: 1,
          username: 1,
        }
      ).lean(),
      SlotClotplayModal.findOne(
        { betId: transaction_id, tranId: game_round_id },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(404).json({
        code: 1009,
        data: null,
      });
    }

    if (currentUser.gameLock?.clotplay?.lock) {
      return res.status(401).json({
        code: 1012,
        data: null,
      });
    }

    if (existingBet) {
      const walletValue = Number(currentUser.wallet);

      const finalBalance = isDoubleBetting
        ? new Decimal(Number(walletValue)).mul(0.5).toDecimalPlaces(4)
        : new Decimal(Number(walletValue)).toDecimalPlaces(4);

      return res.status(200).json({
        code: 0,
        data: {
          balance: finalBalance.toNumber(),
        },
      });
    }

    const betAmount = isDoubleBetting
      ? new Decimal(Number(bet)).mul(2).toDecimalPlaces(4)
      : new Decimal(Number(bet)).toDecimalPlaces(4);

    const winAmount = isDoubleBetting
      ? new Decimal(Number(win)).mul(2).toDecimalPlaces(4)
      : new Decimal(Number(win)).toDecimalPlaces(4);

    const netAmount = winAmount.minus(betAmount).toDecimalPlaces(4);

    const updateAmount = netAmount.toNumber();

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: betAmount.toNumber() },
      },
      { $inc: { wallet: updateAmount } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      const latestUser = await User.findOne(
        { gameId: actualGameId },
        { wallet: 1 }
      ).lean();

      const walletValue = Number(latestUser.wallet);

      const finalBalance = isDoubleBetting
        ? new Decimal(walletValue).mul(0.5).toDecimalPlaces(4)
        : new Decimal(walletValue).toDecimalPlaces(4);

      return res.status(406).json({
        code: 4001,
        data: {
          balance: finalBalance.toNumber(),
        },
      });
    }

    await SlotClotplayModal.create({
      username: player_unique_id,
      betId: transaction_id,
      tranId: game_round_id,
      settle: true,
      bet: true,
      betamount: betAmount.toNumber(),
      settleamount: winAmount.toNumber(),
    });

    const updatewalletValue = Number(updatedUserBalance.wallet);

    const finalBalance = isDoubleBetting
      ? new Decimal(updatewalletValue).mul(0.5).toDecimalPlaces(4)
      : new Decimal(updatewalletValue).toDecimalPlaces(4);

    return res.status(200).json({
      code: 0,
      data: {
        balance: finalBalance.toNumber(),
      },
    });
  } catch (error) {
    console.error(
      "CLOTPLAY: Error in game provider calling ae96 get bet api:",
      error
    );
    return res.status(200).json({
      code: 100,
      data: null,
    });
  }
});

router.post("/api/clotplay/api/seamless/cancel", async (req, res) => {
  try {
    const { player_unique_id, transaction_id, game_round_id, agent_code } =
      req.body;

    if (req.headers.authorization !== clotplaySecret) {
      return res.status(401).json({
        code: 1011,
        data: null,
      });
    }

    if (!player_unique_id || !transaction_id || !game_round_id) {
      return res.status(200).json({
        code: 1000,
        data: null,
      });
    }

    if (agent_code !== clotplayAgent) {
      return res.status(401).json({
        code: 1018,
        data: null,
      });
    }

    const isDoubleBetting = player_unique_id.endsWith("2X");
    const actualGameId = isDoubleBetting
      ? player_unique_id.slice(0, -2)
      : player_unique_id;

    const [currentUser, existingBet] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        {
          wallet: 1,
          _id: 1,
        }
      ).lean(),
      SlotClotplayModal.findOne(
        { betId: transaction_id, tranId: game_round_id },
        { _id: 1, cancel: 1, betamount: 1, settleamount: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(404).json({
        code: 1009,
        data: null,
      });
    }

    if (!existingBet) {
      return res.status(404).json({
        code: 1004,
        data: null,
      });
    }

    if (existingBet.cancel) {
      const walletValue = Number(currentUser.wallet);

      const finalBalance = isDoubleBetting
        ? new Decimal(Number(walletValue)).mul(0.5).toDecimalPlaces(4)
        : new Decimal(Number(walletValue)).toDecimalPlaces(4);

      return res.status(200).json({
        code: 0,
        data: {
          balance: finalBalance.toNumber(),
        },
      });
    }

    const betAmount = new Decimal(
      Number(existingBet.betamount)
    ).toDecimalPlaces(4);

    const winAmount = new Decimal(
      Number(existingBet.settleamount)
    ).toDecimalPlaces(4);

    const netAmount = betAmount.minus(winAmount).toDecimalPlaces(4);

    const updateAmount = netAmount.toNumber();

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: updateAmount } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SlotClotplayModal.findOneAndUpdate(
        { betId: transaction_id, tranId: game_round_id },
        { $set: { cancel: true } },
        { upsert: true, new: true }
      ),
    ]);

    const updatewalletValue = Number(updatedUserBalance.wallet);

    const finalBalance = isDoubleBetting
      ? new Decimal(updatewalletValue).mul(0.5).toDecimalPlaces(4)
      : new Decimal(updatewalletValue).toDecimalPlaces(4);

    return res.status(200).json({
      code: 0,
      data: {
        balance: finalBalance.toNumber(),
      },
    });
  } catch (error) {
    console.error(
      "CLOTPLAY: Error in game provider calling ae96 get bet api:",
      error
    );
    return res.status(200).json({
      code: 100,
      data: null,
    });
  }
});

router.post("/api/clotplay/getturnoverforrebate", async (req, res) => {
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

    console.log("CLOTPLAY QUERYING TIME", startDate, endDate);

    const records = await SlotClotplayModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      cancel: { $ne: true },
      settle: true,
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

    // Aggregate turnover and win/loss for each player
    let playerSummary = {};

    records.forEach((record) => {
      const gameId = record.username;
      const actualUsername = gameIdToUsername[gameId];

      if (!actualUsername) {
        console.warn(`CLOTPLAY User not found for gameId: ${gameId}`);
        return;
      }

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
        gamename: "CLOTPLAY",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("CLOTPLAY: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "CLOTPLAY: Failed to fetch win/loss report",
        zh: "CLOTPLAY: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/clotplay2x/getturnoverforrebate", async (req, res) => {
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

    console.log("CLOTPLAY QUERYING TIME", startDate, endDate);

    const records = await SlotClotplayModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      cancel: { $ne: true },
      settle: true,
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

    // Aggregate turnover and win/loss for each player
    let playerSummary = {};

    records.forEach((record) => {
      const gameId = record.username.slice(0, -2);
      const actualUsername = gameIdToUsername[gameId];

      if (!actualUsername) {
        console.warn(`CLOTPLAY2X User not found for gameId: ${gameId}`);
        return;
      }

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
        gamename: "CLOTPLAY2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("CLOTPLAY: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "CLOTPLAY: Failed to fetch win/loss report",
        zh: "CLOTPLAY: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/clotplay/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotClotplayModal.find({
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
          gamename: "CLOTPLAY",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("CLOTPLAY: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/clotplay2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotClotplayModal.find({
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
          gamename: "CLOTPLAY2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("CLOTPLAY: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/clotplay/:userId/gamedata",
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

          if (slotGames["CLOTPLAY"]) {
            totalTurnover += slotGames["CLOTPLAY"].turnover || 0;
            totalWinLoss += slotGames["CLOTPLAY"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "CLOTPLAY",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("CLOTPLAY: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/clotplay2x/:userId/gamedata",
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

          if (slotGames["CLOTPLAY2X"]) {
            totalTurnover += slotGames["CLOTPLAY2X"].turnover || 0;
            totalWinLoss += slotGames["CLOTPLAY2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "CLOTPLAY2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("CLOTPLAY: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/clotplay/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotClotplayModal.find({
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
          gamename: "CLOTPLAY",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("CLOTPLAY: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/clotplay2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotClotplayModal.find({
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
          gamename: "CLOTPLAY2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("CLOTPLAY: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/clotplay/kioskreport",
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

          if (liveCasino["CLOTPLAY"]) {
            totalTurnover += Number(liveCasino["CLOTPLAY"].turnover || 0);
            totalWinLoss += Number(liveCasino["CLOTPLAY"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "CLOTPLAY",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("CLOTPLAY: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/clotplay2x/kioskreport",
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

          if (liveCasino["CLOTPLAY2X"]) {
            totalTurnover += Number(liveCasino["CLOTPLAY2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["CLOTPLAY2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "CLOTPLAY2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("CLOTPLAY: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "CLOTPLAY: Failed to fetch win/loss report",
          zh: "CLOTPLAY: 获取盈亏报告失败",
        },
      });
    }
  }
);
module.exports = router;
