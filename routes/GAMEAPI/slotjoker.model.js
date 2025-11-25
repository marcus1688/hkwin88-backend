const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const { User, GameDataLog } = require("../../models/users.model");
const SlotJokerModal = require("../../models/slot_joker.model");
const axios = require("axios");
const moment = require("moment");
const { authenticateToken } = require("../../auth/auth");
const { authenticateAdminToken } = require("../../auth/adminAuth");
const crypto = require("crypto");
const querystring = require("querystring");
const GameWalletLog = require("../../models/gamewalletlog.model");
const GameJokerGameModal = require("../../models/slot_jokerDatabase.model");

require("dotenv").config();

//Staging
const jokerAppID = "FRHL";
const jokerSecret = process.env.JOKER_SECRET;
const webURL = "https://www.ezwin9.com/";
const jokerApiURL = "https://w.apiext88.net/seamless";
const jokerGameURL = "https://www.weimen99f.net";

function getCurrentTimestamp() {
  return moment().unix();
}

function generateSignature(fields, secretKey) {
  // Sort the keys in alphabetical order and convert them to lowercase
  const sortedKeys = Object.keys(fields).sort();
  const sortedFields = sortedKeys.map((key) => {
    const value = fields[key];
    return `${key.toLowerCase()}=${value}`;
  });

  // Join the sorted key-value pairs and append the secretKey
  const rawData = sortedFields.join("&") + secretKey;
  const hash = crypto.createHash("md5").update(rawData).digest("hex");
  return hash;
}

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

function roundToTwoDecimalsForHashing(num) {
  return (Math.round(num * 100) / 100).toFixed(2);
}

