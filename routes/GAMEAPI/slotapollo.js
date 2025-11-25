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
const SlotApolloModal = require("../../models/slot_apollo.model");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const GameWalletLog = require("../../models/gamewalletlog.model");
const GameApolloGameModal = require("../../models/slot_apolloDatabase.model");
const Decimal = require("decimal.js");
require("dotenv").config();

const apolloSecret = process.env.APOLLO_SECRET;
const webURL = "https://www.ezwin9.com/";
const apolloAPIURL = "https://api.aposcb.org";
const apolloLaunchGameURL = "https://dslot.apollogames.co/";
const appoloRunLightLaunchGameURL = "https://drunlight.apollogames.co/";

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

// router.post("/api/apollo/comparegame", async (req, res) => {
//   try {
//     // Make the API request
//     const response = await axios.get(
//       `${apolloAPIURL}/api/user/gamelist?host_id=${apolloSecret}`,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     // Get all games from database
//     const dbGames = await GameApolloGameModal.find({}, "gameID");

//     // Extract game IDs from database
//     const dbGameIds = new Set(dbGames.map((game) => game.gameID));

//     // Extract games from API response
//     const apiGames = response.data.data.list;
//     const apiGameIds = new Set(apiGames.map((game) => game.game_id));

//     // Find missing games (in API but not in database)
//     const missingGames = apiGames.filter(
//       (game) => !dbGameIds.has(game.game_id)
//     );

//     // Find extra games (in database but not in API) and set maintenance to true
//     const extraGameIds = [...dbGameIds].filter(
//       (gameId) => !apiGameIds.has(gameId)
//     );

//     // Update extra games to maintenance: true
//     if (extraGameIds.length > 0) {
//       await GameApolloGameModal.updateMany(
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
//       await GameApolloGameModal.updateMany(
//         { gameID: { $in: activeGameIds } },
//         { maintenance: false }
//       );
//       console.log(
//         `Set maintenance: false for ${activeGameIds.length} games in API`
//       );
//     }

//     // Return missing games with category and game_id
//     const missingGamesInfo = missingGames.map((game) => ({
//       game_id: game.game_id,
//       category: game.category,
//       title: game.title,
//       lobby_group: game.lobby_group,
//       image_url: game.image_url,
//       image_url_app: game.image_url_app,
//       url: game.url,
//     }));

//     console.log("Missing games:", missingGamesInfo);
//     console.log("Extra games set to maintenance:", extraGameIds.length);

//     return res.status(200).json({
//       success: true,
//       gameLobby: response.data,
//       comparison: {
//         missingGames: missingGamesInfo,
//         extraGamesCount: extraGameIds.length,
//         extraGameIds: extraGameIds,
//         missingCount: missingGamesInfo.length,
//       },
//       message: {
//         en: "Game launched successfully.",
//         zh: "游戏启动成功。",
//         ms: "Permainan berjaya dimulakan.",
//       },
//     });
//   } catch (error) {
//     console.log("SLOT4D error in launching game", error.message);
//     return res.status(200).json({
//       success: false,
//       message: {
//         en: "SLOT4D: Game launch failed. Please try again or customer service for assistance.",
//         zh: "SLOT4D: 游戏启动失败,请重试或联系客服以获得帮助。",
//         ms: "SLOT4D: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
//       },
//     });
//   }
// });

