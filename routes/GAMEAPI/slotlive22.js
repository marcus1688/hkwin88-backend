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
const SlotLive22Modal = require("../../models/slot_live22.model");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const GameWalletLog = require("../../models/gamewalletlog.model");
const Decimal = require("decimal.js");
const GameLive22GameModal = require("../../models/slot_live22Database.model");

require("dotenv").config();

const live22OperatorID = "l22ezwin9HKD";
const live22Secret = process.env.LIVE22_SECRET;
const webURL = "https://www.ezwin9.com/";
const live22APIURL = "https://smapi.xystem138.com/api/opgateway/v1/op/";

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

// router.post("/api/live22/comparegames", async (req, res) => {
//   try {
//     const functionName = "GetGameList";
//     const requestDateTime = getCurrentFormattedDate();
//     const signature = generateSignature(
//       functionName,
//       requestDateTime,
//       live22OperatorID,
//       live22Secret
//     );

//     const payload = {
//       OperatorId: live22OperatorID,
//       RequestDateTime: requestDateTime,
//       Signature: signature,
//     };

//     console.log("Getting Live22 game list for comparison...");

//     // Make API request to get current game list
//     const response = await axios.post(`${live22APIURL}GetGameList`, payload, {
//       headers: {
//         "Content-Type": "application/json",
//       },
//     });

//     // Check if API returned successful response
//     if (!response.data || !response.data.Game) {
//       console.error("Live22 API Error: Invalid response format");
//       return res.status(400).json({
//         success: false,
//         error: "Invalid API response",
//         message: {
//           en: "Live22: Invalid API response format.",
//           zh: "Live22: API响应格式无效。",
//           ms: "Live22: Format respons API tidak sah.",
//           zh_hk: "Live22: API響應格式無效。",
//           id: "Live22: Format respons API tidak valid.",
//         },
//       });
//     }

//     // Get all games from database
//     const dbGames = await GameLive22GameModal.find(
//       {},
//       {
//         gameID: 1,
//         gameNameEN: 1,
//         gameNameCN: 1,
//         maintenance: 1,
//       }
//     );

//     // Extract game codes from API response
//     const apiGames = response.data.Game || [];
//     const apiGameCodes = apiGames.map((game) => game.GameCode);

//     // Extract game IDs from database
//     const dbGameIds = dbGames.map((game) => game.gameID);

//     console.log("API Game Codes:", apiGameCodes);
//     console.log("Database Game IDs:", dbGameIds);

//     // Find games that exist in database but not in API (these should be set to maintenance)
//     const extraGamesInDb = dbGameIds.filter(
//       (gameId) => !apiGameCodes.includes(gameId)
//     );

//     // Find games that exist in API but not in database
//     const missingGamesInDb = apiGameCodes.filter(
//       (gameCode) => !dbGameIds.includes(gameCode)
//     );

//     // Find games that exist in both (these should be set to active - maintenance: false)
//     const activeGames = dbGameIds.filter((gameId) =>
//       apiGameCodes.includes(gameId)
//     );

//     console.log("Extra games in DB (will set to maintenance):", extraGamesInDb);
//     console.log("Missing games in DB:", missingGamesInDb);
//     console.log("Active games (will set maintenance to false):", activeGames);

//     // Create detailed missing games info with API data
//     const missingGamesDetails = missingGamesInDb.map((gameCode) => {
//       const apiGame = apiGames.find((game) => game.GameCode === gameCode);

//       // Extract Chinese name from OtherName array
//       let gameNameCN = "Unknown";
//       if (apiGame?.OtherName && Array.isArray(apiGame.OtherName)) {
//         const cnName = apiGame.OtherName.find((name) =>
//           name.startsWith("zh-cn|")
//         );
//         if (cnName) {
//           gameNameCN = cnName.replace("zh-cn|", "");
//         }
//       }

//       return {
//         gameCode: gameCode,
//         gameId: apiGame?.GameId || null,
//         gameNameEN: apiGame?.GameName || "Unknown",
//         gameNameCN: gameNameCN,
//         gameType: apiGame?.GameType || null,
//         method: apiGame?.Method || "Unknown",
//         imageUrl: apiGame?.ImageUrl || null,
//         isActive: apiGame?.IsActive || false,
//         hasDemo: apiGame?.HasDemo || false,
//         sequence: apiGame?.Sequence || 0,
//         gameProvideCode: apiGame?.GameProvideCode || "Unknown",
//         gameProvideName: apiGame?.GameProvideName || "Unknown",
//       };
//     });