const generateRandomCode = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < 10; i++) {
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

router.post("/api/joker/getgamelist", async (req, res) => {
  try {
    const games = await GameJokerGameModal.find({
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
        en: "JOKER: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "JOKER: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "JOKER: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "JOKER: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "JOKER: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/joker/launchGame", authenticateToken, async (req, res) => {
  try {
    // zh or en
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

    if (user.gameLock.joker.lock) {
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

    let token;
    if (isDouble === true) {
      token = `${user.gameId}2x:${generateRandomCode()}`;
    } else {
      token = `${user.gameId}:${generateRandomCode()}`;
    }

    const queryParams = querystring.stringify({
      token: token,
      appID: jokerAppID,
      gameCode: gameCode,
      language: lang,
      redirectUrl: webURL,
    });
    const apiUrl = `${jokerGameURL}/playGame?${queryParams}`;

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      {
        jokerGameToken: token,
      },
      { new: true }
    );

    const gameName = isDouble === true ? "JOKER 2X" : "JOKER";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: apiUrl,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("JOKER error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "JOKER: Game launch failed. Please try again or customer service for assistance.",
        zh: "JOKER: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "JOKER: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        id: "JOKER: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        zh_hk: "JOKER: 遊戲開唔到，老闆試多次或者搵客服幫手。",
      },
    });
  }
});

router.post("/api/joker/authenticate-token", async (req, res) => {
  try {
    const { appid, hash, ip, timestamp, token } = req.body;

    if (!appid || !hash || !token || appid !== jokerAppID) {
      return res.status(200).json({
        Username: null,
        Balance: 0.0,
        Message:
          !appid || !hash || !token ? "Invalid parameters" : "Invalid AppID",
        Status: !appid || !hash || !token ? 4 : 2,
      });
    }

    const generatedHash = generateSignature(
      {
        appid: jokerAppID,
        ip,
        timestamp,
        token,
      },
      jokerSecret
    );

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "InvalidSignature",
        Status: 5,
        Username: null,
      });
    }

    const username = token.split(":")[0];

    const isDoubleBetting = username.endsWith("2x");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;
    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { username: 1, wallet: 1, gameId: 1, jokerGameToken: 1 }
    ).lean();

    if (!currentUser) {
      console.log("auth, user not found");
      return res.status(200).json({
        Balance: 0.0,
        Message: "InvalidToken",
        Status: 3,
        Username: null,
      });
    }

    const actualAmount = isDoubleBetting
      ? currentUser.wallet * 0.5
      : currentUser.wallet;

    return res.status(200).json({
      Username: username,
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("joker auth error", error);
    return res.status(500).json({
      Username: null,
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/comparegames", async (req, res) => {
  try {
    // Get games from API
    const config = {
      appId: jokerAppID,
      secretKey: jokerSecret,
    };

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      AppID: config.appId,
      Timestamp: timestamp,
    };

    const hash = generateSignature(params, config.secretKey);
    params.Hash = hash;

    // Fetch API games and database games in parallel
    const [apiResponse, dbGames] = await Promise.all([
      axios.post(`${jokerApiURL}/list-games`, params, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }),
      GameJokerGameModal.find({}, { gameID: 1, gameNameEN: 1, _id: 0 }).lean(),
    ]);

    if (apiResponse.data.Error !== "0") {
      return res.status(200).json({
        success: false,
        message: "API error",
        error: apiResponse.data.Description,
      });
    }

    // Extract game codes/IDs
    const apiGameCodes = new Set(
      apiResponse.data.ListGames.map((game) => game.GameCode)
    );
    const dbGameIDs = new Set(dbGames.map((game) => game.gameID));

    // Find differences
    const missingInDB = [...apiGameCodes].filter(
      (code) => !dbGameIDs.has(code)
    );
    const extraInDB = [...dbGameIDs].filter((id) => !apiGameCodes.has(id));

    // Update maintenance status
    // const [setMaintenanceTrue, setMaintenanceFalse] = await Promise.all([
    //   // Set maintenance = true for games NOT in API (extra in DB)
    //   GameJokerGameModal.updateMany(
    //     { gameID: { $in: extraInDB } },
    //     { $set: { maintenance: true } }
    //   ),
    //   // Set maintenance = false for games that exist in API
    //   GameJokerGameModal.updateMany(
    //     { gameID: { $in: [...apiGameCodes] } },
    //     { $set: { maintenance: false } }
    //   ),
    // ]);

    // Get details for missing games
    const missingGamesDetails = apiResponse.data.ListGames.filter((game) =>
      missingInDB.includes(game.GameCode)
    ).map((game) => ({
      gameCode: game.GameCode,
      gameName: game.GameName,
      gameType: game.GameType,
      order: game.Order,
    }));

    // Get details for extra games
    const extraGamesDetails = dbGames
      .filter((game) => extraInDB.includes(game.gameID))
      .map((game) => ({
        gameID: game.gameID,
        gameNameEN: game.gameNameEN,
      }));

    return res.status(200).json({
      success: true,
      summary: {
        totalAPIGames: apiGameCodes.size,
        totalDBGames: dbGameIDs.size,
        missingInDB: missingInDB.length,
        extraInDB: extraInDB.length,
        matching: apiGameCodes.size - missingInDB.length,
      },
      // maintenanceUpdates: {
      //   setToMaintenance: setMaintenanceTrue.modifiedCount,
      //   setToActive: setMaintenanceFalse.modifiedCount,
      // },
      missingInDatabase: missingGamesDetails,
      extraInDatabase: extraGamesDetails,
    });
  } catch (error) {
    console.error("Compare games error:", error);
    return res.status(500).json({
      success: false,
      message: "Error comparing games",
      error: error.message,
    });
  }
});

router.post("/api/joker/balance", async (req, res) => {
  try {
    const { appid, hash, timestamp, username } = req.body;

    if (!appid || !hash || !username || appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message:
          !appid || !hash || !username ? "Invalid parameters" : "Invalid AppID",
        Status: !appid || !hash || !username ? 4 : 2,
      });
    }

    const generatedHash = generateSignature(
      {
        appid: jokerAppID,
        timestamp,
        username,
      },
      jokerSecret
    );

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "InvalidSignature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const user = await User.findOne(
      { gameId: actualGameId },
      { username: 1, wallet: 1 }
    ).lean();
    if (!user) {
      console.log("balance, user not found");
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;
    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("joker balance", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/bet", async (req, res) => {
  try {
    const { appid, hash, id, amount, username, timestamp, gamecode, roundid } =
      req.body;

    if (
      !appid ||
      !hash ||
      amount === undefined ||
      amount === null ||
      !username ||
      !roundid ||
      appid !== jokerAppID
    ) {
      return res.status(200).json({
        Balance: 0.0,
        Message: appid !== jokerAppID ? "Invalid AppID" : "Invalid parameters",
        Status: appid !== jokerAppID ? 2 : 4,
      });
    }

    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const generatedHash = generateSignature(
      {
        amount: formattedAmountForHashing,
        appid: jokerAppID,
        gamecode,
        id,
        roundid,
        timestamp,
        username,
      },
      jokerSecret
    );

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "InvalidSignature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const betMultiplier = isDoubleBetting ? 2 : 1;
    const balanceMultiplier = isDoubleBetting ? 0.5 : 1;

    const [user, existingBet] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { wallet: 1, "gameLock.joker.lock": 1 }
      ).lean(),
      SlotJokerModal.findOne(
        {
          username: username,
          betId: id,
          $or: [{ bet: true }, { cancel: true }],
        },
        { _id: 1 }
      ).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (user.gameLock?.joker?.lock) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Player locked",
        Status: 1000,
      });
    }

    if (existingBet) {
      return res.status(200).json({
        Balance: roundToTwoDecimals(user.wallet * balanceMultiplier),
        Message: "Bet existed",
        Status: 0,
      });
    }

    const actualUpdateBalance = roundToTwoDecimals(amount) * betMultiplier;

    const [updatedUserBalance, createdBet] = await Promise.all([
      User.findOneAndUpdate(
        {
          gameId: actualGameId,
          wallet: { $gte: actualUpdateBalance },
        },
        { $inc: { wallet: -actualUpdateBalance } },
        { new: true, projection: { wallet: 1 } }
      ),

      SlotJokerModal.create({
        username: username,
        betId: id,
        roundId: roundid,
        bet: true,
        betamount: actualUpdateBalance,
        gametype: "SLOT",
      }),
    ]);

    if (!updatedUserBalance) {
      await SlotJokerModal.findByIdAndUpdate(createdBet._id, {
        $set: {
          settle: true,
          betamount: 0,
          settleamount: 0,
          void: true,
        },
      });

      const latestUser = await User.findOne(
        { gameId: actualGameId },
        { wallet: 1, _id: 1 }
      ).lean();

      return res.status(200).json({
        Balance: roundToTwoDecimals(latestUser.wallet * balanceMultiplier),
        Message: "Insufficient fund",
        Status: 100,
      });
    }

    return res.status(200).json({
      Balance: roundToTwoDecimals(
        updatedUserBalance.wallet * balanceMultiplier
      ),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("joker bet", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/settle-bet", async (req, res) => {
  try {
    const {
      appid,
      hash,
      id,
      amount,
      username,
      timestamp,
      gamecode,
      roundid,
      description,
      type,
    } = req.body;

    if (
      !appid ||
      !hash ||
      !amount ||
      !username ||
      !roundid ||
      appid !== jokerAppID
    ) {
      return res.status(200).json({
        Balance: 0.0,
        Message:
          !appid || !hash || !amount || !username || !roundid
            ? "Invalid parameters"
            : "Invalid AppID",
        Status: !appid || !hash || !amount || !username || !roundid ? 4 : 2,
      });
    }

    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const generatedHash = generateSignature(
      {
        amount: formattedAmountForHashing,
        appid: jokerAppID,
        description,
        gamecode,
        id,
        roundid,
        timestamp,
        type,
        username,
      },
      jokerSecret
    );

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "InvalidSignature",
        Status: 5,
      });
    }
    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, bets, existingCancelBet] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.find(
        { roundId: roundid, bet: true },
        { _id: 1, betamount: 1 }
      ).lean(),
      SlotJokerModal.findOne({ settleId: id }, { _id: 1 }).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (!bets.length) {
      const actualAmount = isDoubleBetting
        ? (user?.wallet || 0) * 0.5
        : user?.wallet || 0;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Bet not found",
        Status: 0,
      });
    }

    if (existingCancelBet) {
      const actualAmount = isDoubleBetting
        ? (user?.wallet || 0) * 0.5
        : user?.wallet || 0;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Bet cancelled or settled",
        Status: 0,
      });
    }

    const actualUpdateBalance = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: actualUpdateBalance } },
        { new: true, projection: { wallet: 1 } }
      ),

      SlotJokerModal.bulkWrite(
        bets.map((bet, i) => ({
          updateOne: {
            filter: { _id: bet._id },
            update: {
              $set: {
                settle: true,
                settleamount: i === 0 ? actualUpdateBalance : 0,
                settleId: id,
              },
            },
          },
        }))
      ),
    ]);

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("joker settle-bet", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/cancel-bet", async (req, res) => {
  try {
    const { appid, hash, id, username, timestamp, gamecode, roundid, betid } =
      req.body;

    if (!appid || !hash || !username || !id || !betid || appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message:
          !appid || !hash || !username || !id || !betid
            ? "Invalid parameters"
            : "Invalid AppID",
        Status: !appid || !hash || !username || !id || !betid ? 4 : 2,
      });
    }

    const generatedHash = generateSignature(
      {
        appid: jokerAppID,
        betid,
        gamecode,
        id,
        roundid,
        timestamp,
        username,
      },
      jokerSecret
    );

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "InvalidSignature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, betToCancel, existingCancelBet] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.findOne(
        {
          roundId: roundid,
          bet: true,
          betId: betid,
        },
        { _id: 1, betamount: 1 }
      )
        .sort({ createdAt: 1 })
        .lean(),
      SlotJokerModal.findOne({ cancelId: id }, { _id: 1 }).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (!betToCancel) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      await SlotJokerModal.create({
        username: username,
        betId: betid,
        cancelId: id,
        roundId: roundid,
        cancel: true,
        bet: true,
      });

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Bet not found or already cancelled",
        Status: 0,
      });
    }

    if (existingCancelBet) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Bet cancelled or settled",
        Status: 0,
      });
    }

    const refundAmount = betToCancel.betamount || 0;

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(refundAmount) } },
        { new: true, projection: { wallet: 1 } }
      ),
      SlotJokerModal.findOneAndUpdate(
        { _id: betToCancel._id },
        {
          $set: {
            cancel: true,
            cancelId: id,
            remarkcancel: true,
          },
        }
      ),
    ]);

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("cancel-bet", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/bonus-win", async (req, res) => {
  try {
    const {
      appid,
      hash,
      id,
      amount,
      username,
      timestamp,
      gamecode,
      roundid,
      description,
      type,
    } = req.body;

    if (
      !appid ||
      !hash ||
      !amount ||
      !username ||
      !roundid ||
      appid !== jokerAppID
    ) {
      return res.status(200).json({
        Balance: 0.0,
        Message:
          !appid || !hash || !amount || !username || !roundid
            ? "Invalid parameters"
            : "Invalid AppID",
        Status: !appid || !hash || !amount || !username || !roundid ? 4 : 2,
      });
    }

    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const generatedHash = generateSignature(
      {
        amount: formattedAmountForHashing,
        appid: jokerAppID,
        description,
        gamecode,
        id,
        roundid,
        timestamp,
        type,
        username,
      },
      jokerSecret
    );

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingBonus] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.findOne({ bonusId: id }, { _id: 1 }).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (existingBonus) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Bonus existed",
        Status: 0,
      });
    }

    const actualUpdateBalance = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: actualUpdateBalance } },
        { new: true, projection: { wallet: 1 } }
      ),
      SlotJokerModal.create({
        username: username,
        bonusId: id,
        roundId: roundid,
        bonus: true,
        bet: true,
        settle: true,
        settleamount: actualUpdateBalance,
        gametype: "SLOT",
      }),
    ]);

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("bonus-win", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/jackpot-win", async (req, res) => {
  try {
    const {
      appid,
      hash,
      id,
      amount,
      username,
      timestamp,
      gamecode,
      roundid,
      description,
      type,
    } = req.body;

    if (
      !appid ||
      !hash ||
      !amount ||
      !username ||
      !roundid ||
      appid !== jokerAppID
    ) {
      return res.status(200).json({
        Balance: 0.0,
        Message:
          !appid || !hash || !amount || !username || !roundid
            ? "Invalid parameters"
            : "Invalid AppID",
        Status: !appid || !hash || !amount || !username || !roundid ? 4 : 2,
      });
    }
    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const generatedHash = generateSignature(
      {
        amount: formattedAmountForHashing,
        appid: jokerAppID,
        description,
        gamecode,
        id,
        roundid,
        timestamp,
        type,
        username,
      },
      jokerSecret
    );

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingJackpot] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.findOne({ jackpotId: id }, { _id: 1 }).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (existingJackpot) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Jackpot existed",
        Status: 0,
      });
    }

    const actualUpdateBalance = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: actualUpdateBalance } },
        { new: true, projection: { wallet: 1 } }
      ),
      SlotJokerModal.create({
        username: username,
        jackpotId: id,
        betId: id,
        roundId: roundid,
        jackpot: true,
        settleamount: actualUpdateBalance,
        gametype: "SLOT",
        settle: true,
      }),
    ]);

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("jackpot-win", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/transaction", async (req, res) => {
  try {
    const {
      appid,
      hash,
      id,
      amount,
      result,
      username,
      timestamp,
      gamecode,
      roundid,
      description,
      type,
      startbalance,
      endbalance,
    } = req.body;

    if (!appid || !hash || !amount || !username || !roundid) {
      return res.status(200).json({
        Username: null,
        Balance: 0.0,
        Message: "Invalid parameters",
        Status: 4,
      });
    }

    if (appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid AppID",
        Status: 2,
      });
    }
    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const formattedEndBalanceForHashing =
      roundToTwoDecimalsForHashing(endbalance);
    const formattedStartBalanceForHashing =
      roundToTwoDecimalsForHashing(startbalance);
    const formattedResultForHashing = roundToTwoDecimalsForHashing(result);

    const fields = {
      amount: formattedAmountForHashing,
      appid: jokerAppID,
      description: description,
      endbalance: formattedEndBalanceForHashing,
      gamecode: gamecode,
      id: id,
      result: formattedResultForHashing,
      roundid: roundid,
      startbalance: formattedStartBalanceForHashing,
      timestamp: timestamp,
      type: type,
      username: username,
    };

    const secretkey = jokerSecret;

    const generatedHash = generateSignature(fields, secretkey);

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingTrans] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.findOne({ betId: id }, { _id: 1 }).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (existingTrans) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Success",
        Status: 0,
      });
    }

    const winLossAmount = endbalance - startbalance;

    const actualTurnover = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const actualWinLoss = isDoubleBetting
      ? roundToTwoDecimals(winLossAmount) * 2
      : roundToTwoDecimals(winLossAmount);

    await SlotJokerModal.create({
      username: username,
      betId: id,
      fishTurnover: actualTurnover,
      fishWinLoss: actualWinLoss,
      settle: true,
      bet: true,
      gametype: "FISH",
    });

    const actualAmount = isDoubleBetting
      ? (user?.wallet || 0) * 0.5
      : user?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("transaction", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/withdraw", async (req, res) => {
  try {
    const { appid, hash, id, amount, username, timestamp } = req.body;

    if (!appid || !hash || !amount || !username || !id) {
      return res.status(200).json({
        Username: null,
        Balance: 0.0,
        Message: "Invalid parameters",
        Status: 4,
      });
    }

    if (appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid AppID",
        Status: 2,
      });
    }

    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const fields = {
      amount: formattedAmountForHashing,
      appid: jokerAppID,
      id: id,
      timestamp: timestamp,
      username: username,
    };

    const secretkey = jokerSecret;

    const generatedHash = generateSignature(fields, secretkey);

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingWithdraw] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { wallet: 1, "gameLock.joker.lock": 1 }
      ).lean(),
      SlotJokerModal.findOne({ betId: id, deposit: true }, { _id: 1 }).lean(),
    ]);
    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (user.gameLock?.joker?.lock) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Player locked",
        Status: 1000,
      });
    }

    if (existingWithdraw) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Success",
        Status: 0,
      });
    }

    const actualUpdateBalance = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: actualGameId,
        wallet: { $gte: actualUpdateBalance },
      },
      { $inc: { wallet: -actualUpdateBalance } },
      { new: true, projection: { wallet: 1 } }
    );

    if (!updatedUserBalance) {
      const latestUser = await User.findOne(
        { gameId: actualGameId },
        { wallet: 1 }
      ).lean();

      const actualAmount = isDoubleBetting
        ? (latestUser?.wallet || 0) * 0.5
        : latestUser?.wallet || 0;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Insufficient fund",
        Status: 100,
      });
    }

    await SlotJokerModal.create({
      username: username,
      betId: id,
      deposit: true,
      depositAmount: actualUpdateBalance,
    });

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("withdraw", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/deposit", async (req, res) => {
  try {
    const { appid, hash, id, amount, username, timestamp } = req.body;

    if (!appid || !hash || !amount || !username || !id) {
      return res.status(200).json({
        Username: null,
        Balance: 0.0,
        Message: "Invalid parameters",
        Status: 4,
      });
    }

    if (appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid AppID",
        Status: 2,
      });
    }

    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const fields = {
      amount: formattedAmountForHashing,
      appid: jokerAppID,
      id: id,
      timestamp: timestamp,
      username: username,
    };

    const secretkey = jokerSecret;

    const generatedHash = generateSignature(fields, secretkey);

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingDeposit] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.findOne({ betId: id, withdraw: true }, { _id: 1 }).lean(),
    ]);
    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (existingDeposit) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Success",
        Status: 0,
      });
    }

    const actualUpdateBalance = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: actualUpdateBalance } },
        { new: true, projection: { wallet: 1 } }
      ),
      SlotJokerModal.create({
        username: username,
        betId: id,
        withdraw: true,
        withdrawAmount: actualUpdateBalance,
      }),
    ]);

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("deposit", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/join-tournament", async (req, res) => {
  try {
    const {
      appid,
      hash,
      id,
      tournamentid,
      amount,
      username,
      timestamp,
      extendedinfo,
    } = req.body;

    if (!appid || !hash || !amount || !username || !id) {
      return res.status(200).json({
        Username: null,
        Balance: 0.0,
        Message: "Invalid parameters",
        Status: 4,
      });
    }

    if (appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid AppID",
        Status: 2,
      });
    }

    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const fields = {
      amount: formattedAmountForHashing,
      appid: jokerAppID,
      id: id,
      timestamp: timestamp,
      tournamentid: tournamentid,
      username: username,
    };

    const secretkey = jokerSecret;

    const generatedHash = generateSignature(fields, secretkey);

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingTournament] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.findOne(
        { username: username, tournamentId: id, tournament: true },
        { _id: 1 }
      ).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (existingTournament) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Join Tournament already existed",
        Status: 0,
      });
    }

    const actualUpdateBalance = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: actualGameId,
        wallet: { $gte: actualUpdateBalance },
      },
      { $inc: { wallet: -actualUpdateBalance } },
      { new: true }
    );

    if (!updatedUserBalance) {
      const latestUser = await User.findOne(
        { gameId: actualGameId },
        { wallet: 1 }
      ).lean();

      const actualAmount = isDoubleBetting
        ? (latestUser?.wallet || 0) * 0.5
        : latestUser?.wallet || 0;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Insufficient fund",
        Status: 100,
      });
    }

    await SlotJokerModal.create({
      username: username,
      betId: tournamentid,
      tournament: true,
      tournamentId: id,
      betamount: actualUpdateBalance,
    });

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("join-tournament", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/cancel-join-tournament", async (req, res) => {
  try {
    const {
      appid,
      hash,
      id,
      jointournamentid,
      username,
      timestamp,
      extendedinfo,
    } = req.body;

    if (!appid || !hash || !username || !id) {
      return res.status(200).json({
        Username: null,
        Balance: 0.0,
        Message: "Invalid parameters",
        Status: 4,
      });
    }

    if (appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid AppID",
        Status: 2,
      });
    }

    const fields = {
      appid: jokerAppID,
      id: id,
      jointournamentid: jointournamentid,
      timestamp: timestamp,
      username: username,
    };

    const secretkey = jokerSecret;

    const generatedHash = generateSignature(fields, secretkey);

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }
    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingTournament, existingCancelTournament] =
      await Promise.all([
        User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
        SlotJokerModal.findOne({
          betId: jointournamentid,
          tournament: true,
        }).lean(),
        SlotJokerModal.findOne({ cancelTournamentId: id }, { _id: 1 }).lean(),
      ]);
    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (!existingTournament) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Join Tournament not found",
        Status: 0,
      });
    }

    if (existingCancelTournament) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Join Tournament has been cancelled or settled",
        Status: 0,
      });
    }

    const refundAmount = existingTournament.betamount || 0;

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(refundAmount) } },
        { new: true, projection: { wallet: 1 } }
      ),
      SlotJokerModal.findOneAndUpdate(
        { betId: jointournamentid },
        {
          $set: {
            canceltournament: true,
            cancelTournamentId: id,
          },
        },
        { new: true }
      ),
    ]);

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("cancel-join-tournament", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/joker/win-tournament", async (req, res) => {
  try {
    const {
      appid,
      hash,
      id,
      tournamentid,
      username,
      amount,
      timestamp,
      extendedinfo,
    } = req.body;

    if (!appid || !hash || !amount || !username || !id) {
      return res.status(200).json({
        Username: null,
        Balance: 0.0,
        Message: "Invalid parameters",
        Status: 4,
      });
    }
    if (appid !== jokerAppID) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid AppID",
        Status: 2,
      });
    }

    const formattedAmountForHashing = roundToTwoDecimalsForHashing(amount);

    const fields = {
      amount: formattedAmountForHashing,
      appid: jokerAppID,
      id: id,
      timestamp: timestamp,
      tournamentid: tournamentid,
      username: username,
    };

    const secretkey = jokerSecret;

    const generatedHash = generateSignature(fields, secretkey);

    if (hash !== generatedHash) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid signature",
        Status: 5,
      });
    }

    const isDoubleBetting = username.endsWith("2X");
    const actualGameId = isDoubleBetting ? username.slice(0, -2) : username;

    const [user, existingSettleWinTournament] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { wallet: 1 }).lean(),
      SlotJokerModal.findOne(
        {
          username: username,
          settleTournamentId: id,
        },
        { _id: 1 }
      ).lean(),
    ]);

    if (!user) {
      return res.status(200).json({
        Balance: 0.0,
        Message: "Invalid Username or Password",
        Status: 7,
      });
    }

    if (existingSettleWinTournament) {
      const actualAmount = isDoubleBetting ? user.wallet * 0.5 : user.wallet;

      return res.status(200).json({
        Balance: roundToTwoDecimals(actualAmount),
        Message: "Join Tournament has been cancelled or settled",
        Status: 0,
      });
    }

    const actualUpdateBalance = isDoubleBetting
      ? roundToTwoDecimals(amount) * 2
      : roundToTwoDecimals(amount);

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: actualUpdateBalance } },
        { new: true, projection: { wallet: 1 } }
      ),
      SlotJokerModal.findOneAndUpdate(
        { username: username, betId: tournamentid },
        {
          $set: {
            settletournament: true,
            settleamount: actualUpdateBalance,
            settleTournamentId: id,
          },
        },
        { upsert: true, new: true }
      ),
    ]);

    const actualAmount = isDoubleBetting
      ? (updatedUserBalance?.wallet || 0) * 0.5
      : updatedUserBalance?.wallet || 0;

    return res.status(200).json({
      Balance: roundToTwoDecimals(actualAmount),
      Message: "Success",
      Status: 0,
    });
  } catch (error) {
    console.log("win-tournament", error.message);
    return res.status(500).json({
      Balance: 0.0,
      Message: "Other",
      Status: 1000,
    });
  }
});