router.post("/api/apollo/getprovidergamelist", async (req, res) => {
  try {
    // Make the API request
    const response = await axios.get(
      `${apolloAPIURL}/api/user/gamelist?host_id=${apolloSecret}`,

      {
        headers: {
          "Content-Type": "application/json",
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

router.post("/api/apollo/getgamelist", async (req, res) => {
  try {
    const games = await GameApolloGameModal.find({
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
        en: "APOLLO: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "APOLLO: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "APOLLO: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "APOLLO: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "APOLLO: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/apollo/launchGame", authenticateToken, async (req, res) => {
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

    if (user.gameLock.apollo.lock) {
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

    let lang = "ch";

    if (gameLang === "en") {
      lang = "en";
    } else if (gameLang === "zh") {
      lang = "ch";
    } else if (gameLang === "zh_hk") {
      lang = "ch";
    } else if (gameLang === "ms") {
      lang = "en";
    } else if (gameLang === "id") {
      lang = "en";
    }

    let token;
    if (isDouble === true) {
      token = `${user.gameId}2X:${generateRandomCode()}`;
    } else {
      token = `${user.gameId}:${generateRandomCode()}`;
    }

    let baseUrl;
    if (gameCode.startsWith("drunlight")) {
      baseUrl = appoloRunLightLaunchGameURL;
    } else {
      baseUrl = apolloLaunchGameURL;
    }

    const lobbyUrl = `${baseUrl}${gameCode}/index.html?host_id=${apolloSecret}&access_token=${token}&lang=${lang}`;

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      {
        apolloGameToken: token,
      },
      { new: true }
    );

    const gameName = isDouble === true ? "APOLLO 2X" : "APOLLO";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: lobbyUrl,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("APOLLO error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "APOLLO: Game launch failed. Please try again or customer service for assistance.",
        zh: "APOLLO: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "APOLLO: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "APOLLO: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "APOLLO: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.get("/api/apollo/auth", async (req, res) => {
  try {
    const { access_token } = req.query;
    if (!access_token) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    const tokenParts = access_token.split(":");
    const username = tokenParts[0];

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { wallet: 1, apolloGameToken: 1 }
    ).lean();

    if (!currentUser || currentUser.apolloGameToken !== access_token) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }
    const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);
    const finalBalance = isDoubleBetting
      ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
      : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

    return res.status(200).json({
      status_code: 0,
      member_id: username,
      balance: finalBalance,
      currency: "HKD",
    });
  } catch (error) {
    console.error(
      "APOLLO: Error in game provider calling ae96 auth api:",
      error.message
    );
    return res.status(200).json({
      status_code: 1,
      message: "Invalid Token",
    });
  }
});

router.get("/api/apollo/betwin", async (req, res) => {
  try {
    const { access_token, ticket_id, total_bet, total_win } = req.query;
    if (!access_token) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    const tokenParts = access_token.split(":");
    const username = tokenParts[0];

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [currentUser] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        {
          username: 1,
          wallet: 1,
          "gameLock.apollo.lock": 1,
          _id: 1,
          apolloGameToken: 1,
        }
      ).lean(),
    ]);

    if (!currentUser || currentUser.apolloGameToken !== access_token) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    if (currentUser.gameLock?.apollo?.lock) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    const totalBetDecimal = new Decimal(Number(total_bet) || 0).div(100);
    const totalWinDecimal = new Decimal(Number(total_win) || 0).div(100);

    const actualBetAmount = isDoubleBetting
      ? totalBetDecimal.mul(2)
      : totalBetDecimal;

    const actualWinAmount = isDoubleBetting
      ? totalWinDecimal.mul(2)
      : totalWinDecimal;

    const walletChange = actualWinAmount.minus(Number(actualBetAmount));
    const betAmountToCheck = actualBetAmount.toDecimalPlaces(4).toNumber();

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: actualGameId,
        wallet: { $gte: betAmountToCheck },
      },
      { $inc: { wallet: walletChange.toDecimalPlaces(4).toNumber() } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        status_code: 3,
        message: "Insufficient Funds",
      });
    }

    SlotApolloModal.create({
      betId: ticket_id,
      bet: true,
      settle: true,
      username: username,
      betamount: betAmountToCheck,
      settleamount: actualWinAmount.toDecimalPlaces(4).toNumber(),
    }).catch((error) => {
      console.error("Error creating APOLLO transaction:", error.message);
    });

    const walletDecimal = new Decimal(Number(updatedUserBalance.wallet) || 0);

    const finalBalance = isDoubleBetting
      ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
      : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

    return res.status(200).json({
      status_code: 0,
      balance: finalBalance,
    });
  } catch (error) {
    console.error(
      "APOLLO: Error in game provider calling ae96 auth api:",
      error.message
    );
    return res.status(200).json({
      status_code: 1,
      message: "Invalid Token",
    });
  }
});

router.get("/api/apollo/bet", async (req, res) => {
  try {
    const { access_token, ticket_id, total_bet } = req.query;
    if (!access_token) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    const tokenParts = access_token.split(":");
    const username = tokenParts[0];

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [currentUser, existingTransaction] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        {
          username: 1,
          wallet: 1,
          "gameLock.apollo.lock": 1,
          _id: 1,
          apolloGameToken: 1,
        }
      ).lean(),
      SlotApolloModal.findOne({ betId: ticket_id }, { _id: 1 }).lean(),
    ]);

    if (!currentUser || currentUser.apolloGameToken !== access_token) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    if (currentUser.gameLock?.apollo?.lock) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    if (existingTransaction) {
      const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);

      const finalBalance = isDoubleBetting
        ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
        : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

      return res.status(200).json({
        status_code: 0,
        balance: finalBalance,
      });
    }

    const totalBetDecimal = new Decimal(Number(total_bet) || 0).div(100);

    const actualBetAmount = isDoubleBetting
      ? totalBetDecimal.mul(2)
      : totalBetDecimal;

    const betAmountToDeduct = actualBetAmount.toDecimalPlaces(4).toNumber();

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: actualGameId,
        wallet: { $gte: betAmountToDeduct },
      },
      { $inc: { wallet: -betAmountToDeduct } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        status_code: 3,
        message: "Insufficient Funds",
      });
    }

    SlotApolloModal.create({
      betId: ticket_id,
      bet: true,
      username: username,
      betamount: betAmountToDeduct,
    }).catch((error) => {
      console.error("Error creating APOLLO transaction:", error.message);
    });

    const walletDecimal = new Decimal(Number(updatedUserBalance.wallet) || 0);

    const finalBalance = isDoubleBetting
      ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
      : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

    return res.status(200).json({
      status_code: 0,
      balance: finalBalance,
    });
  } catch (error) {
    console.error(
      "APOLLO: Error in game provider calling ae96 auth api:",
      error.message
    );
    return res.status(200).json({
      status_code: 1,
      message: "Invalid Token",
    });
  }
});