//     // Update maintenance status for extra games (set to true)
//     let extraUpdateResult = { modifiedCount: 0 };
//     if (extraGamesInDb.length > 0) {
//       extraUpdateResult = await GameLive22GameModal.updateMany(
//         { gameID: { $in: extraGamesInDb } },
//         { $set: { maintenance: true } }
//       );
//       console.log(
//         `Updated ${extraUpdateResult.modifiedCount} games to maintenance mode`
//       );
//     }

//     // Update maintenance status for active games (set to false)
//     let activeUpdateResult = { modifiedCount: 0 };
//     if (activeGames.length > 0) {
//       activeUpdateResult = await GameLive22GameModal.updateMany(
//         { gameID: { $in: activeGames } },
//         { $set: { maintenance: false } }
//       );
//       console.log(
//         `Updated ${activeUpdateResult.modifiedCount} games to active mode`
//       );
//     }

//     // Get details of extra games in DB
//     const extraGamesDetails = await GameLive22GameModal.find(
//       { gameID: { $in: extraGamesInDb } },
//       { gameID: 1, gameNameEN: 1, gameNameCN: 1, maintenance: 1 }
//     );

//     return res.status(200).json({
//       success: true,
//       data: {
//         comparison: {
//           totalApiGames: apiGameCodes.length,
//           totalDbGames: dbGameIds.length,
//           extraGamesInDb: {
//             count: extraGamesInDb.length,
//             games: extraGamesDetails.map((game) => ({
//               gameID: game.gameID,
//               gameNameEN: game.gameNameEN,
//               gameNameCN: game.gameNameCN,
//               maintenance: game.maintenance,
//             })),
//             action: "Set to maintenance: true",
//           },
//           activeGames: {
//             count: activeGames.length,
//             games: activeGames,
//             action: "Set to maintenance: false",
//           },
//           missingGamesInDb: {
//             count: missingGamesInDb.length,
//             games: missingGamesDetails,
//             action:
//               "No action taken - these games exist in API but not in database",
//           },
//         },
//         updateResults: {
//           extraGamesSetToMaintenance: extraUpdateResult.modifiedCount,
//           activeGamesSetToActive: activeUpdateResult.modifiedCount,
//           totalGamesUpdated:
//             extraUpdateResult.modifiedCount + activeUpdateResult.modifiedCount,
//         },
//       },
//       message: {
//         en: "Live22 game comparison completed successfully.",
//         zh: "Live22游戏比较完成成功。",
//         ms: "Perbandingan permainan Live22 berjaya diselesaikan.",
//         zh_hk: "Live22遊戲比較完成成功。",
//         id: "Perbandingan permainan Live22 berhasil diselesaikan.",
//       },
//     });
//   } catch (error) {
//     console.log(
//       "Live22 error in comparing games",
//       error.response?.data || error.message
//     );
//     return res.status(500).json({
//       success: false,
//       error: error.message,
//       message: {
//         en: "Live22: Game comparison failed. Please try again or contact customer service for assistance.",
//         zh: "Live22: 游戏比较失败，请重试或联系客服以获得帮助。",
//         ms: "Live22: Perbandingan permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
//         zh_hk: "Live22: 遊戲比較失敗，請重試或聯絡客服以獲得幫助。",
//         id: "Live22: Perbandingan permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
//       },
//     });
//   }
// });

