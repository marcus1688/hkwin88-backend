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
const { adminUser, adminLog } = require("../../models/adminuser.model");
const SlotLiveGSCModal = require("../../models/slot_live_gsc.model");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const Decimal = require("decimal.js");
const moment = require("moment");
const qs = require("querystring");
const GameWalletLog = require("../../models/gamewalletlog.model");
const GameRedTigerGameModal = require("../../models/slot_redtigerDatabase.model");
const GameNetentGameModal = require("../../models/slot_netentDatabase.model");
require("dotenv").config();

const gsiOPCode = "J718";
const gsiSecret = process.env.GSI_SECRET;
const webURL = "https://www.ezwin9.com/";
const gsiAPIURL = "https://production.gsimw.com/";

function generateSignature(requestTime, method) {
  const raw = `${requestTime}${gsiSecret}${method}${gsiOPCode}`;

  return crypto.createHash("md5").update(raw).digest("hex");
}

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

function generateCallbackSignature(requestTime, method) {
  const raw = `${gsiOPCode}${requestTime}${method}${gsiSecret}`;

  return crypto.createHash("md5").update(raw).digest("hex");
}

function generateRandomPassword() {
  const randomNumber = crypto.randomInt(1000, 10000);

  return `EZW${randomNumber}`;
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

router.post("/api/redtiger/getgamelist", async (req, res) => {
  try {
    const games = await GameRedTigerGameModal.find({
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
      Hot: game.hot || false,
      RTP: game.rtpRate,
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.log("RED TIGER error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "RED TIGER: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "RED TIGER: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "RED TIGER: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "RED TIGER: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "RED TIGER: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/netent/getgamelist", async (req, res) => {
  try {
    const games = await GameNetentGameModal.find({
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
      GameType: game.gameType,
      GameImage: game.imageUrlEN || "",
      GameImageZH: game.imageUrlCN || "",
      Hot: game.hot || false,
      RTP: game.rtpRate,
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.log("NETENT error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "NETENT: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "NETENT: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "NETENT: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "NETENT: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "NETENT: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/gsc/sync-redtiger", async (req, res) => {
  try {
    // 1) Call provider API
    const requestTime = moment.utc().unix();
    const sign = generateSignature(requestTime, "gamelist");

    const response = await axios.get(
      `${gsiAPIURL}api/operators/provider-games`,
      {
        params: {
          product_code: "1168",
          operator_code: gsiOPCode,
          sign,
          request_time: requestTime,
        },
        timeout: 15000,
      }
    );

    if (response.data.code !== 0) {
      console.log("RedTiger ERROR IN GETTING GAME LIST", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "RedTiger: Unable to retrieve game lists. Please contact customer service for assistance.",
          zh: "RedTiger: 无法获取游戏列表，请联系客服以获取帮助。",
          ms: "RedTiger: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        },
      });
    }

    // 2) Reformat + only activated
    const apiGames = (response.data.provider_games || [])
      .filter((g) => g.status === "ACTIVATED")
      .map((g) => ({
        GameCode: g.game_code,
        GameNameEN: g.game_name,
        GameType:
          g.game_type === "SLOT"
            ? "Slot"
            : g.game_type === "FISHING"
            ? "Fishing"
            : g.game_type, // keep as-is for others
        GameImage: g.image_url,
      }));

    // Sets for fast lookup
    const apiCodesSet = new Set(apiGames.map((g) => String(g.GameCode)));

    // 3) Pull all existing DB games (include gameNameEN for extra games reporting)
    const dbGames = await GameNetentGameModal.find(
      {},
      { gameID: 1, gameNameEN: 1, maintenance: 1 }
    ).lean();
    const dbIdsSet = new Set(dbGames.map((d) => String(d.gameID)));

    // 4) Compute missing games (in API but not in DB)
    const missingGames = apiGames
      .filter((g) => !dbIdsSet.has(String(g.GameCode)))
      .map((g) => ({
        GameCode: g.GameCode,
        GameType: g.GameType,
        GameNameEN: g.GameNameEN,
      }));

    // 5) Compute extra games (in DB but not in API)
    const extraGames = dbGames
      .filter((d) => !apiCodesSet.has(String(d.gameID)))
      .map((d) => ({
        GameCode: d.gameID,
        GameNameEN: d.gameNameEN,
      }));

    // 6) Compute the two update groups for maintenance flag
    //    - present in API => maintenance: false
    //    - not in API but in DB => maintenance: true
    const apiCodesArray = Array.from(apiCodesSet);

    // Bulk updates—guard against empty arrays
    const bulkOps = [];

    if (apiCodesArray.length > 0) {
      bulkOps.push({
        updateMany: {
          filter: { gameID: { $in: apiCodesArray } },
          update: { $set: { maintenance: false } },
        },
      });
    }

    // Find DB gameIDs not present in API
    if (dbGames.length > 0) {
      const dbOnlyIds = dbGames
        .map((d) => String(d.gameID))
        .filter((id) => !apiCodesSet.has(id));
      if (dbOnlyIds.length > 0) {
        bulkOps.push({
          updateMany: {
            filter: { gameID: { $in: dbOnlyIds } },
            update: { $set: { maintenance: true } },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await GameNetentGameModal.bulkWrite(bulkOps, { ordered: false });
    }

    return res.status(200).json({
      success: true,
      summary: {
        apiCount: apiGames.length,
        dbCount: dbGames.length,
        missingCount: missingGames.length,
        extraCount: extraGames.length,
      },
      missingGames, // list of games present in API but absent in DB
      extraGames, // list of games present in DB but absent in API
    });
  } catch (error) {
    console.log("RedTiger sync error:", error?.response?.data || error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "RedTiger: Unable to sync game lists. Please contact customer service for assistance.",
        zh: "RedTiger: 无法同步游戏列表，请联系客服以获取帮助。",
        ms: "RedTiger: Tidak dapat menyegerakkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/gsc/update-specific-netent-timestamps", async (req, res) => {
  try {
    const { gameNames, startDateTime = null } = req.body;

    // Default game names if not provided in request body
    const gamesToUpdate = gameNames || [
      "Milkshake XXXtreme",
      "Reel Rush",
      "Starburst",
      "Twin Spin",
      "Parthenon: Quest for Immortality",
      "Reel Rush XXXtreme",
      "Divine Fortune",
      "King of Slots",
      "Dazzle Me Christmas",
      "Starburst Galaxy",
      "Big Bang Boom",
      "Divine Fortune Black",
      "Gonzo's Quest",
      "Finn's Golden Tavern",
      "Finn and the Swirly Spin",
      "Lock And Pop",
      "Big Money Wheel",
      "Dead or Alive 2 Feature Buy",
      "Finn and the Candy Spin",
      "Funk Master",
    ];

    console.log(
      `Updating timestamps for ${gamesToUpdate.length} specific NetEnt games...`
    );

    // Helper function to normalize game names for comparison
    function normalizeGameName(name) {
      if (!name) return "";
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") // Remove all special characters, spaces, TM, etc.
        .trim();
    }

    // Use custom start time or current time
    const startTime = startDateTime
      ? moment(startDateTime).add(60, "days").utc()
      : moment().add(60, "days").utc();

    if (startDateTime && !startTime.isValid()) {
      return res.status(400).json({
        success: false,
        message: {
          en: "Invalid startDateTime format. Please use ISO 8601 format (e.g., '2024-01-01T00:00:00Z').",
          zh: "无效的开始时间格式。请使用 ISO 8601 格式。",
          ms: "Format masa permulaan tidak sah. Sila gunakan format ISO 8601.",
        },
      });
    }

    console.log(`Starting timestamp: ${startTime.toISOString()}`);

    // Get all games from database to create a mapping
    const allGames = await GameNetentGameModal.find(
      {},
      { gameID: 1, gameNameEN: 1 }
    ).lean();

    // Create a map of normalized names to actual game documents
    const normalizedGameMap = new Map();
    allGames.forEach((game) => {
      const normalized = normalizeGameName(game.gameNameEN);
      normalizedGameMap.set(normalized, game);
    });

    console.log(`Found ${allGames.length} games in database`);

    // Use direct MongoDB collection to bypass Mongoose timestamps
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;
    const collection = db.collection("gamenetentgamemodals");

    const bulkOps = [];
    const matchedGames = [];
    const notMatchedGames = [];

    // Prepare timestamp updates for games based on order in array
    for (let i = 0; i < gamesToUpdate.length; i++) {
      const requestedGameName = gamesToUpdate[i];
      const normalizedRequestedName = normalizeGameName(requestedGameName);

      // Find matching game in database
      const matchedGame = normalizedGameMap.get(normalizedRequestedName);

      if (matchedGame) {
        // Calculate timestamp: first game gets start time, each subsequent game gets 30 minutes earlier
        const gameTimestamp = moment(startTime)
          .subtract(i * 30, "minutes")
          .utc()
          .toDate();

        console.log(
          `Game ${
            i + 1
          }: "${requestedGameName}" (normalized: "${normalizedRequestedName}") matched with DB game "${
            matchedGame.gameNameEN
          }" -> timestamp: ${moment(gameTimestamp).toISOString()}`
        );

        bulkOps.push({
          updateOne: {
            filter: { gameID: matchedGame.gameID },
            update: {
              $set: {
                createdAt: gameTimestamp,
                updatedAt: new Date(),
              },
            },
          },
        });

        matchedGames.push({
          requestedName: requestedGameName,
          dbGameName: matchedGame.gameNameEN,
          gameID: matchedGame.gameID,
          position: i + 1,
        });
      } else {
        console.log(
          `Game ${
            i + 1
          }: "${requestedGameName}" (normalized: "${normalizedRequestedName}") - NO MATCH FOUND`
        );
        notMatchedGames.push({
          requestedName: requestedGameName,
          normalizedName: normalizedRequestedName,
          position: i + 1,
        });
      }
    }

    // Execute bulk operation directly on MongoDB collection if there are operations
    let bulkResult = {
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
    };

    if (bulkOps.length > 0) {
      console.log(
        `Executing bulk timestamp updates for ${bulkOps.length} games via direct MongoDB...`
      );
      bulkResult = await collection.bulkWrite(bulkOps);

      console.log("Bulk write result:", {
        matchedCount: bulkResult.matchedCount,
        modifiedCount: bulkResult.modifiedCount,
        upsertedCount: bulkResult.upsertedCount,
      });
    } else {
      console.log("No games matched, skipping bulk update");
    }

    // Verify the updates by fetching the updated documents
    const gameIDsToFetch = matchedGames.map((g) => g.gameID);
    const updatedGames = await GameNetentGameModal.find(
      { gameID: { $in: gameIDsToFetch } },
      { gameID: 1, gameNameEN: 1, createdAt: 1, updatedAt: 1 }
    ).sort({ createdAt: -1 });

    const foundGames = updatedGames.map((game) => {
      const matchInfo = matchedGames.find((m) => m.gameID === game.gameID);
      return {
        gameID: game.gameID,
        gameNameEN: game.gameNameEN,
        requestedName: matchInfo?.requestedName,
        newCreatedAt: game.createdAt,
        requestedPosition: matchInfo?.position || 0,
        minutesFromLatest: (matchInfo?.position - 1) * 30,
      };
    });

    console.log(
      `Successfully updated timestamps for ${foundGames.length} games`
    );
    console.log(`Games not matched in database: ${notMatchedGames.length}`);

    return res.status(200).json({
      success: true,
      message: `Successfully updated timestamps for ${bulkResult.modifiedCount} specific NetEnt games using direct MongoDB operations with normalized name matching.`,
      data: {
        totalRequestedGames: gamesToUpdate.length,
        gamesMatched: matchedGames.length,
        gamesFoundAndUpdated: bulkResult.modifiedCount,
        gamesNotMatched: notMatchedGames.length,
        timeRange: {
          latest: {
            requestedName: foundGames[0]?.requestedName,
            gameNameEN: foundGames[0]?.gameNameEN,
            gameID: foundGames[0]?.gameID,
            createdAt: foundGames[0]?.newCreatedAt,
            position: 1,
          },
          oldest: {
            requestedName: foundGames[foundGames.length - 1]?.requestedName,
            gameNameEN: foundGames[foundGames.length - 1]?.gameNameEN,
            gameID: foundGames[foundGames.length - 1]?.gameID,
            createdAt: foundGames[foundGames.length - 1]?.newCreatedAt,
            position: foundGames.length,
          },
        },
        updatedGames: foundGames.map((game) => ({
          gameID: game.gameID,
          gameNameEN: game.gameNameEN,
          requestedName: game.requestedName,
          requestedPosition: game.requestedPosition,
          minutesFromLatest: game.minutesFromLatest,
          createdAt: game.newCreatedAt,
        })),
        gamesNotMatchedInDatabase: notMatchedGames.map((game) => ({
          requestedName: game.requestedName,
          normalizedName: game.normalizedName,
          requestedPosition: game.position,
          expectedTimestamp: moment(startTime)
            .subtract((game.position - 1) * 30, "minutes")
            .utc()
            .toISOString(),
        })),
        matchedGamesMapping: matchedGames.map((m) => ({
          requestedName: m.requestedName,
          dbGameName: m.dbGameName,
          gameID: m.gameID,
        })),
        bulkWriteStats: {
          matchedCount: bulkResult.matchedCount,
          modifiedCount: bulkResult.modifiedCount,
          upsertedCount: bulkResult.upsertedCount,
        },
        requestedOrder: gamesToUpdate,
        timestampInfo: {
          startTime: startTime.toISOString(),
          intervalMinutes: 30,
          totalTimeSpan: `${(gamesToUpdate.length - 1) * 30} minutes`,
          endTime: moment(startTime)
            .subtract((gamesToUpdate.length - 1) * 30, "minutes")
            .utc()
            .toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Error updating specific NetEnt game timestamps:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "NetEnt: Unable to update timestamps. Please contact customer service for assistance.",
        zh: "NetEnt: 无法更新时间戳，请联系客服以获取帮助。",
        ms: "NetEnt: Tidak dapat mengemas kini cap masa. Sila hubungi khidmat pelanggan untuk bantuan.",
      },
      error: error.message,
    });
  }
});

router.post("/api/gsc/update-redtiger-timestamps", async (req, res) => {
  try {
    const requestTime = moment.utc().unix();
    const sign = generateSignature(requestTime, "gamelist");

    console.log("Starting RedTiger timestamp update based on API order...");

    // 1) Get games from API
    const response = await axios.get(
      `${gsiAPIURL}api/operators/provider-games`,
      {
        params: {
          product_code: "1168",
          operator_code: gsiOPCode,
          sign,
          request_time: requestTime,
        },
        timeout: 15000,
      }
    );

    if (response.data.code !== 0) {
      console.log("RedTiger ERROR IN GETTING GAME LIST", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "RedTiger: Unable to retrieve game lists. Please contact customer service for assistance.",
          zh: "RedTiger: 无法获取游戏列表，请联系客服以获取帮助。",
          ms: "RedTiger: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        },
      });
    }

    // 2) Filter activated games and get game codes in order
    const apiGames = response.data.provider_games.filter(
      (game) => game.status === "ACTIVATED"
    );

    if (apiGames.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No activated games found in API response",
      });
    }

    // 3) Use direct MongoDB collection to bypass Mongoose timestamps
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;
    const collection = db.collection("gamenetentgamemodals"); // RedTiger collection name

    const now = moment.utc();
    const gameCodesInOrder = apiGames.map((game) => game.game_code);

    console.log(`Found ${gameCodesInOrder.length} games in API response`);

    const bulkOps = [];

    // 4) Prepare timestamp updates for games based on API order
    for (let i = 0; i < gameCodesInOrder.length; i++) {
      const gameCode = gameCodesInOrder[i];

      // Calculate timestamp: first game = now, each subsequent game = 30 minutes earlier
      const gameTimestamp = moment(now)
        .subtract(i * 30, "minutes")
        .utc()
        .toDate();

      console.log(
        `Game ${i + 1}: ${gameCode} will get timestamp: ${moment(
          gameTimestamp
        ).toISOString()}`
      );

      bulkOps.push({
        updateOne: {
          filter: { gameID: String(gameCode) },
          update: {
            $set: {
              createdAt: gameTimestamp,
              updatedAt: new Date(),
            },
          },
        },
      });
    }

    // 5) Execute bulk operation directly on MongoDB collection
    console.log("Executing bulk timestamp updates via direct MongoDB...");
    const bulkResult = await collection.bulkWrite(bulkOps);

    console.log("Bulk write result:", {
      matchedCount: bulkResult.matchedCount,
      modifiedCount: bulkResult.modifiedCount,
      upsertedCount: bulkResult.upsertedCount,
    });

    // 6) Verify the updates by fetching the updated documents
    const updatedGames = await GameNetentGameModal.find(
      { gameID: { $in: gameCodesInOrder } },
      { gameID: 1, gameNameEN: 1, createdAt: 1, updatedAt: 1 }
    ).sort({ createdAt: -1 });

    // Separate found and not found games
    const foundGameIds = updatedGames.map((game) => game.gameID);
    const notFoundGames = gameCodesInOrder.filter(
      (code) => !foundGameIds.includes(String(code))
    );

    const foundGames = updatedGames.map((game) => ({
      gameID: game.gameID,
      gameNameEN: game.gameNameEN,
      newCreatedAt: game.createdAt,
      apiPosition: gameCodesInOrder.indexOf(game.gameID) + 1,
      minutesFromLatest: gameCodesInOrder.indexOf(game.gameID) * 30,
    }));

    // Get detailed info about missing games from API data
    const missingGamesDetails = notFoundGames.map((code) => {
      const apiGame = apiGames.find((game) => game.game_code === code);

      return {
        gameCode: code,
        gameNameEN: apiGame?.game_name || "Unknown",
        apiPosition: gameCodesInOrder.indexOf(code) + 1,
        expectedTimestamp: moment(now)
          .subtract(gameCodesInOrder.indexOf(code) * 30, "minutes")
          .utc()
          .toISOString(),
      };
    });

    console.log(
      `Successfully updated timestamps for ${foundGames.length} games`
    );
    console.log(`Games not found in database: ${notFoundGames.length}`);

    // 7) Return summary
    return res.status(200).json({
      success: true,
      message: `Successfully updated timestamps for ${bulkResult.modifiedCount} RedTiger games based on API order using direct MongoDB operations.`,
      data: {
        totalApiGames: gameCodesInOrder.length,
        gamesFoundAndUpdated: bulkResult.modifiedCount,
        gamesMatched: bulkResult.matchedCount,
        gamesNotFoundInDb: notFoundGames.length,
        timeRange: {
          latest: {
            gameCode: foundGames[0]?.gameID,
            gameName: foundGames[0]?.gameNameEN,
            createdAt: foundGames[0]?.newCreatedAt,
            position: 1,
          },
          oldest: {
            gameCode: foundGames[foundGames.length - 1]?.gameID,
            gameName: foundGames[foundGames.length - 1]?.gameNameEN,
            createdAt: foundGames[foundGames.length - 1]?.newCreatedAt,
            position: foundGames.length,
          },
        },
        updatedGames: foundGames.map((game) => ({
          gameID: game.gameID,
          gameNameEN: game.gameNameEN,
          apiPosition: game.apiPosition,
          minutesFromLatest: game.minutesFromLatest,
          createdAt: game.newCreatedAt,
        })),
        gamesNotFoundInDatabase: missingGamesDetails,
        bulkWriteStats: {
          matchedCount: bulkResult.matchedCount,
          modifiedCount: bulkResult.modifiedCount,
          upsertedCount: bulkResult.upsertedCount,
        },
        apiOrder: gameCodesInOrder,
        timestampInfo: {
          startTime: now.toISOString(),
          intervalMinutes: 30,
          totalTimeSpan: `${(gameCodesInOrder.length - 1) * 30} minutes`,
          endTime: moment(now)
            .subtract((gameCodesInOrder.length - 1) * 30, "minutes")
            .utc()
            .toISOString(),
        },
      },
      examples: apiGames.slice(0, 5).map((game, index) => ({
        gameCode: game.game_code,
        gameName: game.game_name,
        position: index + 1,
        newTimestamp: moment(now)
          .subtract(index * 30, "minutes")
          .toISOString(),
      })),
    });
  } catch (error) {
    console.log(
      "RedTiger timestamp update error:",
      error?.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      message: {
        en: "RedTiger: Unable to update timestamps. Please contact customer service for assistance.",
        zh: "RedTiger: 无法更新时间戳，请联系客服以获取帮助。",
        ms: "RedTiger: Tidak dapat mengemas kini cap masa. Sila hubungi khidmat pelanggan untuk bantuan.",
      },
      error: error.message,
    });
  }
});

router.post("/api/gsc/getProductList", async (req, res) => {
  try {
    const requestTime = moment.utc().unix();
    const sign = generateSignature(requestTime, "productlist");

    const response = await axios.get(
      `${gsiAPIURL}api/operators/available-products`,
      {
        params: {
          operator_code: gsiOPCode,
          sign,
          request_time: requestTime,
        },
      }
    );
    console.log(response.data);
    return res.status(200).json({
      success: true,
      product: response.data,
    });
  } catch (error) {
    console.log("GSC error in launching game", error.response.data);
    return res.status(200).json({
      success: false,
    });
  }
});

router.post("/api/gsc/getprovidergamelist", async (req, res) => {
  try {
    const requestTime = moment.utc().unix();
    const sign = generateSignature(requestTime, "gamelist");

    const response = await axios.get(
      `${gsiAPIURL}api/operators/provider-games`,
      {
        params: {
          product_code: "1169",
          operator_code: gsiOPCode,
          sign,
          request_time: requestTime,
        },
      }
    );

    if (response.data.code !== 0) {
      console.log("NETENT ERROR IN GETTING GAME LIST", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "NETENT: Unable to retrieve game lists. Please contact customer service for assistance.",
          zh: "NETENT: 无法获取游戏列表，请联系客服以获取帮助。",
          ms: "NETENT: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        },
      });
    }
    console.log(response.data.provider_games);
    const reformattedGamelist = response.data.provider_games
      .filter((game) => game.status === "ACTIVATED")
      .map((game) => ({
        GameCode: game.game_code,
        GameNameEN: game.game_name,
        GameType:
          game.game_type === "SLOT"
            ? "Slot"
            : game.game_type === "FISHING"
            ? "Fishing"
            : game.game_type,
        GameImage: game.image_url,
      }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.log("NETENT error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "NETENT: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "NETENT: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "NETENT: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/gsc/getwagerlist", async (req, res) => {
  try {
    // Get parameters from query string
    const { startDate, endDate, offset = 0, size = 100 } = req.query;

    // Calculate timestamps in milliseconds
    let start, end;

    if (startDate && endDate) {
      start = moment(startDate).valueOf();
      end = moment(endDate).valueOf();
    } else {
      // Default to today
      start = moment().utc().add(8, "hours").startOf("day").valueOf();

      end = moment().utc().add(8, "hours").valueOf();
    }

    const requestTime = moment.utc().unix();
    const sign = generateSignature(requestTime, "getwagers");

    // Build query params for the external API
    const params = {
      operator_code: gsiOPCode,
      start: start,
      end: end,
      offset: parseInt(offset),
      size: parseInt(size),
      sign: sign,
      request_time: requestTime,
    };

    console.log("GSC Wager Request params:", params);

    // Make GET request with query parameters
    const response = await axios.get(`${gsiAPIURL}api/operators/wagers`, {
      params: params, // Axios will convert this to query string
      headers: {
        "Content-Type": "application/json",
      },
    });

    return res.status(200).json({
      success: true,
      data: response.data,
      message: {
        en: "Wager list retrieved successfully.",
        zh: "投注列表获取成功。",
        ms: "Senarai pertaruhan berjaya diperoleh.",
        zh_hk: "投注列表獲取成功。",
        id: "Daftar taruhan berhasil diambil.",
      },
    });
  } catch (error) {
    console.error(
      "GSC error in fetching wager list:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: {
        en: "GSC: Failed to retrieve wager list. Please try again or contact customer service.",
        zh: "GSC: 获取投注列表失败，请重试或联系客服。",
        ms: "GSC: Gagal mendapatkan senarai pertaruhan. Sila cuba lagi atau hubungi khidmat pelanggan.",
        zh_hk: "GSC: 獲取投注列表失敗，請重試或聯絡客服。",
        id: "GSC: Gagal mengambil daftar taruhan. Silakan coba lagi atau hubungi layanan pelanggan.",
      },
    });
  }
});

router.post(
  "/api/dreamgaming/launchGame",
  authenticateToken,
  async (req, res) => {
    try {
      const { gameLang, clientPlatform } = req.body;
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

      if (user.gameLock.gsi.lock) {
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

      let clientIp = req.headers["x-forwarded-for"] || req.ip;
      clientIp = clientIp.split(",")[0].trim();

      let lang = "0";

      if (gameLang === "en") {
        lang = "0";
      } else if (gameLang === "zh") {
        lang = "2";
      } else if (gameLang === "zh_hk") {
        lang = "1";
      } else if (gameLang === "ms") {
        lang = "36";
      } else if (gameLang === "id") {
        lang = "4";
      }

      let platform = "WEB";
      if (clientPlatform === "web") {
        platform = "WEB";
      } else if (clientPlatform === "mobile") {
        platform = "MOBILE";
      }

      const requestTime = moment.utc().unix();
      const sign = generateSignature(requestTime, "launchgame");

      const randomPass = generateRandomPassword();

      const fields = {
        operator_code: gsiOPCode,
        member_account: user.gameId,
        password: randomPass,
        nickname: user.username,
        currency: "HKD",
        product_code: 1052,
        game_type: "LIVE_CASINO",
        language_code: lang,
        ip: clientIp,
        platform,
        sign,
        request_time: requestTime,
        operator_lobby_url: webURL,
      };

      const response = await axios.post(
        `${gsiAPIURL}api/operators/launch-game`,
        fields,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.code !== 200) {
        console.log(`Dream Gaming error to launch game`, response.data);

        if (response.data.code === 2000) {
          return res.status(200).json({
            success: false,
            message: {
              en: "Game under maintenance. Please try again later.",
              zh: "游戏正在维护中，请稍后再试。",
              ms: "Permainan sedang diselenggara, sila cuba lagi nanti.",
              zh_hk: "遊戲正在維護中，請稍後再試。",
              id: "Permainan sedang dalam pemeliharaan. Silakan coba lagi nanti.",
            },
          });
        }

        return res.status(200).json({
          success: false,
          message: {
            en: "DREAM GAMING: Game launch failed. Please try again or customer service for assistance.",
            zh: "DREAM GAMING: 游戏启动失败，请重试或联系客服以获得帮助。",
            ms: "DREAM GAMING: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "DREAM GAMING: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
            id: "DREAM GAMING: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      await GameWalletLogAttempt(
        user.username,
        "Transfer In",
        "Seamless",
        roundToTwoDecimals(user.wallet),
        "DREAM GAMING"
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
      console.log("DREAM GAMING error in launching game", error.response.data);

      return res.status(200).json({
        success: false,
        message: {
          en: "DREAM GAMING: Game launch failed. Please try again or customer service for assistance.",
          zh: "DREAM GAMING: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "DREAM GAMING: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "DREAM GAMING: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
          id: "DREAM GAMING: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }
  }
);

router.post("/api/redtiger/launchGame", authenticateToken, async (req, res) => {
  try {
    const { gameLang, clientPlatform, isDouble, gameCode } = req.body;
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

    if (user.gameLock.gsi.lock) {
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

    let clientIp = req.headers["x-forwarded-for"] || req.ip;
    clientIp = clientIp.split(",")[0].trim();

    let lang = "0";

    if (gameLang === "en") {
      lang = "0";
    } else if (gameLang === "zh") {
      lang = "2";
    } else if (gameLang === "zh_hk") {
      lang = "1";
    } else if (gameLang === "ms") {
      lang = "36";
    } else if (gameLang === "id") {
      lang = "4";
    }

    let platform = "WEB";
    if (clientPlatform === "web") {
      platform = "WEB";
    } else if (clientPlatform === "mobile") {
      platform = "MOBILE";
    }

    const requestTime = moment.utc().unix();
    const sign = generateSignature(requestTime, "launchgame");

    const randomPass = generateRandomPassword();

    let playerId;
    if (isDouble === true) {
      playerId = `${user.gameId}2x`;
    } else {
      playerId = `${user.gameId}`;
    }

    const fields = {
      operator_code: gsiOPCode,
      member_account: playerId,
      password: randomPass,
      nickname: user.username,
      currency: "HKD",
      game_code: gameCode,
      product_code: 1169,
      game_type: "SLOT",
      language_code: lang,
      ip: clientIp,
      platform,
      sign,
      request_time: requestTime,
      operator_lobby_url: webURL,
    };

    const response = await axios.post(
      `${gsiAPIURL}api/operators/launch-game`,
      fields,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.code !== 200) {
      console.log(`Red Tiger error to launch game`, response.data);

      if (response.data.code === 2000) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Game under maintenance. Please try again later.",
            zh: "游戏正在维护中，请稍后再试。",
            ms: "Permainan sedang diselenggara, sila cuba lagi nanti.",
            zh_hk: "遊戲正在維護中，請稍後再試。",
            id: "Permainan sedang dalam pemeliharaan. Silakan coba lagi nanti.",
          },
        });
      }

      return res.status(200).json({
        success: false,
        message: {
          en: "RED TIGER: Game launch failed. Please try again or customer service for assistance.",
          zh: "RED TIGER: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "RED TIGER: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "RED TIGER: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
          id: "RED TIGER: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const gameName = isDouble === true ? "RED TIGER 2X" : "RED TIGER";

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
    console.log("RED TIGER error in launching game", error.response.data);

    return res.status(200).json({
      success: false,
      message: {
        en: "RED TIGER: Game launch failed. Please try again or customer service for assistance.",
        zh: "RED TIGER: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "RED TIGER: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "RED TIGER: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
        id: "RED TIGER: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/netent/launchGame", authenticateToken, async (req, res) => {
  try {
    const { gameLang, clientPlatform, isDouble, gameCode } = req.body;
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

    if (user.gameLock.gsi.lock) {
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

    let clientIp = req.headers["x-forwarded-for"] || req.ip;
    clientIp = clientIp.split(",")[0].trim();

    let lang = "0";

    if (gameLang === "en") {
      lang = "0";
    } else if (gameLang === "zh") {
      lang = "2";
    } else if (gameLang === "zh_hk") {
      lang = "1";
    } else if (gameLang === "ms") {
      lang = "36";
    } else if (gameLang === "id") {
      lang = "4";
    }

    let platform = "WEB";
    if (clientPlatform === "web") {
      platform = "WEB";
    } else if (clientPlatform === "mobile") {
      platform = "MOBILE";
    }

    const requestTime = moment.utc().unix();
    const sign = generateSignature(requestTime, "launchgame");

    const randomPass = generateRandomPassword();

    let playerId;
    if (isDouble === true) {
      playerId = `${user.gameId}2x`;
    } else {
      playerId = `${user.gameId}`;
    }

    const fields = {
      operator_code: gsiOPCode,
      member_account: playerId,
      password: randomPass,
      nickname: user.username,
      currency: "HKD",
      game_code: gameCode,
      product_code: 1168,
      game_type: "SLOT",
      language_code: lang,
      ip: clientIp,
      platform,
      sign,
      request_time: requestTime,
      operator_lobby_url: webURL,
    };

    const response = await axios.post(
      `${gsiAPIURL}api/operators/launch-game`,
      fields,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.code !== 200) {
      console.log(`Netent error to launch game`, response.data);

      if (response.data.code === 2000) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Game under maintenance. Please try again later.",
            zh: "游戏正在维护中，请稍后再试。",
            ms: "Permainan sedang diselenggara, sila cuba lagi nanti.",
            zh_hk: "遊戲正在維護中，請稍後再試。",
            id: "Permainan sedang dalam pemeliharaan. Silakan coba lagi nanti.",
          },
        });
      }

      return res.status(200).json({
        success: false,
        message: {
          en: "NETENT: Game launch failed. Please try again or customer service for assistance.",
          zh: "NETENT: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "NETENT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "NETENT: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
          id: "NETENT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const gameName = isDouble === true ? "NETENT 2X" : "NETENT";

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
    console.log("NETENT error in launching game", error.response.data);

    return res.status(200).json({
      success: false,
      message: {
        en: "NETENT: Game launch failed. Please try again or customer service for assistance.",
        zh: "NETENT: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "NETENT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "NETENT: 遊戲啟動失敗，請重試或聯絡客服以獲得幫助。",
        id: "NETENT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/v1/api/seamless/balance", async (req, res) => {
  try {
    const { batch_requests, operator_code, currency, sign, request_time } =
      req.body;

    // Reusable error response generator
    const createErrorResponse = (code, message) =>
      batch_requests.map((req) => ({
        member_account: req.member_account || "",
        product_code: req.product_code || 0,
        balance: 0,
        code,
        message,
      }));

    // Early validation
    if (operator_code !== gsiOPCode) {
      return res
        .status(200)
        .json({ data: createErrorResponse(1002, "proxykeyerror") });
    }

    if (!["HKD", "HKD2", "IDR", "IDR2"].includes(currency)) {
      return res
        .status(200)
        .json({ data: createErrorResponse(1002, "Currency not supported") });
    }

    if (sign !== generateCallbackSignature(request_time, "getbalance")) {
      return res
        .status(200)
        .json({ data: createErrorResponse(1004, "Invalid signature") });
    }

    // Extract unique actual game IDs efficiently
    const actualGameIds = [
      ...new Set(
        batch_requests
          .filter((req) => req.member_account)
          .map((req) =>
            req.member_account.endsWith("2x")
              ? req.member_account.slice(0, -2)
              : req.member_account
          )
      ),
    ];

    if (actualGameIds.length === 0) {
      return res
        .status(200)
        .json({ data: createErrorResponse(1000, "Member does not exist") });
    }

    // Single database query
    const users = await User.find(
      { gameId: { $in: actualGameIds } },
      { gameId: 1, wallet: 1 }
    ).lean();

    // Create efficient lookup map
    const userMap = {};
    users.forEach((user) => {
      userMap[user.gameId] = user;
    });

    // Process requests
    const data = batch_requests.map((request) => {
      const { member_account, product_code } = request;

      if (!member_account) {
        return {
          member_account: "",
          product_code: product_code || 0,
          balance: 0,
          code: 1000,
          message: "Member does not exist",
        };
      }

      const isDoubleBetting = member_account.endsWith("2x");
      const actualGameId = isDoubleBetting
        ? member_account.slice(0, -2)
        : member_account;
      const user = userMap[actualGameId];

      if (!user) {
        return {
          member_account,
          product_code: product_code || 0,
          balance: 0,
          code: 1000,
          message: "Member does not exist",
        };
      }

      let actualBalance = isDoubleBetting
        ? (user.wallet || 0) * 0.5
        : user.wallet || 0;

      if (currency === "HKD2" || currency === "IDR2") {
        actualBalance = actualBalance / 1000;
      }

      return {
        member_account,
        product_code: product_code || 0,
        balance: roundToTwoDecimals(actualBalance),
        code: 0,
        message: "",
      };
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.log("GSI error in balance API:", error);
    const errorData = (req.body?.batch_requests || []).map((req) => ({
      member_account: req.member_account || "",
      product_code: req.product_code || 0,
      balance: 0,
      code: 999,
      message: "Internal server error",
    }));
    return res.status(200).json({ data: errorData });
  }
});

// 2. WITHDRAW ROUTE - Optimized but maintaining original final balance query approach
router.post("/api/v1/api/seamless/withdraw", async (req, res) => {
  try {
    const { batch_requests, operator_code, currency, sign, request_time } =
      req.body;

    // Validation
    if (operator_code !== gsiOPCode) {
      return res.status(200).json({
        data: batch_requests.map((req) => ({
          member_account: req.member_account,
          product_code: req.product_code,
          before_balance: 0,
          balance: 0,
          code: 1002,
          message: "proxykeyerror",
        })),
      });
    }

    const allowedCurrencies = ["HKD", "HKD2", "IDR", "IDR2"];
    if (!allowedCurrencies.includes(currency)) {
      return res.status(200).json({
        data: batch_requests.map((req) => ({
          member_account: req.member_account,
          product_code: req.product_code,
          before_balance: 0,
          balance: 0,
          code: 1002,
          message: "Currency not supported",
        })),
      });
    }

    if (sign !== generateCallbackSignature(request_time, "withdraw")) {
      return res.status(200).json({
        data: batch_requests.map((req) => ({
          member_account: req.member_account,
          product_code: req.product_code,
          before_balance: 0,
          balance: 0,
          code: 1004,
          message: "Invalid signature",
        })),
      });
    }

    // Extract all transaction IDs and actual game IDs efficiently
    const allTransactionIds = [];
    const actualGameIds = new Set();

    batch_requests.forEach((request) => {
      if (request.member_account) {
        const actualGameId = request.member_account.endsWith("2x")
          ? request.member_account.slice(0, -2)
          : request.member_account;
        actualGameIds.add(actualGameId);
      }

      if (request.transactions && Array.isArray(request.transactions)) {
        request.transactions.forEach((transaction) => {
          if (transaction.id) allTransactionIds.push(transaction.id);
        });
      }
    });

    // Parallel database queries for optimization
    const [existingTransactions, users] = await Promise.all([
      allTransactionIds.length > 0
        ? SlotLiveGSCModal.find(
            { tranId: { $in: allTransactionIds } },
            { tranId: 1, username: 1 }
          ).lean()
        : [],
      User.find(
        { gameId: { $in: Array.from(actualGameIds) } },
        { gameId: 1, wallet: 1, _id: 1, "gameLock.gsi.lock": 1 }
      ).lean(),
    ]);

    // Create efficient lookup structures
    const existingTransactionMap = {};
    existingTransactions.forEach((tx) => {
      existingTransactionMap[tx.tranId] = tx;
    });

    const userMap = {};
    users.forEach((user) => {
      userMap[user.gameId] = user;
    });

    const validDeductionActions = [
      "BET",
      "FREEBET",
      "SETTLED",
      "ROLLBACK",
      "CANCEL",
      "ADJUSTMENT",
      "JACKPOT",
      "BONUS",
      "TIP",
      "PROMO",
      "LEADERBOARD",
      "BET_PRESERVE",
      "PRESERVE_REFUND",
    ];

    // Process each request in batch
    const data = await Promise.all(
      batch_requests.map(async (request) => {
        const { member_account, product_code, game_type, transactions } =
          request;

        const isDoubleBetting = member_account.endsWith("2x");
        const actualGameId = isDoubleBetting
          ? member_account.slice(0, -2)
          : member_account;

        // Find user from map
        const user = userMap[actualGameId];
        if (!user) {
          return {
            member_account,
            product_code,
            before_balance: 0,
            balance: 0,
            code: 1000,
            message: "Member does not exist",
          };
        }

        // Check if user is blocked
        if (user.gameLock && user.gameLock.gsi && user.gameLock.gsi.lock) {
          const actualAmount = isDoubleBetting
            ? (user.wallet || 0) * 0.5
            : user.wallet || 0;
          return {
            member_account,
            product_code,
            before_balance: roundToTwoDecimals(actualAmount),
            balance: roundToTwoDecimals(actualAmount),
            code: 999,
            message: "Member is blocked",
          };
        }

        const beforeBalance = isDoubleBetting
          ? (user.wallet || 0) * 0.5
          : user.wallet || 0;

        let transactionSuccess = true;
        let errorMessage = "";
        let exCode = 0;

        // Group database operations
        const updateOperations = [];
        const createOperations = [];

        // Process transactions
        for (const transaction of transactions) {
          try {
            const { id, wager_code, amount, valid_bet_amount, action } =
              transaction;

            // Check for duplicate transaction
            if (existingTransactionMap[id]) {
              transactionSuccess = false;
              errorMessage = "DuplicateAPI transactions";
              exCode = 1003;
              break;
            }

            // Validate action type
            if (!validDeductionActions.includes(action)) {
              transactionSuccess = false;
              errorMessage = `Invalid action type for withdraw: ${action}`;
              exCode = 1002;
              break;
            }

            const actualDeductionAmount = isDoubleBetting
              ? roundToTwoDecimals(amount * 2)
              : roundToTwoDecimals(amount);

            // Prepare update operation
            updateOperations.push({
              updateOne: {
                filter: {
                  _id: user._id,
                  wallet: { $gte: Math.abs(actualDeductionAmount) },
                },
                update: { $inc: { wallet: actualDeductionAmount } },
              },
            });

            const actualValidBetAmount = isDoubleBetting
              ? roundToTwoDecimals((valid_bet_amount || 0) * 2)
              : roundToTwoDecimals(valid_bet_amount || 0);

            // Prepare create operation
            createOperations.push({
              tranId: id,
              betId: wager_code,
              username: member_account,
              platform: product_code,
              betamount: actualValidBetAmount,
              action: action,
              bet: true,
              gametype: game_type,
            });
          } catch (err) {
            console.error("GSI withdraw transaction error:", err);
            transactionSuccess = false;
            errorMessage = "Transaction processing error";
            exCode = 999;
            break;
          }
        }

        // Return early if transaction failed
        if (!transactionSuccess) {
          return {
            member_account,
            product_code,
            before_balance: roundToTwoDecimals(beforeBalance),
            balance: roundToTwoDecimals(beforeBalance),
            code: exCode,
            message: errorMessage,
          };
        }

        // Execute bulk update if there are operations
        if (updateOperations.length > 0) {
          const bulkUpdateResult = await User.bulkWrite(updateOperations);

          // Check for update failure
          if (
            !bulkUpdateResult ||
            bulkUpdateResult.modifiedCount !== updateOperations.length
          ) {
            return {
              member_account,
              product_code,
              before_balance: roundToTwoDecimals(beforeBalance),
              balance: roundToTwoDecimals(beforeBalance),
              code: 1001,
              message: "Insufficient balance",
            };
          }
        }

        // Execute bulk create if there are operations
        if (createOperations.length > 0) {
          await SlotLiveGSCModal.insertMany(createOperations);
        }

        // Get final balance - KEEPING ORIGINAL APPROACH
        const finalUser = await User.findOne(
          { gameId: actualGameId },
          { wallet: 1 }
        ).lean();

        const finalDisplayBalance = isDoubleBetting
          ? roundToTwoDecimals((finalUser?.wallet || 0) * 0.5)
          : roundToTwoDecimals(finalUser?.wallet || 0);

        return {
          member_account,
          product_code,
          before_balance: roundToTwoDecimals(beforeBalance),
          balance: finalDisplayBalance,
          code: 0,
          message: "",
        };
      })
    );

    return res.status(200).json({ data });
  } catch (error) {
    console.error("GSI withdraw error:", error);
    return res.status(200).json({
      data: (req.body?.batch_requests || []).map((req) => ({
        member_account: req.member_account || "",
        product_code: req.product_code || 0,
        before_balance: 0,
        balance: 0,
        code: 999,
        message: "Internal server error",
      })),
    });
  }
});

// 3. DEPOSIT ROUTE - Optimized but maintaining original final balance query approach
router.post("/api/v1/api/seamless/deposit", async (req, res) => {
  try {
    const { batch_requests, operator_code, currency, sign, request_time } =
      req.body;

    // Validate operator code
    if (operator_code !== gsiOPCode) {
      return res.status(200).json({
        data: batch_requests.map((req) => ({
          member_account: req.member_account,
          product_code: req.product_code,
          before_balance: 0,
          balance: 0,
          code: 1002,
          message: "proxykeyerror",
        })),
      });
    }

    // Validate signature
    if (sign !== generateCallbackSignature(request_time, "deposit")) {
      return res.status(200).json({
        data: batch_requests.map((req) => ({
          member_account: req.member_account,
          product_code: req.product_code,
          before_balance: 0,
          balance: 0,
          code: 1004,
          message: "Invalid signature",
        })),
      });
    }

    // Extract all data efficiently
    const allTransactionIds = [];
    const allWagerCodes = [];
    const actualGameIds = new Set();

    batch_requests.forEach((request) => {
      if (request.member_account) {
        const actualGameId = request.member_account.endsWith("2x")
          ? request.member_account.slice(0, -2)
          : request.member_account;
        actualGameIds.add(actualGameId);
      }

      if (request.transactions && Array.isArray(request.transactions)) {
        request.transactions.forEach((transaction) => {
          if (transaction.id) allTransactionIds.push(transaction.id);
          if (transaction.wager_code)
            allWagerCodes.push(transaction.wager_code);
        });
      }
    });

    // Check for existing transactions and bets in parallel
    const [existingTransactions, existingBets, settledBets, users] =
      await Promise.all([
        allTransactionIds.length > 0
          ? SlotLiveGSCModal.find(
              { tranId: { $in: allTransactionIds } },
              { tranId: 1, username: 1 }
            ).lean()
          : [],
        allWagerCodes.length > 0
          ? SlotLiveGSCModal.find(
              { betId: { $in: allWagerCodes } },
              { betId: 1, username: 1 }
            ).lean()
          : [],
        allWagerCodes.length > 0
          ? SlotLiveGSCModal.find(
              { betId: { $in: allWagerCodes }, settle: true },
              { betId: 1, username: 1 }
            ).lean()
          : [],
        User.find(
          { gameId: { $in: Array.from(actualGameIds) } },
          { gameId: 1, wallet: 1, _id: 1 }
        ).lean(),
      ]);

    // Create lookup maps
    const existingTransactionMap = {};
    existingTransactions.forEach((tx) => {
      existingTransactionMap[tx.tranId] = tx;
    });

    const existingBetMap = {};
    existingBets.forEach((bet) => {
      existingBetMap[bet.betId] = bet;
    });

    const settledBetMap = {};
    settledBets.forEach((bet) => {
      settledBetMap[bet.betId] = bet;
    });

    const userMap = {};
    users.forEach((user) => {
      userMap[user.gameId] = user;
    });

    // Process each request in batch
    const data = await Promise.all(
      batch_requests.map(async (request) => {
        const { member_account, product_code, game_type, transactions } =
          request;

        const isDoubleBetting = member_account.endsWith("2x");
        const actualGameId = isDoubleBetting
          ? member_account.slice(0, -2)
          : member_account;

        // Find user from our pre-loaded map
        const user = userMap[actualGameId];
        if (!user) {
          return {
            member_account,
            product_code,
            before_balance: 0,
            balance: 0,
            code: 1000,
            message: "Member does not exist",
          };
        }

        let beforeBalance = isDoubleBetting
          ? roundToTwoDecimals((user.wallet || 0) * 0.5)
          : roundToTwoDecimals(user.wallet || 0);
        let transactionSuccess = true;
        let errorMessage = "";
        let exCode = 0;

        // Group database operations
        const updateUserOperations = [];
        const updateBetOperations = [];

        // Process all transactions for this user
        for (const transaction of transactions) {
          try {
            const { id, wager_code, amount, action } = transaction;
            // Check if transaction already exists
            if (existingTransactionMap[id]) {
              transactionSuccess = false;
              errorMessage = "DuplicateAPI transactions";
              exCode = 1003;
              break;
            }

            // Check if bet exists
            if (action === "CANCEL") {
              if (!existingBetMap[wager_code]) {
                transactionSuccess = false;
                errorMessage = "bet does not exist";
                exCode = 1006;
                break;
              }
            }

            if (settledBetMap[wager_code]) {
              transactionSuccess = false;
              errorMessage = "DuplicateAPI transactions";
              exCode = 1003;
              break;
            }

            const actualCreditAmount = isDoubleBetting
              ? roundToTwoDecimals(amount * 2)
              : roundToTwoDecimals(amount);

            // Prepare user balance update
            updateUserOperations.push({
              updateOne: {
                filter: { _id: user._id },
                update: { $inc: { wallet: actualCreditAmount } },
              },
            });

            if (action === "CANCEL") {
              updateBetOperations.push({
                updateOne: {
                  filter: { betId: wager_code },
                  update: {
                    $set: {
                      settle: true,
                      settleamount: actualCreditAmount,
                      cancel: true,
                    },
                  },
                  upsert: true,
                },
              });
            }
            updateBetOperations.push({
              updateOne: {
                filter: { betId: wager_code },
                update: {
                  $set: {
                    settle: true,
                    settleamount: actualCreditAmount,
                  },
                },
                upsert: true,
              },
            });
          } catch (err) {
            console.error("GSI deposit transaction error:", err);
            transactionSuccess = false;
            errorMessage = "Transaction processing error";
            exCode = 999;
            break;
          }
        }

        // If any transaction failed, return error
        if (!transactionSuccess) {
          return {
            member_account,
            product_code,
            before_balance: roundToTwoDecimals(beforeBalance),
            balance: roundToTwoDecimals(beforeBalance),
            code: exCode,
            message: errorMessage,
          };
        }

        // Execute all operations in parallel
        if (updateUserOperations.length > 0 && updateBetOperations.length > 0) {
          await Promise.all([
            User.bulkWrite(updateUserOperations),
            SlotLiveGSCModal.bulkWrite(updateBetOperations),
          ]);
        }

        // Get final user balance - KEEPING ORIGINAL APPROACH
        const finalUser = await User.findOne(
          { gameId: actualGameId },
          { wallet: 1 }
        ).lean();

        const finalDisplayBalance = isDoubleBetting
          ? roundToTwoDecimals((finalUser?.wallet || 0) * 0.5)
          : roundToTwoDecimals(finalUser?.wallet || 0);

        return {
          member_account,
          product_code,
          before_balance: roundToTwoDecimals(beforeBalance),
          balance: finalDisplayBalance,
          code: 0,
          message: "",
        };
      })
    );

    return res.status(200).json({ data });
  } catch (error) {
    console.error("GSI deposit error:", error);
    return res.status(200).json({
      data: (req.body?.batch_requests || []).map((req) => ({
        member_account: req.member_account || "",
        product_code: req.product_code || 0,
        before_balance: 0,
        balance: 0,
        code: 999,
        message: "Internal server error",
      })),
    });
  }
});

// 4. PUSHBETDATA ROUTE - Optimized
router.post("/api/v1/api/seamless/pushbetdata", async (req, res) => {
  try {
    const { operator_code, currency, wagers, sign, request_time } = req.body;

    // Validate operator code
    if (operator_code !== gsiOPCode) {
      return res.status(200).json({
        code: 1002,
        message: "proxykeyerror",
      });
    }

    // Validate signature
    if (sign !== generateCallbackSignature(request_time, "pushbetdata")) {
      return res.status(200).json({
        code: 1004,
        message: "Invalid signature",
      });
    }

    // Extract unique actual game IDs efficiently
    const actualGameIds = [
      ...new Set(
        wagers
          .filter((tx) => tx.member_account)
          .map((tx) =>
            tx.member_account.endsWith("2x")
              ? tx.member_account.slice(0, -2)
              : tx.member_account
          )
      ),
    ];

    // Fetch all users in a single query
    const users = await User.find(
      { gameId: { $in: actualGameIds } },
      { gameId: 1 }
    ).lean();

    // Create a map for quick lookups
    const userMap = {};
    users.forEach((user) => {
      userMap[user.gameId] = true;
    });

    // Check if all users exist
    for (const transaction of wagers) {
      const { member_account } = transaction;

      const isDoubleBetting = member_account.endsWith("2x");
      const actualGameId = isDoubleBetting
        ? member_account.slice(0, -2)
        : member_account;

      if (!userMap[actualGameId]) {
        return res.status(200).json({
          code: 1000,
          message: "Member does not exist",
        });
      }
    }

    // Prepare bulk operations
    const bulkOperations = wagers.map((transaction) => {
      const { member_account, wager_code, valid_bet_amount, prize_amount } =
        transaction;

      const isDoubleBetting = member_account.endsWith("2x");

      const actualBetAmount = isDoubleBetting
        ? parseFloat(valid_bet_amount || 0) * 2
        : parseFloat(valid_bet_amount || 0);

      const actualPrizeAmount = isDoubleBetting
        ? parseFloat(prize_amount || 0) * 2
        : parseFloat(prize_amount || 0);

      return {
        updateOne: {
          filter: { username: member_account, betId: wager_code },
          update: {
            $set: {
              betamount: actualBetAmount,
              settleamount: actualPrizeAmount,
              settle: true,
            },
          },
          upsert: true,
        },
      };
    });

    // Execute all updates in a single operation
    if (bulkOperations.length > 0) {
      await SlotLiveGSCModal.bulkWrite(bulkOperations);
    }

    // All transactions processed successfully
    return res.status(200).json({
      code: 0,
      message: "",
    });
  } catch (error) {
    console.error("GSI pushbetdata error:", error);
    return res.status(200).json({
      code: 999,
      message: "Internal server error",
    });
  }
});

router.post("/api/redtiger/getturnoverforrebate", async (req, res) => {
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

    console.log("RED TIGER QUERYING TIME", startDate, endDate);

    const records = await SlotLiveGSCModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      username: { $not: /2x$/ },
      platform: "1169",
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

    let playerSummary = {};

    records.forEach((record) => {
      const gameId = record.username;
      const actualUsername = gameIdToUsername[gameId];

      if (!actualUsername) {
        console.warn(`RED TIGER User not found for gameId: ${gameId}`);
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
        gamename: "RED TIGER",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("RED TIGER: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "RED TIGER: Failed to fetch win/loss report",
        zh: "RED TIGER: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/redtiger2x/getturnoverforrebate", async (req, res) => {
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

    console.log("RED TIGER QUERYING TIME", startDate, endDate);

    const records = await SlotLiveGSCModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      username: /2x$/,
      platform: "1169",
      cancel: { $ne: true },
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
        console.warn(`RED TIGER2x User not found for gameId: ${gameId}`);
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
        gamename: "RED TIGER2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("RED TIGER: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "RED TIGER: Failed to fetch win/loss report",
        zh: "RED TIGER: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/redtiger/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotLiveGSCModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        platform: "1169",
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
          gamename: "RED TIGER",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("RED TIGER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/redtiger2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotLiveGSCModal.find({
        username: `${user.gameId}2x`,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        platform: "1169",
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
          gamename: "RED TIGER2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("RED TIGER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/redtiger/:userId/gamedata",
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

          if (slotGames["RED TIGER"]) {
            totalTurnover += slotGames["RED TIGER"].turnover || 0;
            totalWinLoss += slotGames["RED TIGER"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "RED TIGER",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("RED TIGER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/redtiger2x/:userId/gamedata",
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

          if (slotGames["RED TIGER2X"]) {
            totalTurnover += slotGames["RED TIGER2X"].turnover || 0;
            totalWinLoss += slotGames["RED TIGER2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "RED TIGER2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("RED TIGER: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/redtiger/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotLiveGSCModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        username: { $not: /2x$/ },
        platform: "1169",
        cancel: { $ne: true },
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
          gamename: "RED TIGER",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("RED TIGER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/redtiger2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotLiveGSCModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        username: /2x$/,
        platform: "1169",
        cancel: { $ne: true },
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
          gamename: "RED TIGER2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("RED TIGER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/redtiger/kioskreport",
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

          if (liveCasino["RED TIGER"]) {
            totalTurnover += Number(liveCasino["RED TIGER"].turnover || 0);
            totalWinLoss += Number(liveCasino["RED TIGER"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "RED TIGER",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("RED TIGER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/redtiger2x/kioskreport",
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

          if (liveCasino["RED TIGER2X"]) {
            totalTurnover += Number(liveCasino["RED TIGER2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["RED TIGER2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "RED TIGER2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("RED TIGER: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "RED TIGER: Failed to fetch win/loss report",
          zh: "RED TIGER: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.post("/api/netent/getturnoverforrebate", async (req, res) => {
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

    console.log("NETENT QUERYING TIME", startDate, endDate);

    const records = await SlotLiveGSCModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      username: { $not: /2x$/ },
      platform: "1168",
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

    let playerSummary = {};

    records.forEach((record) => {
      const gameId = record.username;
      const actualUsername = gameIdToUsername[gameId];

      if (!actualUsername) {
        console.warn(`NETENT User not found for gameId: ${gameId}`);
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
        gamename: "NETENT",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("NETENT: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "NETENT: Failed to fetch win/loss report",
        zh: "NETENT: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/netent2x/getturnoverforrebate", async (req, res) => {
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

    console.log("NETENT QUERYING TIME", startDate, endDate);

    const records = await SlotLiveGSCModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      username: /2x$/,
      platform: "1168",
      cancel: { $ne: true },
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
        console.warn(`NETENT2x User not found for gameId: ${gameId}`);
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
        gamename: "NETENT2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("NETENT: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "NETENT: Failed to fetch win/loss report",
        zh: "NETENT: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/netent/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotLiveGSCModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        platform: "1168",
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
          gamename: "NETENT",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("NETENT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/netent2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotLiveGSCModal.find({
        username: `${user.gameId}2x`,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        platform: "1168",
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
          gamename: "NETENT2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("NETENT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/netent/:userId/gamedata",
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

          if (slotGames["NETENT"]) {
            totalTurnover += slotGames["NETENT"].turnover || 0;
            totalWinLoss += slotGames["NETENT"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "NETENT",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("NETENT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/netent2x/:userId/gamedata",
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

          if (slotGames["NETENT2X"]) {
            totalTurnover += slotGames["NETENT2X"].turnover || 0;
            totalWinLoss += slotGames["NETENT2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "NETENT2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("NETENT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/netent/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotLiveGSCModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        username: { $not: /2x$/ },
        platform: "1168",
        cancel: { $ne: true },
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
          gamename: "NETENT",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("NETENT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/netent2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotLiveGSCModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        username: /2x$/,
        platform: "1168",
        cancel: { $ne: true },
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
          gamename: "NETENT2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("NETENT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/netent/kioskreport",
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

          if (liveCasino["NETENT"]) {
            totalTurnover += Number(liveCasino["NETENT"].turnover || 0);
            totalWinLoss += Number(liveCasino["NETENT"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "NETENT",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("NETENT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/netent2x/kioskreport",
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

          if (liveCasino["NETENT2X"]) {
            totalTurnover += Number(liveCasino["NETENT2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["NETENT2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "NETENT2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("NETENT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "NETENT: Failed to fetch win/loss report",
          zh: "NETENT: 获取盈亏报告失败",
        },
      });
    }
  }
);

module.exports = router;
