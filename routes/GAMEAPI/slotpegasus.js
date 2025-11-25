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
const SlotPegasusModal = require("../../models/slot_pegasus.model");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const GameWalletLog = require("../../models/gamewalletlog.model");
const Decimal = require("decimal.js");
const GamePegasusGameModal = require("../../models/slot_pegasusDatabase.model");
require("dotenv").config();

const pegasusMerchantID = "183879";
const pegasusMerchantSecret = process.env.PEGASUS_SECRET;
const pegasusMerchantXPGSIdentity = process.env.PEGASUS_IDENTITY;
const webURL = "https://www.ezwin9.com/";
const pegasusAPIURL = "https://vendor-api.888star.xyz/v1";

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

function generateTransactionId(prefix = "") {
  const uuid = uuidv4().replace(/-/g, "").substring(0, 10);
  return prefix ? `${prefix}${uuid}` : uuid;
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

// async function updatePegasusApiTimestamps() {
//   try {
//     // Make API call to get all games
//     const params = {
//       merchantID: pegasusMerchantID,
//       merchantSecretKey: pegasusMerchantSecret,
//     };

//     const headers = {
//       "Content-Type": "application/json",
//       "X-PGS-Identity": pegasusMerchantXPGSIdentity,
//       locale: "en-us",
//     };

//     const response = await axios.get(`${pegasusAPIURL}/games`, {
//       params: params,
//       headers: headers,
//     });

//     if (response.data.code !== 0) {
//       console.log("PEGASUS ERROR IN GETTING GAME LIST", response.data);
//       throw new Error("Failed to fetch games from API");
//     }

//     if (!response.data.data || !Array.isArray(response.data.data)) {
//       throw new Error("No games data received from Pegasus API");
//     }

//     // Extract games from API response in order
//     const apiGames = response.data.data;
//     const gameIds = apiGames.map((game) => game.gameCode);

//     console.log(`Found ${gameIds.length} games from API in order:`, gameIds);

//     // Start from current time for the first game
//     const startTime = new Date();

//     // Process each gameID with 30-minute intervals
//     for (let i = 0; i < gameIds.length; i++) {
//       const gameId = gameIds[i];

//       // Calculate timestamp: first game gets current time, each subsequent game is 30 minutes older
//       const timestamp = new Date(startTime.getTime() - i * 30 * 60 * 1000); // 30 minutes = 30 * 60 * 1000 milliseconds

//       // Update the document directly in the collection, bypassing schema timestamps
//       const result = await GamePegasusGameModal.collection.updateOne(
//         { gameID: gameId },
//         {
//           $set: {
//             createdAt: timestamp,
//             updatedAt: timestamp,
//           },
//         }
//       );

//       if (result.matchedCount > 0) {
//         const correspondingApiGame = apiGames.find(
//           (game) => game.gameCode === gameId
//         );
//         console.log(
//           `Updated Pegasus gameID ${gameId} (${
//             correspondingApiGame?.gameName
//           }) with timestamp: ${timestamp.toISOString()}`
//         );
//       } else {
//         console.log(`Pegasus GameID ${gameId} not found in database`);
//       }
//     }

//     console.log("Pegasus API timestamp update completed!");

//     // Verify the updates by fetching and displaying the results
//     const updatedGames = await GamePegasusGameModal.find(
//       { gameID: { $in: gameIds } },
//       { gameID: 1, createdAt: 1, gameNameEN: 1, hot: 1 }
//     ).sort({ createdAt: -1 });

//     console.log(
//       "\nVerification - Pegasus Games ordered by createdAt (newest first):"
//     );
//     updatedGames.forEach((game, index) => {
//       const correspondingApiGame = apiGames.find(
//         (apiGame) => apiGame.gameCode === game.gameID
//       );
//       console.log(
//         `${index + 1}. GameID: ${
//           game.gameID
//         }, CreatedAt: ${game.createdAt.toISOString()}, Hot: ${
//           game.hot
//         }, API Name: ${correspondingApiGame?.gameName || "N/A"}, DB Name: ${
//           game.gameNameEN
//         }`
//       );
//     });

//     console.log(
//       `\nTotal games updated: ${updatedGames.length}/${gameIds.length}`
//     );
//   } catch (error) {
//     console.error("Error updating Pegasus API timestamps:", error);
//   }
// }

// // Call the function
// updatePegasusApiTimestamps();

// router.post("/api/pegasus/comparegame", async (req, res) => {
//   try {
//     // Optional parameters from request body
//     const { locale } = req.body;

//     console.log("Pegasus compare game request:", req.body);

//     // Prepare request parameters for Pegasus API
//     const params = {
//       merchantID: pegasusMerchantID,
//       merchantSecretKey: pegasusMerchantSecret,
//     };

//     // Prepare headers
//     const headers = {
//       "Content-Type": "application/json",
//       "X-PGS-Identity": pegasusMerchantXPGSIdentity,
//     };

//     // Add locale header if provided
//     if (locale) {
//       headers["locale"] = locale;
//     } else {
//       headers["locale"] = "en-us"; // Default to English
//     }

//     // Make the API request to Pegasus
//     const response = await axios.get(`${pegasusAPIURL}/games`, {
//       params: params,
//       headers: headers,
//     });

//     console.log("Pegasus API Response received");

//     // Check if the response is successful
//     if (response.data.code !== 0) {
//       console.log("Pegasus API error:", response.data);
//       return res.status(200).json({
//         success: false,
//         error: response.data,
//         message: {
//           en: "PEGASUS: Failed to get game list from provider.",
//           zh: "PEGASUS: 从提供商获取游戏列表失败。",
//           ms: "PEGASUS: Gagal mendapatkan senarai permainan dari pembekal.",
//           zh_hk: "PEGASUS: 從提供商獲取遊戲列表失敗。",
//           id: "PEGASUS: Gagal mendapatkan daftar permainan dari provider.",
//         },
//       });
//     }

//     // Check if games data exists
//     if (!response.data.data || !Array.isArray(response.data.data)) {
//       return res.status(200).json({
//         success: false,
//         message: {
//           en: "PEGASUS: No games data received from provider.",
//           zh: "PEGASUS: 未从提供商收到游戏数据。",
//           ms: "PEGASUS: Tiada data permainan diterima dari pembekal.",
//           zh_hk: "PEGASUS: 未從提供商收到遊戲數據。",
//           id: "PEGASUS: Tidak ada data permainan yang diterima dari provider.",
//         },
//       });
//     }

//     // Get all games from database
//     const dbGames = await GamePegasusGameModal.find({}, "gameID");

//     // Extract game IDs from database
//     const dbGameIds = new Set(dbGames.map((game) => game.gameID));

//     // Extract games from API response
//     const apiGames = response.data.data;
//     const apiGameIds = new Set(apiGames.map((game) => game.gameCode));

//     // Count totals
//     const totalApiGames = apiGames.length;
//     const totalDbGames = dbGames.length;

//     // Find missing games (in API but not in database)
//     const missingGames = apiGames.filter(
//       (game) => !dbGameIds.has(game.gameCode)
//     );

//     // Find extra games (in database but not in API) and set maintenance to true
//     const extraGameIds = [...dbGameIds].filter(
//       (gameId) => !apiGameIds.has(gameId)
//     );

//     // Update extra games to maintenance: true
//     if (extraGameIds.length > 0) {
//       await GamePegasusGameModal.updateMany(
//         { gameID: { $in: extraGameIds } },
//         { maintenance: true }
//       );
//       console.log(
//         `Set maintenance: true for ${extraGameIds.length} games not in API`
//       );
//     }

//     // Set maintenance to false for games that are in API (not extra)
//     const activeGameIds = [...apiGameIds];
//     if (activeGameIds.length > 0) {
//       await GamePegasusGameModal.updateMany(
//         { gameID: { $in: activeGameIds } },
//         { maintenance: false }
//       );
//       console.log(
//         `Set maintenance: false for ${activeGameIds.length} games in API`
//       );
//     }

//     // Return missing games with gameCode and details
//     const missingGamesInfo = missingGames.map((game) => ({
//       gameCode: game.gameCode,
//       gameID: game.gameID,
//       gameName: game.gameName,
//       gameType: game.gameType,
//       gameTypeName: game.gameTypeName,
//       imageUrl: game.imageUrl,
//       imageUrl_H: game.imageUrl_H,
//       isPrePaidMode: game.isPrePaidMode,
//       isLaunchAvailable: game.isLaunchAvailable,
//       supportedOrientation: game.supportedOrientation,
//       gameNameMappings: game.gameNameMappings,
//     }));

//     console.log("Missing games:", missingGamesInfo);
//     console.log("Extra games set to maintenance:", extraGameIds.length);
//     console.log(
//       `Total API games: ${totalApiGames}, Total DB games: ${totalDbGames}`
//     );

//     // Format the response to match your application's structure
//     const formattedGames = response.data.data.map((game) => ({
//       gameID: game.gameID,
//       gameCode: game.gameCode,
//       gameName: game.gameName,
//       imageUrl: game.imageUrl,
//       imageUrl_H: game.imageUrl_H,
//       gameType: game.gameType,
//       gameTypeName: game.gameTypeName,
//       isPrePaidMode: game.isPrePaidMode,
//       isLaunchAvailable: game.isLaunchAvailable,
//       supportedOrientation: game.supportedOrientation,
//       gameNameMappings: game.gameNameMappings || [],
//     }));

//     return res.status(200).json({
//       success: true,
//       gameList: formattedGames,
//       totalGames: formattedGames.length,
//       comparison: {
//         missingGames: missingGamesInfo,
//         extraGamesCount: extraGameIds.length,
//         extraGameIds: extraGameIds,
//         missingCount: missingGamesInfo.length,
//         totalApiGames: totalApiGames,
//         totalDbGames: totalDbGames,
//       },
//       message: {
//         en: "Game list retrieved successfully.",
//         zh: "游戏列表获取成功。",
//         ms: "Senarai permainan berjaya diperoleh.",
//         zh_hk: "遊戲列表獲取成功。",
//         id: "Daftar permainan berhasil diperoleh.",
//       },
//     });
//   } catch (error) {
//     console.error("PEGASUS error in getting game list:", error);

//     // Handle specific axios errors
//     if (error.response) {
//       // API responded with error status
//       console.log("API Error Response:", error.response.data);
//       return res.status(200).json({
//         success: false,
//         error: error.response.data,
//         message: {
//           en: `PEGASUS: API Error - ${error.response.status}`,
//           zh: `PEGASUS: API错误 - ${error.response.status}`,
//           ms: `PEGASUS: Ralat API - ${error.response.status}`,
//           zh_hk: `PEGASUS: API錯誤 - ${error.response.status}`,
//           id: `PEGASUS: Error API - ${error.response.status}`,
//         },
//       });
//     } else if (error.request) {
//       // No response received
//       console.log("No response received:", error.request);
//       return res.status(200).json({
//         success: false,
//         message: {
//           en: "PEGASUS: No response from provider API.",
//           zh: "PEGASUS: 提供商API无响应。",
//           ms: "PEGASUS: Tiada respons dari API pembekal.",
//           zh_hk: "PEGASUS: 提供商API無響應。",
//           id: "PEGASUS: Tidak ada respon dari API provider.",
//         },
//       });
//     } else {
//       // Other error
//       return res.status(200).json({
//         success: false,
//         message: {
//           en: "PEGASUS: Game comparison failed. Please try again or contact customer service.",
//           zh: "PEGASUS: 游戏对比失败，请重试或联系客服。",
//           ms: "PEGASUS: Perbandingan permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan.",
//           zh_hk: "PEGASUS: 遊戲對比失敗，請重試或聯絡客服。",
//           id: "PEGASUS: Perbandingan permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan.",
//         },
//       });
//     }
//   }
// });

router.post("/api/pegasus/getprovidergamelist", async (req, res) => {
  try {
    // Optional parameters from request body
    const { locale } = req.body;

    console.log("Pegasus get game list request:", req.body);

    // Prepare request parameters for Pegasus API
    const params = {
      merchantID: pegasusMerchantID,
      merchantSecretKey: pegasusMerchantSecret,
    };

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      "X-PGS-Identity": pegasusMerchantXPGSIdentity,
    };

    // Add locale header if provided
    if (locale) {
      headers["locale"] = locale;
    } else {
      headers["locale"] = "en-us"; // Default to English
    }

    console.log("Request params:", params);
    console.log("Request headers:", headers);

    // Make the API request to Pegasus
    const response = await axios.get(`${pegasusAPIURL}/games`, {
      params: params,
      headers: headers,
    });

    console.log("Pegasus API Response:", response.data);

    // Check if the response is successful
    if (response.data.code !== 0) {
      console.log("Pegasus API error:", response.data);
      return res.status(200).json({
        success: false,
        error: response.data,
        message: {
          en: "PEGASUS: Failed to get game list from provider.",
          zh: "PEGASUS: 从提供商获取游戏列表失败。",
          ms: "PEGASUS: Gagal mendapatkan senarai permainan dari pembekal.",
          zh_hk: "PEGASUS: 從提供商獲取遊戲列表失敗。",
          id: "PEGASUS: Gagal mendapatkan daftar permainan dari provider.",
        },
      });
    }

    // Check if games data exists
    if (!response.data.data || !Array.isArray(response.data.data)) {
      return res.status(200).json({
        success: false,
        message: {
          en: "PEGASUS: No games data received from provider.",
          zh: "PEGASUS: 未从提供商收到游戏数据。",
          ms: "PEGASUS: Tiada data permainan diterima dari pembekal.",
          zh_hk: "PEGASUS: 未從提供商收到遊戲數據。",
          id: "PEGASUS: Tidak ada data permainan yang diterima dari provider.",
        },
      });
    }

    // Format the response to match your application's structure
    const formattedGames = response.data.data.map((game) => ({
      gameID: game.gameID,
      gameCode: game.gameCode,
      gameName: game.gameName,
      imageUrl: game.imageUrl,
      imageUrl_H: game.imageUrl_H,
      gameType: game.gameType,
      gameTypeName: game.gameTypeName,
      isPrePaidMode: game.isPrePaidMode,
      isLaunchAvailable: game.isLaunchAvailable,
      supportedOrientation: game.supportedOrientation,
      gameNameMappings: game.gameNameMappings || [],
    }));

    return res.status(200).json({
      success: true,
      gameList: formattedGames,
      totalGames: formattedGames.length,
      message: {
        en: "Game list retrieved successfully.",
        zh: "游戏列表获取成功。",
        ms: "Senarai permainan berjaya diperoleh.",
        zh_hk: "遊戲列表獲取成功。",
        id: "Daftar permainan berhasil diperoleh.",
      },
    });
  } catch (error) {
    console.error("PEGASUS error in getting game list:", error);

    // Handle specific axios errors
    if (error.response) {
      // API responded with error status
      console.log("API Error Response:", error.response.data);
      return res.status(200).json({
        success: false,
        error: error.response.data,
        message: {
          en: `PEGASUS: API Error - ${error.response.status}`,
          zh: `PEGASUS: API错误 - ${error.response.status}`,
          ms: `PEGASUS: Ralat API - ${error.response.status}`,
          zh_hk: `PEGASUS: API錯誤 - ${error.response.status}`,
          id: `PEGASUS: Error API - ${error.response.status}`,
        },
      });
    } else if (error.request) {
      // No response received
      console.log("No response received:", error.request);
      return res.status(200).json({
        success: false,
        message: {
          en: "PEGASUS: No response from provider API.",
          zh: "PEGASUS: 提供商API无响应。",
          ms: "PEGASUS: Tiada respons dari API pembekal.",
          zh_hk: "PEGASUS: 提供商API無響應。",
          id: "PEGASUS: Tidak ada respon dari API provider.",
        },
      });
    } else {
      // Other error
      return res.status(200).json({
        success: false,
        message: {
          en: "PEGASUS: Game list request failed. Please try again or contact customer service.",
          zh: "PEGASUS: 游戏列表请求失败，请重试或联系客服。",
          ms: "PEGASUS: Permintaan senarai permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan.",
          zh_hk: "PEGASUS: 遊戲列表請求失敗，請重試或聯絡客服。",
          id: "PEGASUS: Permintaan daftar permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan.",
        },
      });
    }
  }
});