router.post("/api/jokerslot/getturnoverforrebate", async (req, res) => {
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

    console.log("JOKER SLOT QUERYING TIME", startDate, endDate);

    const records = await SlotJokerModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      gametype: "SLOT",
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
        console.warn(`JOKER User not found for gameId: ${gameId}`);
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
    return res.status(200).json({
      success: true,
      summary: {
        gamename: "JOKER",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("JOKER: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "JOKER: Failed to fetch win/loss report",
        zh: "JOKER: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/jokerslot2x/getturnoverforrebate", async (req, res) => {
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

    console.log("JOKER SLOT QUERYING TIME", startDate, endDate);

    const records = await SlotJokerModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      gametype: "SLOT",
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
        console.warn(`JOKER2X User not found for gameId: ${gameId}`);
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
        gamename: "JOKER2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("JOKER: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "JOKER: Failed to fetch win/loss report",
        zh: "JOKER: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/jokerslot/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotJokerModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        gametype: "SLOT",
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
          gamename: "JOKER",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("JOKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerslot2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotJokerModal.find({
        username: `${user.gameId}2X`,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        gametype: "SLOT",
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
          gamename: "JOKER2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("JOKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerslot/:userId/gamedata",
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
          const gameCat = Object.fromEntries(gameCategories["Slot Games"]);

          if (gameCat["JOKER"]) {
            totalTurnover += gameCat["JOKER"].turnover || 0;
            totalWinLoss += gameCat["JOKER"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("JOKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerslot2x/:userId/gamedata",
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
          const gameCat = Object.fromEntries(gameCategories["Slot Games"]);

          if (gameCat["JOKER2X"]) {
            totalTurnover += gameCat["JOKER2X"].turnover || 0;
            totalWinLoss += gameCat["JOKER2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("JOKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerslot/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotJokerModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        gametype: "SLOT",
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
          gamename: "JOKER",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("JOKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerslot2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotJokerModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        gametype: "SLOT",
        cancel: { $ne: true },
        refund: { $ne: true },
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
          gamename: "JOKER2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("JOKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerslot/kioskreport",
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
          const gameCat = Object.fromEntries(gameCategories["Slot Games"]);

          if (gameCat["JOKER"]) {
            totalTurnover += Number(gameCat["JOKER"].turnover || 0);
            totalWinLoss += Number(gameCat["JOKER"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("JOKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerslot2x/kioskreport",
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
          const gameCat = Object.fromEntries(gameCategories["Slot Games"]);

          if (gameCat["JOKER2X"]) {
            totalTurnover += Number(gameCat["JOKER2X"].turnover || 0);
            totalWinLoss += Number(gameCat["JOKER2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("JOKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

// ----------------
router.post("/api/jokerfish/getturnoverforrebate", async (req, res) => {
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

    console.log("JOKER FISH QUERYING TIME", startDate, endDate);

    const records = await SlotJokerModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      gametype: "FISH",
      cancel: { $ne: true },
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
    // Aggregate turnover and win/loss for each player
    let playerSummary = {};

    records.forEach((record) => {
      const gameId = record.username;
      const actualUsername = gameIdToUsername[gameId];

      if (!playerSummary[actualUsername]) {
        playerSummary[actualUsername] = { turnover: 0, winloss: 0 };
      }

      playerSummary[actualUsername].turnover += record.fishTurnover || 0;

      playerSummary[actualUsername].winloss += record.fishWinLoss || 0;
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
        gamename: "JOKER",
        gamecategory: "Fishing",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("JOKER: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "JOKER: Failed to fetch win/loss report",
        zh: "JOKER: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/jokerfish/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotJokerModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        gametype: "FISH",
        cancel: { $ne: true },
        settle: true,
      });

      // Aggregate turnover and win/loss for each player
      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.fishTurnover || 0;
        totalWinLoss += record.fishWinLoss || 0;
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));
      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER",
          gamecategory: "Fishing",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("JOKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerfish/:userId/gamedata",
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
          gameCategories["Fishing"] &&
          gameCategories["Fishing"] instanceof Map
        ) {
          const gameCat = Object.fromEntries(gameCategories["Fishing"]);

          if (gameCat["JOKER"]) {
            totalTurnover += gameCat["JOKER"].turnover || 0;
            totalWinLoss += gameCat["JOKER"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER",
          gamecategory: "Fishing",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("JOKER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerfish/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotJokerModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        gametype: "FISH",
        cancel: { $ne: true },
        settle: true,
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.fishTurnover || 0;

        totalWinLoss += record.fishWinLoss || 0;
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER",
          gamecategory: "Fishing",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("JOKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/jokerfish/kioskreport",
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
          gameCategories["Fishing"] &&
          gameCategories["Fishing"] instanceof Map
        ) {
          const gameCat = Object.fromEntries(gameCategories["Fishing"]);

          if (gameCat["JOKER"]) {
            totalTurnover += Number(gameCat["JOKER"].turnover || 0);
            totalWinLoss += Number(gameCat["JOKER"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "JOKER",
          gamecategory: "Fishing",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("JOKER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "JOKER: Failed to fetch win/loss report",
          zh: "JOKER: 获取盈亏报告失败",
        },
      });
    }
  }
);

// router.post("/api/joker/checkgameRound", async (req, res) => {
//   try {
//     // Configuration - replace with your actual values
//     const config = {
//       appId: jokerAppID,
//       secretKey: jokerSecret,
//     };

//     const timestamp = Math.floor(Date.now() / 1000);

//     const params = {
//       AppID: config.appId,
//       Timestamp: timestamp,
//       RoundID: "xjtok1i4o8knk",
//     };

//     // Generate hash signature
//     const hash = generateSignature(params, config.secretKey);

//     if (!hash) {
//       return res.status(500).json({
//         success: false,
//         message: "Failed to generate signature hash",
//       });
//     }

//     // Add hash to parameters
//     params.Hash = hash;
//     params.Username = "VK51C9U2X";
//     // Make API request
//     const response = await axios.post(
//       `${jokerApiURL}/game-round-status`,
//       params,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//         timeout: 30000, // 30 second timeout
//       }
//     );

//     return res.status(200).json({
//       success: true,

//       timestamp: new Date().toISOString(),
//       data: response.data,
//     });
//   } catch (error) {
//     console.error("❌ List games error:", error.message);

//     // Handle specific error types
//     if (error.response) {
//       // API responded with error status
//       console.error("API Error Response:", error.response.data);
//       return res.status(200).json({
//         success: false,
//         message: "Game provider API error",
//         error: {
//           status: error.response.status,
//           data: error.response.data,
//         },
//       });
//     } else if (error.request) {
//       // Request timeout or network error
//       console.error("Network Error:", error.request);
//       return res.status(200).json({
//         success: false,
//         message: "Network error when calling game provider API",
//         error: "NETWORK_ERROR",
//       });
//     } else {
//       // Other error
//       return res.status(500).json({
//         success: false,
//         message: "Internal server error while fetching games list",
//         error: error.message,
//       });
//     }
//   }
// });

module.exports = router;