router.get("/api/apollo/result", async (req, res) => {
  try {
    const { access_token, ticket_id, total_win } = req.query;
    if (!access_token) {
      return res.status(200).json({
        status_code: 1,
        message: "Invalid Token",
      });
    }

    const tokenParts = access_token.split(":");
    const username = tokenParts[0];

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [currentUser, existingTransaction, existingSettledTransaction] =
      await Promise.all([
        User.findOne(
          { gameId: actualGameId },
          {
            username: 1,
            wallet: 1,
            _id: 1,
          }
        ).lean(),
        SlotApolloModal.findOne({ betId: ticket_id }, { _id: 1 }).lean(),
        SlotApolloModal.findOne(
          { betId: ticket_id, $or: [{ cancel: true }, { settle: true }] },
          { _id: 1 }
        ).lean(),
      ]);

    if (!existingTransaction) {
      const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);
      const finalBalance = isDoubleBetting
        ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
        : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

      return res.status(200).json({
        status_code: 0,
        balance: finalBalance,
      });
    }

    if (existingSettledTransaction) {
      const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);

      const finalBalance = isDoubleBetting
        ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
        : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

      return res.status(200).json({
        status_code: 0,
        balance: finalBalance,
      });
    }

    const totalWinDecimal = new Decimal(Number(total_win) || 0).div(100);

    const actualWinAmount = isDoubleBetting
      ? totalWinDecimal.mul(2)
      : totalWinDecimal;

    const winAmountToAdd = actualWinAmount.toDecimalPlaces(4).toNumber();

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: winAmountToAdd } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),
      SlotApolloModal.findOneAndUpdate(
        { betId: ticket_id },
        {
          settle: true,
          settleamount: winAmountToAdd,
        },
        { new: false }
      ),
    ]);

    const walletDecimal = new Decimal(Number(updatedUserBalance.wallet) || 0);
    const finalBalance = isDoubleBetting
      ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
      : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

    return res.status(200).json({
      status_code: 0,
      balance: finalBalance,
    });
  } catch (error) {
    console.error(
      "APOLLO: Error in game provider calling ae96 auth api:",
      error.message
    );
    return res.status(200).json({
      status_code: 1,
      message: "Invalid Token",
    });
  }
});