router.post("/api/pegasus/getgamelist", async (req, res) => {
  try {
    const games = await GamePegasusGameModal.find({
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
          zh_hk: "未找到遊戲。請稍後再試。",
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
      ...(game.imageUrlCN && { GameImageZH: game.imageUrlCN }),
      Hot: game.hot,
      RTP: game.rtpRate,
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.error("PEGASUS Error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "PEGASUS: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "PEGASUS: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "PEGASUS: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "PEGASUS: 無法獲取遊戲列表，請聯絡客服以獲取幫助。",
        id: "PEGASUS: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/pegasus/launchGame", authenticateToken, async (req, res) => {
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
          zh_hk: "用戶未找到，請重試或聯絡客服以獲取幫助。",
          id: "Pengguna tidak ditemukan. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    if (user.gameLock.pegasus.lock) {
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

    const { gameCode, gameLang, isDouble } = req.body;

    let lang = "zh-cn";

    if (gameLang === "en") {
      lang = "en-us";
    } else if (gameLang === "zh") {
      lang = "zh-cn";
    } else if (gameLang === "zh_hk") {
      lang = "zh-cn";
    } else if (gameLang === "ms") {
      lang = "en-us";
    } else if (gameLang === "id") {
      lang = "en-us";
    }

    let token;
    let playerId;
    if (isDouble === true) {
      token = `${user.gameId}2X:${generateRandomCode()}`;
      playerId = `${user.gameId}2X`;
    } else {
      token = `${user.gameId}:${generateRandomCode()}`;
      playerId = `${user.gameId}`;
    }

    const params = {
      playerUniqueID: playerId,
      sessionToken: token,
      merchantID: pegasusMerchantID,
      merchantSecretKey: pegasusMerchantSecret,
      lang: lang,
      gameID: gameCode,
      backUrl: webURL,
    };

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      {
        pegasusGameToken: token,
      },
      { new: true }
    );

    const response = await axios.get(`${pegasusAPIURL}/game/launch-link`, {
      params: params,
      headers: {
        "Content-Type": "application/json",
        "X-PGS-Identity": pegasusMerchantXPGSIdentity,
      },
    });
    if (response.data.code !== 0) {
      console.log("PEGASUS error in launching game", response.data);

      return res.status(200).json({
        success: false,
        message: {
          en: "PEGASUS: Game launch failed. Please try again or customer service for assistance.",
          zh: "PEGASUS: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "PEGASUS: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "PEGASUS: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
          id: "PEGASUS: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const gameName = isDouble === true ? "PEGASUS 2X" : "PEGASUS";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.data.link,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("PEGASUS error in launching game", error.response.data);
    return res.status(200).json({
      success: false,
      message: {
        en: "PEGASUS: Game launch failed. Please try again or customer service for assistance.",
        zh: "PEGASUS: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "PEGASUS: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "PEGASUS: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
        id: "PEGASUS: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/pegasus/pgs/players/wallet", async (req, res) => {
  try {
    const { VendorCode, sessionToken } = req.body;

    const pgsIdentity =
      req.headers["x-pgs-identity"] || req.get("X-PGS-Identity");

    if (!sessionToken) {
      return res.status(200).json({
        code: 403001,
        data: {
          balance: 0,
        },
      });
    }

    if (pegasusMerchantXPGSIdentity !== pgsIdentity) {
      return res.status(200).json({
        code: 401002,
        data: {
          balance: 0,
        },
      });
    }

    const tokenParts = sessionToken.split(":");

    const username = tokenParts[0];
    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { wallet: 1, pegasusGameToken: 1 }
    ).lean();

    if (!currentUser || currentUser.pegasusGameToken !== sessionToken) {
      return res.status(200).json({
        code: 401002,
        data: {
          balance: 0,
        },
      });
    }

    const actualAmount = isDoubleBetting
      ? currentUser.wallet * 0.5
      : currentUser.wallet;

    return res.status(200).json({
      code: 0,
      data: {
        balance: roundToTwoDecimals(actualAmount),
      },
    });
  } catch (error) {
    console.error(
      "PEGASUS: Error in game provider calling ae96 get balance api:",
      error.message
    );
    return res.status(200).json({
      code: 500001,
      data: {
        balance: 0,
      },
    });
  }
});

router.post("/api/pegasus/pgs/bet/placeBet", async (req, res) => {
  try {
    const {
      VendorCode,
      sessionToken,
      betAmount,
      gameID,
      transactionNo,
      playerUniqueID,
      extraInfo,
    } = req.body;

    const pgsIdentity =
      req.headers["x-pgs-identity"] || req.get("X-PGS-Identity");

    if (
      !sessionToken ||
      betAmount === null ||
      betAmount === undefined ||
      !transactionNo ||
      !playerUniqueID
    ) {
      return res.status(200).json({
        code: 403001,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    if (pegasusMerchantXPGSIdentity !== pgsIdentity) {
      return res.status(200).json({
        code: 401002,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    const tokenParts = sessionToken.split(":");

    const username = tokenParts[0];

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [currentUser, existingBet] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        {
          wallet: 1,
          pegasusGameToken: 1,
          "gameLock.pegasus.lock": 1,
          _id: 1,
        }
      ).lean(),
      SlotPegasusModal.findOne({ betId: transactionNo }, { _id: 1 }).lean(),
    ]);

    if (!currentUser || currentUser.pegasusGameToken !== sessionToken) {
      return res.status(200).json({
        code: 401002,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    if (currentUser.gameLock?.pegasus?.lock) {
      return res.status(200).json({
        code: 401002,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    if (existingBet) {
      return res.status(200).json({
        code: 500029,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    const actualBetAmt = isDoubleBetting
      ? roundToTwoDecimals(betAmount) * 2
      : roundToTwoDecimals(betAmount);

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: actualBetAmt },
      },
      { $inc: { wallet: -actualBetAmt } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        code: 403203,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    await SlotPegasusModal.create({
      username,
      betId: transactionNo,
      bet: true,
      betamount: actualBetAmt,
    });

    const actualAmount = isDoubleBetting
      ? updatedUserBalance.wallet * 0.5
      : updatedUserBalance.wallet;

    return res.status(200).json({
      code: 0,
      data: {
        transactionNo,
        balance: roundToTwoDecimals(actualAmount),
      },
    });
  } catch (error) {
    console.error(
      "PEGASUS: Error in game provider calling ae96 bet api:",
      error.message
    );
    return res.status(200).json({
      code: 500001,
      data: {
        balance: 0,
        transactionNo: null,
      },
    });
  }
});

router.post("/api/pegasus/pgs/bet/settle", async (req, res) => {
  try {
    const {
      VendorCode,
      transactionNo,
      gameID,
      betAmount,
      payoutAmount,
      validAmount,
      playerUniqueID,
    } = req.body;

    const pgsIdentity =
      req.headers["x-pgs-identity"] || req.get("X-PGS-Identity");

    if (
      payoutAmount === null ||
      payoutAmount === undefined ||
      !transactionNo ||
      !playerUniqueID
    ) {
      return res.status(200).json({
        code: 403001,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    if (pegasusMerchantXPGSIdentity !== pgsIdentity) {
      return res.status(200).json({
        code: 401002,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    const isDoubleBetting = playerUniqueID.endsWith("2X");
    const actualGameId = isDoubleBetting
      ? playerUniqueID.slice(0, -2)
      : playerUniqueID;

    const [currentUser, existingBet, existingTransaction] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1, _id: 1 }).lean(),
      SlotPegasusModal.findOne({ betId: transactionNo }, { _id: 1 }).lean(),
      SlotPegasusModal.findOne(
        { betId: transactionNo, $or: [{ settle: true }, { cancel: true }] },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        code: 401002,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        code: 404016,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    if (existingTransaction) {
      return res.status(200).json({
        code: 403601,
        data: {
          balance: 0,
          transactionNo: null,
        },
      });
    }

    const actualWin = isDoubleBetting
      ? roundToTwoDecimals(payoutAmount) * 2
      : roundToTwoDecimals(payoutAmount);

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: actualWin } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SlotPegasusModal.findOneAndUpdate(
        { betId: transactionNo },
        {
          $set: {
            settle: true,
            settleamount: actualWin,
          },
        },
        { upsert: true }
      ),
    ]);

    const actualAmount = isDoubleBetting
      ? updatedUserBalance.wallet * 0.5
      : updatedUserBalance.wallet;

    return res.status(200).json({
      code: 0,
      data: {
        transactionNo,
        balance: roundToTwoDecimals(actualAmount),
      },
    });
  } catch (error) {
    console.error(
      "PEGASUS: Error in game provider calling settle api:",
      error.message
    );
    return res.status(200).json({
      code: 500001,
      data: {
        balance: 0,
        transactionNo: null,
      },
    });
  }
});

router.post("/api/pegasus/pgs/transaction/event-bonus", async (req, res) => {
  try {
    const {
      VendorCode,
      transactionNo,
      amount,
      playerUniqueID,
      eventDetailInfo,
    } = req.body;

    const pgsIdentity =
      req.headers["x-pgs-identity"] || req.get("X-PGS-Identity");

    if (
      amount === null ||
      amount === undefined ||
      !transactionNo ||
      !playerUniqueID
    ) {
      return res.status(200).json({
        code: 403001,
        data: {
          transactionNo: null,
          merchantOrderNo: null,
          beforeAmount: 0,
          afterAmount: 0,
        },
      });
    }

    if (pegasusMerchantXPGSIdentity !== pgsIdentity) {
      return res.status(200).json({
        code: 401002,
        data: {
          transactionNo: null,
          merchantOrderNo: null,
          beforeAmount: 0,
          afterAmount: 0,
        },
      });
    }

    const isDoubleBetting = playerUniqueID.endsWith("2X");
    const actualGameId = isDoubleBetting
      ? playerUniqueID.slice(0, -2)
      : playerUniqueID;

    const [currentUser, existingBet] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1, _id: 1 }).lean(),
      SlotPegasusModal.findOne({ betId: transactionNo }, { _id: 1 }).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        code: 401002,
        data: {
          transactionNo: null,
          merchantOrderNo: null,
          beforeAmount: 0,
          afterAmount: 0,
        },
      });
    }

    if (existingBet) {
      return res.status(200).json({
        code: 500029,
        data: {
          transactionNo: null,
          merchantOrderNo: null,
          beforeAmount: 0,
          afterAmount: 0,
        },
      });
    }

    const actualWin = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: actualWin } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SlotPegasusModal.create({
        username: playerUniqueID,
        betId: transactionNo,
        bet: true,
        betamount: 0,
        settle: true,
        settleamount: actualWin,
      }),
    ]);

    const extransId = generateTransactionId();

    const actualCurrentAmount = isDoubleBetting
      ? currentUser.wallet * 0.5
      : currentUser.wallet;

    const actualAmount = isDoubleBetting
      ? updatedUserBalance.wallet * 0.5
      : updatedUserBalance.wallet;

    return res.status(200).json({
      code: 0,
      data: {
        transactionNo,
        merchantOrderNo: extransId,
        beforeAmount: roundToTwoDecimals(actualCurrentAmount),
        afterAmount: roundToTwoDecimals(actualAmount),
      },
    });
  } catch (error) {
    console.error(
      "PEGASUS: Error in game provider calling bonus api:",
      error.message
    );
    return res.status(200).json({
      code: 500001,
      data: {
        transactionNo: null,
        merchantOrderNo: null,
        beforeAmount: 0,
        afterAmount: 0,
      },
    });
  }
});

router.post("/api/pegasus/pgs/bet/cancel", async (req, res) => {
  try {
    const { VendorCode, transactionNo, sessionToken, playerUniqueID } =
      req.body;

    const pgsIdentity =
      req.headers["x-pgs-identity"] || req.get("X-PGS-Identity");

    if (!transactionNo || !playerUniqueID) {
      return res.status(200).json({
        code: 403001,
        data: {
          transactionNo: null,
        },
      });
    }

    if (pegasusMerchantXPGSIdentity !== pgsIdentity) {
      return res.status(200).json({
        code: 401002,
        data: {
          transactionNo: null,
        },
      });
    }

    const isDoubleBetting = playerUniqueID.endsWith("2X");
    const actualGameId = isDoubleBetting
      ? playerUniqueID.slice(0, -2)
      : playerUniqueID;

    const [currentUser, existingBet, existingTransaction] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1, _id: 1 }).lean(),
      SlotPegasusModal.findOne(
        { betId: transactionNo },
        { _id: 1, betamount: 1 }
      ).lean(),
      SlotPegasusModal.findOne(
        { betId: transactionNo, $or: [{ settle: true }, { cancel: true }] },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        code: 401002,
        data: {
          transactionNo: null,
        },
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        code: 404016,
        data: {
          transactionNo: null,
        },
      });
    }

    if (existingTransaction) {
      return res.status(200).json({
        code: 403612,
        data: {
          transactionNo: null,
        },
      });
    }

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: roundToTwoDecimals(existingBet.betamount) } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SlotPegasusModal.findOneAndUpdate(
        { betId: transactionNo },
        {
          $set: {
            cancel: true,
          },
        },
        { upsert: true }
      ),
    ]);

    return res.status(200).json({
      code: 0,
      data: {
        transactionNo,
      },
    });
  } catch (error) {
    console.error(
      "PEGASUS: Error in game provider calling cancel api:",
      error.message
    );
    return res.status(200).json({
      code: 500001,
      data: {
        transactionNo: null,
      },
    });
  }
});

router.post("/api/pegasus/getturnoverforrebate", async (req, res) => {
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

    console.log("PEGASUS QUERYING TIME", startDate, endDate);

    const records = await SlotPegasusModal.find({
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
        console.warn(`PEGASUS User not found for gameId: ${gameId}`);
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
        gamename: "PEGASUS",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("PEGASUS: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "PEGASUS: Failed to fetch win/loss report",
        zh: "PEGASUS: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/pegasus2x/getturnoverforrebate", async (req, res) => {
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

    console.log("PEGASUS QUERYING TIME", startDate, endDate);

    const records = await SlotPegasusModal.find({
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
        console.warn(`PEGASUS2x User not found for gameId: ${gameId}`);
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
        gamename: "PEGASUS2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("PEGASUS: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "PEGASUS: Failed to fetch win/loss report",
        zh: "PEGASUS: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/pegasus/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotPegasusModal.find({
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
          gamename: "PEGASUS",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PEGASUS: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pegasus2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotPegasusModal.find({
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
          gamename: "PEGASUS2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PEGASUS: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pegasus/:userId/gamedata",
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

          if (slotGames["PEGASUS"]) {
            totalTurnover += slotGames["PEGASUS"].turnover || 0;
            totalWinLoss += slotGames["PEGASUS"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PEGASUS",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PEGASUS: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pegasus2x/:userId/gamedata",
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

          if (slotGames["PEGASUS2X"]) {
            totalTurnover += slotGames["PEGASUS2X"].turnover || 0;
            totalWinLoss += slotGames["PEGASUS2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PEGASUS2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PEGASUS: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pegasus/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotPegasusModal.find({
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
          gamename: "PEGASUS",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PEGASUS: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pegasus2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotPegasusModal.find({
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
          gamename: "PEGASUS2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PEGASUS: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pegasus/kioskreport",
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

          if (liveCasino["PEGASUS"]) {
            totalTurnover += Number(liveCasino["PEGASUS"].turnover || 0);
            totalWinLoss += Number(liveCasino["PEGASUS"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PEGASUS",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PEGASUS: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pegasus2x/kioskreport",
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

          if (liveCasino["PEGASUS2X"]) {
            totalTurnover += Number(liveCasino["PEGASUS2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["PEGASUS2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PEGASUS2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PEGASUS: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PEGASUS: Failed to fetch win/loss report",
          zh: "PEGASUS: 获取盈亏报告失败",
        },
      });
    }
  }
);
module.exports = router;