router.post("/api/live22/getprovidergamelist", async (req, res) => {
  try {
    const functionName = "GetGameList";

    const requestDateTime = getCurrentFormattedDate();

    const signature = generateSignature(
      functionName,
      requestDateTime,
      live22OperatorID,
      live22Secret
    );

    const payload = {
      OperatorId: live22OperatorID,
      RequestDateTime: requestDateTime,
      Signature: signature,
    };

    // Make the API request
    const response = await axios.post(`${live22APIURL}GetGameList`, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

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
    console.log("LIVE22 error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "LIVE22: Game launch failed. Please try again or customer service for assistance.",
        zh: "LIVE22: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "LIVE22: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/live22/getgamelist", async (req, res) => {
  try {
    const games = await GameLive22GameModal.find({
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
        en: "LIVE22: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "LIVE22: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "LIVE22: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "LIVE22: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "LIVE22: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

//to login to game
router.post("/api/live22/launchGame", authenticateToken, async (req, res) => {
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

    if (user.gameLock.live22.lock) {
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

    const { gameCode, gameLang, isDouble } = req.body;

    // let token = req.body.gameToken;

    let token;
    if (isDouble === true) {
      token = `${user.gameId}2x:${generateRandomCode()}`;
    } else {
      token = `${user.gameId}:${generateRandomCode()}`;
    }

    let clientIp = req.headers["x-forwarded-for"] || req.ip;
    clientIp = clientIp.split(",")[0].trim();

    let lang = "zh-tw";

    if (gameLang === "en") {
      lang = "en-us";
    } else if (gameLang === "zh") {
      lang = "zh-cn";
    } else if (gameLang === "zh_hk") {
      lang = "zh-tw";
    } else if (gameLang === "ms") {
      lang = "ml-my";
    } else if (gameLang === "id") {
      lang = "id-id";
    }

    const functionName = "GameLogin";

    const requestDateTime = getCurrentFormattedDate();

    let playerId;
    if (isDouble === true) {
      playerId = `${user.gameId}2x`;
    } else {
      playerId = `${user.gameId}`;
    }

    const signature = generateSignature(
      functionName,
      requestDateTime,
      live22OperatorID,
      live22Secret,
      playerId
    );

    const payload = {
      OperatorId: live22OperatorID,
      RequestDateTime: requestDateTime,
      Signature: signature,
      PlayerId: playerId,
      Ip: clientIp,
      GameCode: gameCode,
      Currency: "HKD",
      Lang: lang,
      RedirectUrl: webURL,
      AuthToken: token,
    };

    // Make the API request
    const response = await axios.post(`${live22APIURL}GameLogin`, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.Description !== "Success") {
      console.log(
        "LIVE22 error in launching game",
        response.data,
        response.data.Description
      );
      return res.status(200).json({
        success: false,
        message: {
          en: "LIVE22: Game launch failed. Please try again or customer service for assistance.",
          zh: "LIVE22: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "LIVE22: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "LIVE22: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "LIVE22: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      {
        live22GameToken: token,
      },
      { new: true }
    );

    const gameName = isDouble === true ? "LIVE22 2X" : "LIVE22";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.Url,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("LIVE22 error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "LIVE22: Game launch failed. Please try again or customer service for assistance.",
        zh: "LIVE22: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "LIVE22: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "LIVE22: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "LIVE22: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/live22/GetBalance", async (req, res) => {
  try {
    const { OperatorId, Signature, PlayerId, AuthToken, RequestDateTime } =
      req.body;

    if (
      !OperatorId ||
      !Signature ||
      !PlayerId ||
      !AuthToken ||
      !RequestDateTime
    ) {
      return res.status(200).json({
        Status: 900406,
        Description: "Incoming Request Info Incomplete",
        ResponseDateTime: RequestDateTime,
        Balance: 0,
      });
    }

    if (OperatorId !== live22OperatorID) {
      return res.status(200).json({
        Status: 900405,
        Description: "Operator ID Error",
        ResponseDateTime: RequestDateTime,
        Balance: 0,
      });
    }

    const functionName = "GetBalance";

    const signature = generateSignature(
      functionName,
      RequestDateTime,
      live22OperatorID,
      live22Secret,
      PlayerId
    );
    if (signature !== Signature) {
      return res.status(200).json({
        Status: 900407,
        Description: "Invalid Signature",
        ResponseDateTime: RequestDateTime,
        Balance: 0,
      });
    }

    const tokenParts = AuthToken.split(":");

    const username = tokenParts[0];

    const isDoubleBetting = username.endsWith("2x");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { wallet: 1, live22GameToken: 1 }
    ).lean();
    if (!currentUser || currentUser.live22GameToken !== AuthToken) {
      return res.status(200).json({
        Status: 900500,
        Description: "Internal Server Error",
        ResponseDateTime: RequestDateTime,
        Balance: 0,
      });
    }

    const walletValue = Number(currentUser.wallet);

    const finalBalance = isDoubleBetting
      ? new Decimal(walletValue).mul(0.5).toDecimalPlaces(4)
      : new Decimal(walletValue).toDecimalPlaces(4);

    return res.status(200).json({
      Status: 200,
      Description: "OK",
      ResponseDateTime: RequestDateTime,
      Balance: finalBalance.toNumber(),
    });
  } catch (error) {
    console.error(
      "LIVE22: Error in game provider calling ae96 get balance api:",
      error.message
    );
    if (
      error.message === "jwt expired" ||
      error.message === "invalid token" ||
      error.message === "jwt malformed"
    ) {
      return res.status(200).json({
        Status: 900500,
        Description: "Internal Server Error",
        ResponseDateTime: getCurrentFormattedDate(),
        Balance: 0,
      });
    } else {
      return res.status(200).json({
        Status: 900500,
        Description: "Internal Server Error",
        ResponseDateTime: getCurrentFormattedDate(),
        Balance: 0,
      });
    }
  }
});

router.post("/api/live22/Bet", async (req, res) => {
  try {
    const {
      OperatorId,
      Signature,
      PlayerId,
      BetId,
      RequestDateTime,
      BetAmount,
      AuthToken,
      RoundId,
    } = req.body;

    if (
      !OperatorId ||
      !Signature ||
      !PlayerId ||
      !BetId ||
      !RequestDateTime ||
      !AuthToken ||
      BetAmount === null ||
      BetAmount === undefined
    ) {
      return res.status(200).json({
        Status: 900406,
        Description: "Incoming Request Info Incomplete",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (OperatorId !== live22OperatorID) {
      return res.status(200).json({
        Status: 900405,
        Description: "Operator ID Error",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const functionName = "Bet";

    const signature = generateSignature(
      functionName,
      BetId,
      RequestDateTime,
      live22OperatorID,
      live22Secret,
      PlayerId
    );

    if (signature !== Signature) {
      return res.status(200).json({
        Status: 900407,
        Description: "Invalid Signature",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const tokenParts = AuthToken.split(":");

    const username = tokenParts[0];

    const isDoubleBetting = username.endsWith("2x");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [currentUser, existingBet] = await Promise.all([
      // Get only fields we need, no lean()
      User.findOne(
        { gameId: actualGameId },
        {
          wallet: 1,
          live22GameToken: 1,
          "gameLock.live22.lock": 1,
          _id: 1,
          username: 1,
        }
      ).lean(),
      SlotLive22Modal.findOne({ betId: BetId, bet: true }, { _id: 1 }).lean(),
    ]);

    if (!currentUser || currentUser.live22GameToken !== AuthToken) {
      return res.status(200).json({
        Status: 900500,
        Description: "Internal Server Error",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (currentUser.gameLock?.live22?.lock) {
      return res.status(200).json({
        Status: 900416,
        Description: "Player Inactive",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (existingBet) {
      return res.status(200).json({
        Status: 900409,
        Description: "Duplicate Transaction",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    // const amount = roundToTwoDecimals(BetAmount);
    const amount = new Decimal(Number(BetAmount)).toDecimalPlaces(4); // Keeps as Decimal

    const finalOldBalance = isDoubleBetting
      ? new Decimal(Number(currentUser.wallet)).mul(0.5).toDecimalPlaces(4)
      : new Decimal(Number(currentUser.wallet)).toDecimalPlaces(4);

    const actualDeductionAmount = isDoubleBetting
      ? amount.mul(2).toDecimalPlaces(4)
      : amount;

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: actualDeductionAmount.toNumber() },
      },
      { $inc: { wallet: -actualDeductionAmount.toNumber() } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        Status: 900605,
        Description: "Insufficient Balance",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    await SlotLive22Modal.create({
      username: username,
      betId: BetId,
      bet: true,
      betamount: actualDeductionAmount.toNumber(),
    });

    const finalBalance = isDoubleBetting
      ? new Decimal(Number(updatedUserBalance.wallet))
          .mul(0.5)
          .toDecimalPlaces(4)
      : new Decimal(Number(updatedUserBalance.wallet)).toDecimalPlaces(4);

    return res.status(200).json({
      Status: 200,
      Description: "OK",
      ResponseDateTime: RequestDateTime,
      OldBalance: finalOldBalance.toNumber(),
      NewBalance: finalBalance.toNumber(),
    });
  } catch (error) {
    console.error(
      "LIVE22: Error in game provider calling ae96 get bet api:",
      error.message
    );
    return res.status(200).json({
      Status: 900500,
      Description: "Internal Server Error",
      ResponseDateTime: getCurrentFormattedDate(),
      OldBalance: 0,
      NewBalance: 0,
    });
  }
});

router.post("/api/live22/GameResult", async (req, res) => {
  try {
    const {
      OperatorId,
      Signature,
      PlayerId,
      BetId,
      RequestDateTime,
      BetAmount,
      ResultId,
      Payout,
    } = req.body;

    if (
      !OperatorId ||
      !Signature ||
      !PlayerId ||
      !BetId ||
      !RequestDateTime ||
      !ResultId ||
      Payout === null ||
      Payout === undefined ||
      BetAmount === null ||
      BetAmount === undefined
    ) {
      return res.status(200).json({
        Status: 900406,
        Description: "Incoming Request Info Incomplete",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (OperatorId !== live22OperatorID) {
      return res.status(200).json({
        Status: 900405,
        Description: "Operator ID Error",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const functionName = "GameResult";

    const signature = generateSignature(
      functionName,
      ResultId,
      RequestDateTime,
      live22OperatorID,
      live22Secret,
      PlayerId
    );

    if (signature !== Signature) {
      return res.status(200).json({
        Status: 900407,
        Description: "Invalid Signature",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const isDoubleBetting = PlayerId.endsWith("2x");
    const actualGameId = isDoubleBetting ? PlayerId.slice(0, -2) : PlayerId;

    const [currentUser, existingBet, existingTransaction] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1, _id: 1 }).lean(),
      SlotLive22Modal.findOne({ betId: BetId, bet: true }, { _id: 1 }).lean(),
      SlotLive22Modal.findOne(
        { betId: BetId, $or: [{ settle: true }, { cancel: true }] },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        Status: 900404,
        Description: "Invalid player / password. Please try again",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        Status: 900415,
        Description: "Bet Transaction Not Found",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (existingTransaction) {
      return res.status(200).json({
        Status: 900409,
        Description: "Duplicate Transaction",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const amount = new Decimal(Number(Payout)).toDecimalPlaces(4); // Keep as Decimal (not string)

    const finalOldBalance = isDoubleBetting
      ? new Decimal(Number(currentUser.wallet)).mul(0.5).toDecimalPlaces(4)
      : new Decimal(Number(currentUser.wallet)).toDecimalPlaces(4);

    const actualUpdateAmount = isDoubleBetting
      ? amount.mul(2).toDecimalPlaces(4)
      : amount;

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: actualUpdateAmount.toNumber() } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SlotLive22Modal.findOneAndUpdate(
        { betId: BetId },
        { $set: { settle: true, settleamount: actualUpdateAmount.toNumber() } },
        { upsert: true }
      ),
    ]);

    const finalBalance = isDoubleBetting
      ? new Decimal(Number(updatedUserBalance.wallet))
          .mul(0.5)
          .toDecimalPlaces(4)
      : new Decimal(Number(updatedUserBalance.wallet)).toDecimalPlaces(4);

    return res.status(200).json({
      Status: 200,
      Description: "OK",
      ResponseDateTime: RequestDateTime,
      OldBalance: finalOldBalance.toNumber(),
      NewBalance: finalBalance.toNumber(),
    });
  } catch (error) {
    console.error(
      "LIVE22: Error in game provider calling ae96 get game result api:",
      error.message
    );
    return res.status(200).json({
      Status: 900500,
      Description: "Internal Server Error",
      ResponseDateTime: getCurrentFormattedDate(),
      OldBalance: 0,
      NewBalance: 0,
    });
  }
});

router.post("/api/live22/Rollback", async (req, res) => {
  try {
    const {
      OperatorId,
      Signature,
      PlayerId,
      BetId,
      RequestDateTime,
      BetAmount,
    } = req.body;

    if (
      !OperatorId ||
      !Signature ||
      !PlayerId ||
      !BetId ||
      !RequestDateTime ||
      BetAmount === null ||
      BetAmount === undefined
    ) {
      return res.status(200).json({
        Status: 900406,
        Description: "Incoming Request Info Incomplete",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (OperatorId !== live22OperatorID) {
      return res.status(200).json({
        Status: 900405,
        Description: "Operator ID Error",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const functionName = "Rollback";

    const signature = generateSignature(
      functionName,
      BetId,
      RequestDateTime,
      live22OperatorID,
      live22Secret,
      PlayerId
    );

    if (signature !== Signature) {
      return res.status(200).json({
        Status: 900407,
        Description: "Invalid Signature",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }
    const isDoubleBetting = PlayerId.endsWith("2x");
    const actualGameId = isDoubleBetting ? PlayerId.slice(0, -2) : PlayerId;

    const [currentUser, existingBet, existingTransaction] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1, _id: 1 }).lean(),
      SlotLive22Modal.findOne({ betId: BetId, bet: true }, { _id: 1 }).lean(),
      SlotLive22Modal.findOne(
        { betId: BetId, $or: [{ settle: true }, { cancel: true }] },
        { _id: 1 }
      ).lean(),
    ]);
    if (!currentUser) {
      return res.status(200).json({
        Status: 900404,
        Description: "Invalid player / password. Please try again",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        Status: 900415,
        Description: "Bet Transaction Not Found",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (existingTransaction) {
      return res.status(200).json({
        Status: 900409,
        Description: "Duplicate Transaction",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const amount = new Decimal(Number(BetAmount)).toDecimalPlaces(4); // Keeps as Decimal

    const finalOldBalance = isDoubleBetting
      ? new Decimal(Number(currentUser.wallet)).mul(0.5).toDecimalPlaces(4)
      : new Decimal(Number(currentUser.wallet)).toDecimalPlaces(4);

    const actualUpdateAmount = isDoubleBetting
      ? amount.mul(2).toDecimalPlaces(4)
      : amount;

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: actualUpdateAmount.toNumber() } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SlotLive22Modal.findOneAndUpdate(
        { betId: BetId },
        { $set: { cancel: true } },
        { upsert: true, new: true }
      ),
    ]);

    const finalBalance = isDoubleBetting
      ? new Decimal(Number(updatedUserBalance.wallet))
          .mul(0.5)
          .toDecimalPlaces(4)
      : new Decimal(Number(updatedUserBalance.wallet)).toDecimalPlaces(4);

    return res.status(200).json({
      Status: 200,
      Description: "OK",
      ResponseDateTime: RequestDateTime,
      OldBalance: finalOldBalance.toNumber(),
      NewBalance: finalBalance.toNumber(),
    });
  } catch (error) {
    console.error(
      "LIVE22: Error in game provider calling ae96 get rollback api:",
      error.message
    );
    return res.status(200).json({
      Status: 900500,
      Description: "Internal Server Error",
      ResponseDateTime: getCurrentFormattedDate(),
      OldBalance: 0,
      NewBalance: 0,
    });
  }
});

router.post("/api/live22/CashBonus", async (req, res) => {
  try {
    const { OperatorId, Signature, PlayerId, RequestDateTime, Payout, TranId } =
      req.body;

    if (
      !OperatorId ||
      !Signature ||
      !PlayerId ||
      !RequestDateTime ||
      !TranId ||
      Payout === null ||
      Payout === undefined
    ) {
      return res.status(200).json({
        Status: 900406,
        Description: "Incoming Request Info Incomplete",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (OperatorId !== live22OperatorID) {
      return res.status(200).json({
        Status: 900405,
        Description: "Operator ID Error",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const functionName = "CashBonus";

    const signature = generateSignature(
      functionName,
      TranId,
      RequestDateTime,
      live22OperatorID,
      live22Secret,
      PlayerId
    );

    if (signature !== Signature) {
      return res.status(200).json({
        Status: 900407,
        Description: "Invalid Signature",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const isDoubleBetting = PlayerId.endsWith("2x");
    const actualGameId = isDoubleBetting ? PlayerId.slice(0, -2) : PlayerId;

    const [currentUser, existingTrans] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { wallet: 1, _id: 1, username: 1 }
      ).lean(),
      SlotLive22Modal.findOne({ tranId: TranId }, { _id: 1 }).lean(),
    ]);
    if (!currentUser) {
      return res.status(200).json({
        Status: 900404,
        Description: "Invalid player / password. Please try again",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    if (existingTrans) {
      return res.status(200).json({
        Status: 900409,
        Description: "Duplicate Transaction",
        ResponseDateTime: RequestDateTime,
        OldBalance: 0,
        NewBalance: 0,
      });
    }

    const amount = new Decimal(Number(Payout)).toDecimalPlaces(4); // Ensures Decimal format

    const finalOldBalance = isDoubleBetting
      ? new Decimal(Number(currentUser.wallet)).mul(0.5).toDecimalPlaces(4)
      : new Decimal(Number(currentUser.wallet)).toDecimalPlaces(4);

    const actualUpdateAmount = isDoubleBetting
      ? amount.mul(2).toDecimalPlaces(4)
      : amount;

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: actualUpdateAmount.toNumber() } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SlotLive22Modal.create({
        username: PlayerId,
        tranId: TranId,
        settle: true,
        bet: true,
        settleamount: actualUpdateAmount.toNumber(),
      }),
    ]);

    const finalBalance = isDoubleBetting
      ? new Decimal(Number(updatedUserBalance.wallet))
          .mul(0.5)
          .toDecimalPlaces(4)
      : new Decimal(Number(updatedUserBalance.wallet)).toDecimalPlaces(4);

    return res.status(200).json({
      Status: 200,
      Description: "OK",
      ResponseDateTime: RequestDateTime,
      OldBalance: finalOldBalance.toNumber(),
      NewBalance: finalBalance.toNumber(),
    });
  } catch (error) {
    console.error(
      "LIVE22: Error in game provider calling ae96 get cashbonus api:",
      error.message
    );
    return res.status(200).json({
      Status: 900500,
      Description: "Internal Server Error",
      ResponseDateTime: getCurrentFormattedDate(),
      OldBalance: 0,
      NewBalance: 0,
    });
  }
});

router.post("/api/live22/getturnoverforrebate", async (req, res) => {
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

    console.log("LIVE22 QUERYING TIME", startDate, endDate);

    const records = await SlotLive22Modal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      cancel: { $ne: true },
      username: { $not: /2x$/ },
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
        console.warn(`Live22 User not found for gameId: ${gameId}`);
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
        gamename: "LIVE22",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("LIVE22: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "LIVE22: Failed to fetch win/loss report",
        zh: "LIVE22: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/live222x/getturnoverforrebate", async (req, res) => {
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

    console.log("LIVE22 QUERYING TIME", startDate, endDate);

    const records = await SlotLive22Modal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      cancel: { $ne: true },
      username: /2x$/,
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
        console.warn(`Live222x User not found for gameId: ${gameId}`);
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
        gamename: "LIVE222X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("LIVE22: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "LIVE22: Failed to fetch win/loss report",
        zh: "LIVE22: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/live22/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotLive22Modal.find({
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
          gamename: "LIVE22",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("LIVE22: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/live222x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotLive22Modal.find({
        username: `${user.gameId}2x`,
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
          gamename: "LIVE222X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("LIVE22: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/live22/:userId/gamedata",
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

          if (slotGames["LIVE22"]) {
            totalTurnover += slotGames["LIVE22"].turnover || 0;
            totalWinLoss += slotGames["LIVE22"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "LIVE22",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("LIVE22: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/live222x/:userId/gamedata",
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

          if (slotGames["LIVE222X"]) {
            totalTurnover += slotGames["LIVE222X"].turnover || 0;
            totalWinLoss += slotGames["LIVE222X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "LIVE222X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("LIVE22: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/live22/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotLive22Modal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },
        username: { $not: /2x$/ },
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
          gamename: "LIVE22",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("LIVE22: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/live222x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotLive22Modal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },
        username: /2x$/,
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
          gamename: "LIVE222X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("LIVE22: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/live22/kioskreport",
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

          if (liveCasino["LIVE22"]) {
            totalTurnover += Number(liveCasino["LIVE22"].turnover || 0);
            totalWinLoss += Number(liveCasino["LIVE22"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "LIVE22",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("LIVE22: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/live222x/kioskreport",
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

          if (liveCasino["LIVE222X"]) {
            totalTurnover += Number(liveCasino["LIVE222X"].turnover || 0);
            totalWinLoss += Number(liveCasino["LIVE222X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "LIVE222X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("LIVE22: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "LIVE22: Failed to fetch win/loss report",
          zh: "LIVE22: 获取盈亏报告失败",
        },
      });
    }
  }
);

module.exports = router;