router.get("/api/apollo/refund", async (req, res) => {
  try {
    const { member_id, ticket_id } = req.query;

    const [existingTransaction] = await Promise.all([
      SlotApolloModal.findOne({ betId: ticket_id }).lean(),
    ]);

    if (!existingTransaction) {
      return res.status(200).json({
        status_code: 2,
        balance: 0,
      });
    }

    const isDoubleBetting = member_id.endsWith("2X");
    const actualGameId = isDoubleBetting ? member_id.slice(0, -2) : member_id;

    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { wallet: 1 }
    ).lean();

    if (!currentUser) {
      return res.status(200).json({
        status_code: 1,
        balance: 0,
      });
    }

    if (existingTransaction.cancel) {
      const walletDecimal = new Decimal(Number(currentUser.wallet) || 0);
      const finalBalance = isDoubleBetting
        ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
        : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

      return res.status(200).json({
        status_code: 0,
        balance: finalBalance,
      });
    }

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: existingTransaction.betamount } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),
      SlotApolloModal.findOneAndUpdate(
        { betId: ticket_id },
        {
          cancel: true,
        },
        { new: false }
      ),
    ]);

    const walletDecimal = new Decimal(Number(updatedUserBalance.wallet) || 0);
    const finalBalance = isDoubleBetting
      ? walletDecimal.mul(50).toDecimalPlaces(0).toNumber()
      : walletDecimal.mul(100).toDecimalPlaces(0).toNumber();

    return res.status(200).json({
      status_code: 0,
      balance: finalBalance,
    });
  } catch (error) {
    console.error(
      "APOLLO: Error in game provider calling ae96 auth api:",
      error.message
    );
    return res.status(200).json({
      status_code: 1,
      message: "Invalid Token",
    });
  }
});

router.post("/api/apollo/getturnoverforrebate", async (req, res) => {
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

    console.log("APOLLO QUERYING TIME", startDate, endDate);

    const records = await SlotApolloModal.find({
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
        console.warn(`APOLLO User not found for gameId: ${gameId}`);
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
        gamename: "APOLLO",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("APOLLO: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "APOLLO: Failed to fetch win/loss report",
        zh: "APOLLO: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/apollo2x/getturnoverforrebate", async (req, res) => {
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

    console.log("APOLLO2x QUERYING TIME", startDate, endDate);

    const records = await SlotApolloModal.find({
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
        console.warn(`APOLLO2X User not found for gameId: ${gameId}`);
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
        gamename: "APOLLO2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("APOLLO: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "APOLLO: Failed to fetch win/loss report",
        zh: "APOLLO: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/apollo/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotApolloModal.find({
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
          gamename: "APOLLO",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("APOLLO: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/apollo2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotApolloModal.find({
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
          gamename: "APOLLO2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("APOLLO: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/apollo/:userId/gamedata",
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

          if (slotGames["APOLLO"]) {
            totalTurnover += slotGames["APOLLO"].turnover || 0;
            totalWinLoss += slotGames["APOLLO"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "APOLLO",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("APOLLO: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/apollo2x/:userId/gamedata",
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

          if (slotGames["APOLLO2X"]) {
            totalTurnover += slotGames["APOLLO2X"].turnover || 0;
            totalWinLoss += slotGames["APOLLO2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "APOLLO2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("APOLLO: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/apollo/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotApolloModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },

        settle: true,
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
          gamename: "APOLLO",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("APOLLO: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/apollo2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotApolloModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancel: { $ne: true },

        settle: true,
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
          gamename: "APOLLO2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("APOLLO: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/apollo/kioskreport",
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

          if (liveCasino["APOLLO"]) {
            totalTurnover += Number(liveCasino["APOLLO"].turnover || 0);
            totalWinLoss += Number(liveCasino["APOLLO"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "APOLLO",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("APOLLO: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/apollo2x/kioskreport",
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

          if (liveCasino["APOLLO2X"]) {
            totalTurnover += Number(liveCasino["APOLLO2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["APOLLO2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "APOLLO2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("APOLLO: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "APOLLO: Failed to fetch win/loss report",
          zh: "APOLLO: 获取盈亏报告失败",
        },
      });
    }
  }
);
module.exports = router;
