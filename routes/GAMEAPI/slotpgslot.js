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
const SlotPGSoftModal = require("../../models/slot_pgsoft.model");
const GameWalletLog = require("../../models/gamewalletlog.model");
const GamePGSlotGameModal = require("../../models/slot_pgslotDatabase.model");
require("dotenv").config();

//Staging

const pgSlotSecret = process.env.PGSLOT_SECRET;
const pgSlotSite = "EZWIN9HKD";
const pgSlotBusinessAcount = "NFI688SL2025";
const webURL = "https://www.ezwin9.com/";
const pgSlotAPIURL = "https://api2.xagent.live";
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

const generateRandomCode = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
};

function encryptRequestBody(jsonString, publicKey) {
  try {
    // Convert JSON string to buffer
    const data = Buffer.from(jsonString, "utf8");

    // Decode base64 public key
    const publicKeyBuffer = Buffer.from(publicKey, "base64");

    // Create public key object
    const publicKeyObj = crypto.createPublicKey({
      key: publicKeyBuffer,
      format: "der",
      type: "spki",
    });

    // RSA encryption block size (PKCS1 padding)
    const MAX_ENCRYPT_BLOCK = 117;
    const encryptedChunks = [];

    let offset = 0;
    const inputLen = data.length;

    // Encrypt data in chunks
    while (inputLen - offset > 0) {
      const chunkSize = Math.min(MAX_ENCRYPT_BLOCK, inputLen - offset);
      const chunk = data.slice(offset, offset + chunkSize);

      const encryptedChunk = crypto.publicEncrypt(
        {
          key: publicKeyObj,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        chunk
      );

      encryptedChunks.push(encryptedChunk);
      offset += chunkSize;
    }

    const encryptedData = Buffer.concat(encryptedChunks);

    const base64String = encryptedData.toString("base64");

    return {
      data: base64String,
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt request body");
  }
}

function decryptRequestBody(encryptedData, publicKeyBase64) {
  try {
    const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;

    const encryptedBuffer = Buffer.from(encryptedData, "base64");

    const chunkSize = 128;
    let decryptedResult = "";

    for (let i = 0; i < encryptedBuffer.length; i += chunkSize) {
      const chunk = encryptedBuffer.slice(i, i + chunkSize);

      try {
        const decrypted = crypto.publicDecrypt(
          {
            key: publicKeyPEM,
            padding: crypto.constants.RSA_PKCS1_PADDING,
          },
          chunk
        );
        decryptedResult += decrypted.toString("utf8");
      } catch (err) {
        console.error(`Decryption failed at chunk ${i}:`, err.message);
        throw new Error(
          `Failed to decrypt chunk at position ${i}: ${err.message}`
        );
      }
    }

    return decryptedResult;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error(`Failed to decrypt request body: ${error.message}`);
  }
}

function createErrorResponse(code, message, publicKey) {
  const errorResponse = { code, message, data: null };
  const signature = crypto
    .createHash("md5")
    .update(JSON.stringify(errorResponse) + publicKey)
    .digest("hex");

  return { response: errorResponse, signature };
}

router.post("/api/pgslot/getprovidergamelist", async (req, res) => {
  try {
    const requestBody = {
      gameType: "pg_electronic",
    };

    const jsonString = JSON.stringify(requestBody);

    // Encrypt the request body
    const encryptedBody = encryptRequestBody(jsonString, pgSlotSecret);
    console.log(`${pgSlotAPIURL}/v3/single/game/list-gamecode`);
    // Make the API request
    const response = await axios.post(
      `${pgSlotAPIURL}/v3/single/game/list-gamecode`,
      encryptedBody,
      {
        headers: {
          "Content-Type": "application/json",
          businessAccount: pgSlotBusinessAcount,
          site: pgSlotSite,
        },
      }
    );
    console.log(response.data);

    return res.status(200).json({
      success: true,
      gameLobby: response.data,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
      },
    });
  } catch (error) {
    console.log("KINGMAKER error in launching game", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "KINGMAKER: Game launch failed. Please try again or customer service for assistance.",
        zh: "KINGMAKER: 游戏启动失败，请重试或联系客服以获得帮助。",
      },
    });
  }
});

// async function updateGameTimestamps() {
//   try {
//     const mongoose = require("mongoose");
//     // Game IDs in order (65 = latest, 1918451 = oldest)
//     const gameIDs = [
//       "65",
//       "74",
//       "87",
//       "60",
//       "89",
//       "54",
//       "84",
//       "104",
//       "106",
//       "57",
//       "48",
//       "53",
//       "71",
//       "75",
//       "79",
//       "98",
//       "135",
//       "1312883",
//       "1372643",
//       "73",
//       "82",
//       "83",
//       "92",
//       "94",
//       "103",
//       "110",
//       "117",
//       "126",
//       "127",
//       "128",
//       "1",
//       "3",
//       "24",
//       "6",
//       "26",
//       "7",
//       "25",
//       "2",
//       "18",
//       "28",
//       "29",
//       "35",
//       "34",
//       "36",
//       "33",
//       "37",
//       "31",
//       "38",
//       "39",
//       "41",
//       "44",
//       "42",
//       "40",
//       "50",
//       "61",
//       "59",
//       "64",
//       "63",
//       "68",
//       "20",
//       "62",
//       "67",
//       "70",
//       "69",
//       "85",
//       "80",
//       "90",
//       "58",
//       "88",
//       "97",
//       "86",
//       "91",
//       "93",
//       "95",
//       "100",
//       "105",
//       "101",
//       "102",
//       "113",
//       "115",
//       "108",
//       "107",
//       "119",
//       "114",
//       "118",
//       "112",
//       "122",
//       "121",
//       "125",
//       "123",
//       "120",
//       "124",
//       "129",
//       "130",
//       "132",
//       "1338274",
//       "1368367",
//       "1340277",
//       "1402846",
//       "1543462",
//       "1420892",
//       "1381200",
//       "1418544",
//       "1448762",
//       "1432733",
//       "1513328",
//       "1601012",
//       "1397455",
//       "1473388",
//       "1594259",
//       "1572362",
//       "1529867",
//       "1489936",
//       "1568554",
//       "1555350",
//       "1580541",
//       "1655268",
//       "1615454",
//       "1451122",
//       "1695365",
//       "1671262",
//       "1682240",
//       "1508783",
//       "1492288",
//       "1717688",
//       "1623475",
//       "1635221",
//       "1738001",
//       "1778752",
//       "1648578",
//       "1760238",
//       "1747549",
//       "1727711",
//       "1815268",
//       "1755623",
//       "1786529",
//       "1666445",
//       "1702123",
//       "1879752",
//       "1850016",
//       "1799745",
//       "1804577",
//       "1827457",
//       "1881268",
//       "1865521",
//       "1834850",
//       "1935269",
//       "1897678",
//       "1918451",
//     ];

//     // Ensure mongoose is connected
//     if (mongoose.connection.readyState !== 1) {
//       console.log("Waiting for database connection...");
//       await new Promise((resolve, reject) => {
//         if (mongoose.connection.readyState === 1) {
//           resolve();
//         } else {
//           mongoose.connection.once("connected", resolve);
//           mongoose.connection.once("error", reject);
//           // Set a timeout in case connection never happens
//           setTimeout(
//             () => reject(new Error("Database connection timeout")),
//             10000
//           );
//         }
//       });
//     }

//     // Start with current time for the latest game
//     const now = moment().utc();

//     console.log(`Starting timestamp update for ${gameIDs.length} games...`);
//     console.log(
//       `Latest game (ID: ${
//         gameIDs[0]
//       }) will have timestamp: ${now.toISOString()}`
//     );
//     console.log(
//       `Oldest game (ID: ${
//         gameIDs[gameIDs.length - 1]
//       }) will have timestamp: ${now
//         .clone()
//         .subtract((gameIDs.length - 1) * 30, "minutes")
//         .toISOString()}`
//     );

//     // Use direct collection access to bypass mongoose timestamps
//     const collection = GamePGSlotGameModal.collection;

//     // Prepare bulk operations
//     const bulkOps = gameIDs.map((gameID, index) => {
//       const gameTimestamp = now
//         .clone()
//         .subtract(index * 30, "minutes")
//         .toDate();

//       return {
//         updateMany: {
//           filter: { gameID: gameID },
//           update: {
//             $set: {
//               createdAt: gameTimestamp,
//             },
//           },
//         },
//       };
//     });

//     // Execute bulk operation using the native MongoDB collection
//     const result = await collection.bulkWrite(bulkOps, {
//       ordered: false,
//     });

//     console.log(`\n=== UPDATE SUMMARY ===`);
//     console.log(`Total Operations: ${gameIDs.length}`);
//     console.log(`Matched Documents: ${result.matchedCount}`);
//     console.log(`Modified Documents: ${result.modifiedCount}`);

//     // Verify a few updates using Mongoose
//     const firstGame = await GamePGSlotGameModal.findOne({ gameID: gameIDs[0] });
//     const lastGame = await GamePGSlotGameModal.findOne({
//       gameID: gameIDs[gameIDs.length - 1],
//     });

//     if (firstGame) {
//       console.log(
//         `\nVerification - First game (${gameIDs[0]}): ${moment(
//           firstGame.createdAt
//         ).format("YYYY-MM-DD HH:mm:ss")} UTC`
//       );
//     }
//     if (lastGame) {
//       console.log(
//         `Verification - Last game (${gameIDs[gameIDs.length - 1]}): ${moment(
//           lastGame.createdAt
//         ).format("YYYY-MM-DD HH:mm:ss")} UTC`
//       );
//     }

//     return {
//       success: true,
//       totalGames: gameIDs.length,
//       matchedCount: result.matchedCount,
//       modifiedCount: result.modifiedCount,
//       timestampRange: {
//         latest: now.toISOString(),
//         oldest: now
//           .clone()
//           .subtract((gameIDs.length - 1) * 30, "minutes")
//           .toISOString(),
//       },
//     };
//   } catch (error) {
//     console.error("Error updating game timestamps:", error);
//     throw error;
//   }
// }
// updateGameTimestamps();
router.post("/api/pgslot/getgamelist", async (req, res) => {
  try {
    const games = await GamePGSlotGameModal.find({
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
      Hot: game.hot || false,
      RTP: game.rtpRate,
    }));

    return res.status(200).json({
      success: true,
      gamelist: reformattedGamelist,
    });
  } catch (error) {
    console.log("PG SLOT error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "PG SLOT: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "PG SLOT: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "PG SLOT: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "PG SLOT: 攞唔到遊戲清單，老闆麻煩聯絡客服幫手處理。",
        id: "PG SLOT: Tidak dapat mengambil daftar permainan. Silakan hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/pgslot/compare-gameids", async (req, res) => {
  try {
    // Your provided game IDs
    const providedGameIds = [
      "115",
      "128",
      "127",
      "126",
      "125",
      "124",
      "123",
      "122",
      "121",
      "120",
      "119",
      "118",
      "117",
      "129",
      "114",
      "113",
      "112",
      "110",
      "108",
      "107",
      "106",
      "105",
      "104",
      "103",
      "102",
      "1418544",
      "1555350",
      "1543462",
      "1529867",
      "1513328",
      "1508783",
      "1492288",
      "1489936",
      "1473388",
      "1451122",
      "1448762",
      "1432733",
      "1420892",
      "101",
      "1402846",
      "1397455",
      "1381200",
      "1372643",
      "1368367",
      "1340277",
      "1338274",
      "1312883",
      "135",
      "132",
      "130",
      "40",
      "62",
      "61",
      "60",
      "59",
      "58",
      "57",
      "54",
      "53",
      "50",
      "48",
      "44",
      "42",
      "65",
      "39",
      "38",
      "37",
      "36",
      "35",
      "34",
      "33",
      "29",
      "25",
      "20",
      "7",
      "84",
      "100",
      "98",
      "97",
      "95",
      "94",
      "93",
      "92",
      "91",
      "89",
      "88",
      "87",
      "86",
      "3",
      "83",
      "82",
      "80",
      "79",
      "75",
      "74",
      "71",
      "70",
      "69",
      "68",
      "67",
    ];

    // Remove duplicates from provided list
    const uniqueProvidedIds = [...new Set(providedGameIds)];

    // Fetch all game IDs from database
    const gamesInDb = await GamePGSlotGameModal.find(
      {},
      { gameID: 1, _id: 0 }
    ).lean();
    const dbGameIds = gamesInDb.map((game) => game.gameID);

    // Convert to Sets for comparison
    const providedSet = new Set(uniqueProvidedIds);
    const dbSet = new Set(dbGameIds);

    // Find missing from database (in provided list but not in DB)
    const missingFromDb = uniqueProvidedIds.filter((id) => !dbSet.has(id));

    // Find extra in database (in DB but not in provided list)
    const extraInDb = dbGameIds.filter((id) => !providedSet.has(id));

    // Find duplicates in provided list
    const duplicates = providedGameIds.filter(
      (id, index) => providedGameIds.indexOf(id) !== index
    );
    const uniqueDuplicates = [...new Set(duplicates)];

    // Update maintenance status for extra games
    let updateResult = null;
    if (extraInDb.length > 0) {
      updateResult = await GamePGSlotGameModal.updateMany(
        { gameID: { $in: extraInDb } },
        { $set: { maintenance: true } }
      );

      console.log(
        `\n✅ Updated ${updateResult.modifiedCount} games to maintenance mode`
      );
    }

    // Console log results
    console.log("\n========== GAME ID COMPARISON ==========");
    console.log(`\nProvided Game IDs: ${providedGameIds.length}`);
    console.log(`Unique Provided Game IDs: ${uniqueProvidedIds.length}`);
    console.log(`Database Game IDs: ${dbGameIds.length}`);

    console.log("\n--- DUPLICATES IN PROVIDED LIST ---");
    if (uniqueDuplicates.length > 0) {
      console.log(`Found ${uniqueDuplicates.length} duplicate IDs:`);
      uniqueDuplicates.forEach((id) => {
        const count = providedGameIds.filter((pid) => pid === id).length;
        console.log(`  - ${id} (appears ${count} times)`);
      });
    } else {
      console.log("No duplicates found.");
    }

    console.log("\n--- MISSING FROM DATABASE ---");
    if (missingFromDb.length > 0) {
      console.log(
        `Found ${missingFromDb.length} game IDs missing from database:`
      );
      missingFromDb.forEach((id) => console.log(`  - ${id}`));
    } else {
      console.log("All provided game IDs exist in database.");
    }

    console.log("\n--- EXTRA IN DATABASE (SET TO MAINTENANCE) ---");
    if (extraInDb.length > 0) {
      console.log(
        `Found ${extraInDb.length} game IDs in database but not in provided list:`
      );
      extraInDb.forEach((id) => console.log(`  - ${id}`));
    } else {
      console.log("No extra game IDs in database.");
    }

    console.log("\n========================================\n");

    // Return response
    return res.status(200).json({
      success: true,
      summary: {
        providedCount: providedGameIds.length,
        uniqueProvidedCount: uniqueProvidedIds.length,
        databaseCount: dbGameIds.length,
        duplicatesCount: uniqueDuplicates.length,
        missingFromDbCount: missingFromDb.length,
        extraInDbCount: extraInDb.length,
        gamesSetToMaintenance: updateResult ? updateResult.modifiedCount : 0,
      },
      duplicates: uniqueDuplicates,
      missingFromDb: missingFromDb,
      extraInDb: extraInDb,
      message: {
        en: `Game ID comparison completed. ${extraInDb.length} games set to maintenance mode.`,
        zh: `游戏ID比较完成。${extraInDb.length}个游戏已设置为维护模式。`,
        ms: `Perbandingan ID permainan selesai. ${extraInDb.length} permainan ditetapkan ke mod penyelenggaraan.`,
        zh_hk: `遊戲ID比較完成。${extraInDb.length}個遊戲已設置為維護模式。`,
        id: `Perbandingan ID permainan selesai. ${extraInDb.length} permainan diatur ke mode pemeliharaan.`,
      },
    });
  } catch (error) {
    console.error("Error comparing game IDs:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Internal server error during game ID comparison.",
        zh: "游戏ID比较时发生内部服务器错误。",
        ms: "Ralat dalaman pelayan semasa perbandingan ID permainan.",
        zh_hk: "遊戲ID比較時發生內部伺服器錯誤。",
        id: "Kesalahan server internal saat membandingkan ID permainan.",
      },
    });
  }
});

router.post("/api/pgslot/launchGame", authenticateToken, async (req, res) => {
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

    if (user.gameLock.pgslot.lock) {
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

    const { gameCode, gameLang, isDouble, clientPlatform } = req.body;
    let lang = "zh_hant";

    if (gameLang === "en") {
      lang = "en";
    } else if (gameLang === "zh") {
      lang = "zh";
    } else if (gameLang === "zh_hk") {
      lang = "zh_hant";
    } else if (gameLang === "ms") {
      lang = "en";
    } else if (gameLang === "id") {
      lang = "id";
    }

    let platform = true;
    if (clientPlatform === "web") {
      platform = false;
    } else if (clientPlatform === "mobile") {
      platform = true;
    }

    let playerId;
    if (isDouble === true) {
      playerId = `${user.gameId.toLowerCase()}2x`;
    } else {
      playerId = `${user.gameId.toLowerCase()}`;
    }
    let password;
    if (isDouble === true) {
      password = `${user.gameId}2x00`;
    } else {
      password = `${user.gameId}00`;
    }

    const requestBody = {
      account: playerId,
      password: password,
      gameType: "pg_electronic",
      isMobile: platform,
      gameCode: gameCode,
      lang,
      coin: "hkd",
    };
    const jsonString = JSON.stringify(requestBody);

    const encryptedBody = encryptRequestBody(jsonString, pgSlotSecret);
    const response = await axios.post(
      `${pgSlotAPIURL}/v3/single/user/login`,
      encryptedBody,
      {
        headers: {
          "Content-Type": "application/json",
          businessAccount: pgSlotBusinessAcount,
          site: pgSlotSite,
        },
      }
    );
    if (response.data.code !== 200) {
      if (response.data.code === 3000 || response.data.code === 5000) {
        console.log("PG SLOT maintenance");
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

      console.log("PG SLOT error in launching game", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "PG SLOT: Game launch failed. Please try again or customer service for assistance.",
          zh: "PG SLOT: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "PG SLOT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "PG SLOT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "PG SLOT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const gameName = isDouble === true ? "PG SLOT 2X" : "PG SLOT";

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      gameName
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.data.url,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("PG SLOT error in launching game", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "PG SLOT: Game launch failed. Please try again or customer service for assistance.",
        zh: "PG SLOT: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "PG SLOT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "PG SLOT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "PG SLOT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/pgslot2.0/getaccountinfo", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const decryptedData = decryptRequestBody(data, pgSlotSecret);
    const requestParams = JSON.parse(decryptedData);
    const { account, coin } = requestParams;

    if (!account) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const currentUser = await User.findOne(
      { gameId: actualGameId },
      { wallet: 1, username: 1, _id: 0 }
    ).lean();

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const actualAmount = isDoubleBetting
      ? currentUser.wallet * 0.5
      : currentUser.wallet;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        account,
        accountName: currentUser.username,
        coin,
        balance: roundToTwoDecimals(actualAmount),
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");

    res.setHeader("signature", signature);
    return res.status(200).json(completeResponse);
  } catch (error) {
    console.error(
      "PG SLOt: Error in game provider calling ae96 get balance api:",
      error.message
    );
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    res.setHeader("signature", signature);
    return res.status(200).json(response);
  }
});

function generateTransactionId(length = 8, prefix = "") {
  // Ensure length doesn't exceed 10 characters
  const maxLength = 10;
  const actualLength = Math.min(length, maxLength);

  // Characters to use in the transaction ID (alphanumeric)
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  // Generate random characters
  for (let i = 0; i < actualLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  // If a prefix is provided, make sure the total length doesn't exceed 10
  let finalId = prefix + result;
  if (finalId.length > maxLength) {
    // Truncate the random part to ensure total length is 10
    finalId = prefix + result.substring(0, maxLength - prefix.length);
  }

  return finalId;
}

router.post("/api/pgslot2.0/applycreatebet", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const decryptedData = decryptRequestBody(data, pgSlotSecret);
    const requestParams = JSON.parse(decryptedData);
    const { account, coin, bets, gameType } = requestParams;
    if (!account || !bets || !Array.isArray(bets) || bets.length === 0) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      return res.status(200).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const betIds = bets.map((bet) => bet.betNoVenue).filter(Boolean);

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, "gameLock.pgslot.lock": 1 }
      ).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betIds } },
        { betId: 1, ourbetId: 1, cancel: 1, settle: 1 }
      ).lean(),
    ]);

    if (!currentUser || currentUser.gameLock?.pgslot?.lock) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const existingBetIds = new Set(existingTransactions.map((t) => t.betId));
    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.betId, t])
    );

    const results = bets.map((bet) => {
      const { betNoVenue, betAmount } = bet;
      const ourTransactionID = generateTransactionId();
      const existingTransaction = existingBetMap.get(betNoVenue);

      if (existingBetIds.has(betNoVenue)) {
        if (existingTransaction.cancel === true) {
          return {
            betType: 1,
            betNoVenue,
            betNoMerchant: existingTransaction.ourbetId,
            account,
            coin,
            betState: 4, // Cancelled bet state
            settlementState: 1,
            operateState: 23, // Cancelled operation state
            resultDesc: "注单已取消",
            amount: 0,
            needsTransaction: false,
          };
        } else {
          return {
            betType: 1,
            betNoVenue,
            betNoMerchant: existingTransaction.ourbetId,
            account,
            coin,
            betState: 1,
            settlementState: 1,
            operateState: 21,
            resultDesc: "注单已存在",
            amount: 0,
            needsTransaction: false,
          };
        }
      }

      return {
        betType: 1,
        betNoVenue,
        betNoMerchant: ourTransactionID,
        account,
        coin,
        betState: 1,
        settlementState: 1,
        operateState: 1,
        resultDesc: "成功",
        amount: betAmount,
        needsTransaction: true,
      };
    });

    const newBets = results.filter((bet) => bet.needsTransaction);
    const totalBetAmount = newBets.reduce(
      (sum, bet) => sum + (bet.amount || 0),
      0
    );
    const multiplier = isDoubleBetting ? 2 : 1;
    const balancemultiplier = isDoubleBetting ? 0.5 : 1;
    const actualDeduction = totalBetAmount * multiplier;

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: actualGameId,
        wallet: { $gte: roundToTwoDecimals(actualDeduction) },
      },
      { $inc: { wallet: -roundToTwoDecimals(actualDeduction) } },
      { new: true, projection: { wallet: 1 } }
    );

    if (!updatedUserBalance) {
      results.forEach((result) => {
        if (result.needsTransaction) {
          result.betState = 0;
          result.operateState = 3;
          result.resultDesc = "余额不足";
        }
      });

      const cleanResults = results.map(
        ({ amount, needsTransaction, ...bet }) => bet
      );

      const completeResponse = {
        code: 200,
        message: "success",
        data: {
          gameType,
          account,
          coin,
          balance: roundToTwoDecimals(currentUser.wallet * balancemultiplier),
          results: cleanResults,
        },
      };

      const signature = crypto
        .createHash("md5")
        .update(JSON.stringify(completeResponse) + pgSlotSecret)
        .digest("hex");
      res.setHeader("signature", signature);
      return res.status(200).json(completeResponse);
    }

    if (newBets.length > 0) {
      await Promise.all(
        newBets.map((bet) =>
          SlotPGSoftModal.create({
            betId: bet.betNoVenue,
            ourbetId: bet.betNoMerchant,
            username: account.toUpperCase(),
            betamount: bet.amount * multiplier,
            bet: true,
            betState: 1,
            settlementState: 1,
          })
        )
      );
    }

    const cleanResults = results.map(
      ({ amount, needsTransaction, ...bet }) => bet
    );

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * balancemultiplier
        ),
        results: cleanResults,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    res.setHeader("signature", signature);
    return res.status(200).json(completeResponse);
  } catch (error) {
    console.error(
      "PG SLOt: Error in game provider calling bet api:",
      error.message
    );
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    res.setHeader("signature", signature);
    return res.status(200).json(response);
  }
});

router.post("/api/pgslot2.0/getbet", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const decryptedData = decryptRequestBody(data, pgSlotSecret);
    const requestParams = JSON.parse(decryptedData);
    const { gameType, betNoVenues } = requestParams;

    if (
      !gameType ||
      !betNoVenues ||
      !Array.isArray(betNoVenues) ||
      betNoVenues.length === 0
    ) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      return res.status(200).json(response);
    }

    const betRecords = await SlotPGSoftModal.find(
      { betId: { $in: betNoVenues } },
      {
        betId: 1,
        _id: 0,
      }
    ).lean();

    const betMap = {};

    betNoVenues.forEach((betId) => {
      betMap[betId] = null;
    });

    betRecords.forEach((record) => {
      betMap[record.betId] = {
        betNoVenue: record.betId,
      };
    });

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        betMap,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");

    res.setHeader("signature", signature);
    return res.status(200).json(completeResponse);
  } catch (error) {
    console.error(
      "PG SLOt: Error in game provider calling getbet api:",
      error.message
    );
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    res.setHeader("signature", signature);
    return res.status(200).json(response);
  }
});

router.post("/api/pgslot2.0/updatebet", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const decryptedData = decryptRequestBody(data, pgSlotSecret);
    const requestParams = JSON.parse(decryptedData);
    const { account, coin, bets, gameType } = requestParams;

    if (!account || !bets || !Array.isArray(bets) || bets.length === 0) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      return res.status(200).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const betIds = bets.map((bet) => bet.betNoVenue).filter(Boolean);

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, "gameLock.pgslot.lock": 1 }
      ).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betIds } },
        { betId: 1, ourbetId: 1, betamount: 1 }
      ).lean(),
    ]);

    if (!currentUser || currentUser.gameLock?.pgslot?.lock) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.betId, t])
    );

    const multiplier = isDoubleBetting ? 2 : 1;
    const balancemultiplier = isDoubleBetting ? 0.5 : 1;

    const betProcessPromises = bets.map(async (bet) => {
      const { betNoVenue, betAmount } = bet;

      const existingTransaction = existingBetMap.get(betNoVenue);

      if (!existingTransaction) {
        return {
          betType: 1,
          betNoVenue,
          betNoMerchant: null,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 20,
          resultDesc: "注单不存在",
          balanceChange: 0,
        };
      }

      const actualDeduction = (betAmount || 0) * multiplier;

      const difference = actualDeduction - (existingTransaction.betamount || 0);

      return {
        betType: 1,
        betNoVenue,
        betNoMerchant: existingTransaction.ourbetId,
        account,
        coin,
        betState: 1,
        settlementState: 1,
        operateState: 1,
        resultDesc: "成功",
        balanceChange: difference,
        newBetAmount: actualDeduction,
        existingBetAmount: existingTransaction.betamount || 0,
      };
    });

    const processedBets = await Promise.all(betProcessPromises);

    const totalBalanceChange = processedBets.reduce(
      (sum, bet) => sum + (bet.balanceChange || 0),
      0
    );

    let updatedUserBalance;

    if (totalBalanceChange > 0) {
      // Need to deduct more funds - validate sufficient balance
      updatedUserBalance = await User.findOneAndUpdate(
        {
          gameId: actualGameId,
          wallet: { $gte: roundToTwoDecimals(totalBalanceChange) },
        },
        { $inc: { wallet: -roundToTwoDecimals(totalBalanceChange) } },
        { new: true, projection: { wallet: 1 } }
      );

      if (!updatedUserBalance) {
        // Mark all bets as insufficient balance
        const failedResults = processedBets.map(
          ({ balanceChange, newBetAmount, existingBetAmount, ...bet }) => ({
            ...bet,
            betState: 0,
            operateState: 3,
            resultDesc: "余额不足",
          })
        );

        const completeResponse = {
          code: 200,
          message: "success",
          data: {
            gameType,
            account,
            coin,
            balance: roundToTwoDecimals(currentUser.wallet * balancemultiplier), // Return original balance
            results: failedResults,
          },
        };

        const signature = crypto
          .createHash("md5")
          .update(JSON.stringify(completeResponse) + pgSlotSecret)
          .digest("hex");
        res.setHeader("signature", signature);
        return res.status(200).json(completeResponse);
      }
    } else if (totalBalanceChange < 0) {
      updatedUserBalance = await User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: -roundToTwoDecimals(totalBalanceChange) } }, // Negative change = positive addition
        { new: true, projection: { wallet: 1 } }
      );
    } else {
      updatedUserBalance = { wallet: currentUser.wallet };
    }

    const updatePromises = processedBets
      .filter((bet) => bet.balanceChange !== undefined && bet.betState === 1)
      .map((bet) =>
        SlotPGSoftModal.updateOne(
          { betId: bet.betNoVenue },
          {
            $set: {
              betamount: bet.newBetAmount,
            },
          }
        )
      );

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    const results = processedBets.map(
      ({ balanceChange, newBetAmount, existingBetAmount, ...bet }) => bet
    );

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * balancemultiplier
        ),
        results,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    res.setHeader("signature", signature);
    return res.status(200).json(completeResponse);
  } catch (error) {
    console.error(
      "PG SLOt: Error in game provider calling updatebet api:",
      error.message
    );
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    res.setHeader("signature", signature);
    return res.status(200).json(response);
  }
});

router.post("/api/pgslot2.0/cannelbet", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const decryptedData = decryptRequestBody(data, pgSlotSecret);
    const requestParams = JSON.parse(decryptedData);
    const { account, coin, betNoVenues, gameType } = requestParams;

    if (
      !account ||
      !betNoVenues ||
      !Array.isArray(betNoVenues) ||
      betNoVenues.length === 0
    ) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      return res.status(200).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { username: 1, wallet: 1 }).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betNoVenues } },
        { betId: 1, ourbetId: 1, betamount: 1, cancel: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const existingBetIds = new Set(existingTransactions.map((t) => t.betId));
    const missingBetIds = betNoVenues.filter(
      (betId) => !existingBetIds.has(betId)
    );
    const cancellableBets = existingTransactions.filter((t) => !t.cancel);

    const results = betNoVenues.map((betId) => {
      const existingTransaction = existingTransactions.find(
        (t) => t.betId === betId
      );

      if (existingTransaction) {
        if (existingTransaction.cancel) {
          return {
            betType: 1,
            betNoVenue: betId,
            betNoMerchant: existingTransaction.ourbetId,
            account,
            coin,
            betState: 4,
            settlementState: 1,
            operateState: 23,
            resultDesc: "注单已取消",
          };
        } else {
          return {
            betType: 1,
            betNoVenue: betId,
            betNoMerchant: existingTransaction.ourbetId,
            account,
            coin,
            betState: 4,
            settlementState: 1,
            operateState: 1,
            resultDesc: "取消成功",
          };
        }
      } else {
        const newTransactionId = generateTransactionId();
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: newTransactionId,
          account,
          coin,
          betState: 1,
          settlementState: 1,
          operateState: 1,
          resultDesc: "取消成功",
        };
      }
    });

    const totalRefundAmount =
      cancellableBets.reduce((sum, transaction) => {
        return sum + transaction.betamount;
      }, 0) || 0;

    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(totalRefundAmount) } },
        { new: true, projection: { wallet: 1 } }
      ),

      cancellableBets.length > 0
        ? SlotPGSoftModal.updateMany(
            { betId: { $in: cancellableBets.map((t) => t.betId) } },
            {
              $set: {
                cancel: true,
              },
            }
          )
        : Promise.resolve(),

      // Create new cancelled records for missing bets
      missingBetIds.length > 0
        ? SlotPGSoftModal.insertMany(
            missingBetIds.map((betId) => {
              const result = results.find((r) => r.betNoVenue === betId);
              return {
                betId: betId,
                ourbetId: result.betNoMerchant,
                username: account.toUpperCase(),
                cancel: true,
              };
            })
          )
        : Promise.resolve(),
    ]);

    const balancemultiplier = isDoubleBetting ? 0.5 : 1;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * balancemultiplier
        ),
        results,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    res.setHeader("signature", signature);
    return res.status(200).json(completeResponse);
  } catch (error) {
    console.error(
      "PG SLOt: Error in game provider calling cancelbet api:",
      error.message
    );
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    res.setHeader("signature", signature);
    return res.status(200).json(response);
  }
});

router.post("/api/pgslot2.0/backcancelbet", async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const decryptedData = decryptRequestBody(data, pgSlotSecret);
    const requestParams = JSON.parse(decryptedData);
    const { account, coin, betNoVenues, gameType } = requestParams;

    if (
      !account ||
      !betNoVenues ||
      !Array.isArray(betNoVenues) ||
      betNoVenues.length === 0
    ) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      return res.status(200).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne({ gameId: actualGameId }, { username: 1, wallet: 1 }).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betNoVenues } },
        { betId: 1, ourbetId: 1, betamount: 1, cancel: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      res.setHeader("signature", signature);
      console.log(response);
      return res.status(200).json(response);
    }

    const restorableBets = existingTransactions.filter((t) => t.cancel);
    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.betId, t])
    );

    const totalDeductAmount =
      restorableBets.reduce((sum, transaction) => {
        return sum + transaction.betamount;
      }, 0) || 0;

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: actualGameId,
        wallet: { $gte: roundToTwoDecimals(totalDeductAmount) },
      },
      { $inc: { wallet: -roundToTwoDecimals(totalDeductAmount) } },
      { new: true, projection: { wallet: 1, _id: 1 } }
    );

    if (!updatedUserBalance) {
      // All bets fail due to insufficient balance
      const results = betNoVenues.map((betId) => {
        const existingTransaction = existingBetMap.get(betId);

        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: existingTransaction
            ? existingTransaction.ourbetId
            : null,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 3,
          resultDesc: "余额不足",
        };
      });

      const balancemultiplier = isDoubleBetting ? 0.5 : 1;

      const completeResponse = {
        code: 200,
        message: "success",
        data: {
          gameType,
          account,
          coin,
          balance: roundToTwoDecimals(currentUser.wallet * balancemultiplier),
          results,
        },
      };

      const signature = crypto
        .createHash("md5")
        .update(JSON.stringify(completeResponse) + pgSlotSecret)
        .digest("hex");
      res.setHeader("signature", signature);
      return res.status(200).json(completeResponse);
    }

    const results = betNoVenues.map((betId) => {
      const existingTransaction = existingBetMap.get(betId);

      if (!existingTransaction) {
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: null,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 20,
          resultDesc: "注单不存在",
        };
      }

      if (!existingTransaction.cancel) {
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          betState: 1,
          settlementState: 1,
          operateState: 24,
          resultDesc: "注单未取消",
        };
      }

      return {
        betType: 1,
        betNoVenue: betId,
        betNoMerchant: existingTransaction.ourbetId,
        account,
        coin,
        betState: 1,
        settlementState: 1,
        operateState: 1,
        resultDesc: "恢复成功",
      };
    });

    await SlotPGSoftModal.updateMany(
      { betId: { $in: restorableBets.map((t) => t.betId) } },
      { $set: { cancel: false } }
    );

    const balancemultiplier = isDoubleBetting ? 0.5 : 1;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance
            ? updatedUserBalance.wallet * balancemultiplier
            : currentUser.wallet * balancemultiplier
        ),
        results,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    res.setHeader("signature", signature);
    return res.status(200).json(completeResponse);
  } catch (error) {
    console.error(
      "PG SLOt: Error in game provider calling cancelbet api:",
      error.message
    );
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    res.setHeader("signature", signature);
    return res.status(200).json(response);
  }
});

router.post("/api/pgslot2.0/settlementbet", async (req, res) => {
  const { data } = req.body;

  if (!data) {
    const { response, signature } = createErrorResponse(
      400,
      "参数错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }

  try {
    const requestParams = JSON.parse(decryptRequestBody(data, pgSlotSecret));
    const { account, coin, bets, gameType } = requestParams;
    if (!account || !Array.isArray(bets) || !bets.length) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();
    const betIds = bets.map((bet) => bet.betNoVenue).filter(Boolean);

    const hasNewBetting = bets.some(
      (bet) => bet.isCreateAndSettlement === true
    );

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, "gameLock.pgslot.lock": 1, _id: 0 }
      ).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betIds } },
        { betId: 1, ourbetId: 1, betamount: 1, settle: 1, cancel: 1, _id: 0 }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    // Only check game lock if there's new betting activity
    if (hasNewBetting && currentUser.gameLock?.pgslot?.lock) {
      const { response, signature } = createErrorResponse(
        400,
        "账户已锁定",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.betId, t])
    );
    const settlementUpdates = [];
    const newBetRecords = [];

    const multiplier = isDoubleBetting ? 2 : 1;

    // Calculate total bet amount for new bets validation
    const totalBetAmount = bets.reduce(
      (sum, bet) =>
        bet.isCreateAndSettlement === true && bet.betAmount
          ? sum + bet.betAmount
          : sum,
      0
    );

    // Build results for each bet
    const results = bets.map((bet) => {
      const {
        betNoVenue,
        netWinningAmount = 0,
        prizeAmount = 0,
        settlementTimestampMs,
        isCreateAndSettlement,
        gameCode,
        betAmount = 0,
      } = bet;

      const existingTransaction = existingBetMap.get(betNoVenue);
      const ourTransactionId = generateTransactionId();
      const actualSettleAmount = prizeAmount * multiplier;

      if (existingTransaction) {
        if (existingTransaction.cancel) {
          return {
            betType: 1,
            betNoVenue,
            betNoMerchant: existingTransaction.ourbetId,
            account,
            coin,
            betState: 4,
            settlementState: 1,
            operateState: 23,
            resultDesc: "注单已取消",
            needsTransaction: false,
          };
        }

        if (existingTransaction.settle) {
          return {
            betType: 1,
            betNoVenue,
            betNoMerchant: existingTransaction.ourbetId,
            account,
            coin,
            betState: 1,
            settlementState:
              netWinningAmount > 0 ? 3 : netWinningAmount < 0 ? 4 : 5,
            operateState: 22,
            resultDesc: "注单已结算",
            needsTransaction: false,
          };
        }

        settlementUpdates.push({
          betId: betNoVenue,
          netWinAmount: netWinningAmount,
          settleamount: actualSettleAmount,
          settlementState: 1,
        });

        return {
          betType: 1,
          betNoVenue,
          betNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          betState: 1,
          settlementState: 1,
          operateState: 1,
          resultDesc: "结算成功",
          needsTransaction: false,
        };
      } else if (isCreateAndSettlement) {
        const actualSettleAmount = prizeAmount * multiplier;

        newBetRecords.push({
          betId: betNoVenue,
          ourbetId: ourTransactionId,
          username: account.toUpperCase(),
          betamount: betAmount,
          settleamount: actualSettleAmount,
          settle: true,
          settlementState: 1,
        });

        return {
          betType: 1,
          betNoVenue,
          betNoMerchant: ourTransactionId,
          account,
          coin,
          betState: 1,
          settlementState: 1,
          operateState: 0,
          resultDesc: "创建并结算成功",
          needsTransaction: true,
          betAmount,
        };
      } else {
        return {
          betType: 1,
          betNoVenue,
          betNoMerchant: null,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 20,
          resultDesc: "注单不存在",
          needsTransaction: false,
        };
      }
    });

    let updatedUserBalance;

    if (hasNewBetting) {
      const netFromNewBets = bets.reduce((sum, bet) => {
        if (bet.isCreateAndSettlement === true && !bet.isTrial) {
          return sum + (bet.netWinningAmount || 0);
        }
        return sum;
      }, 0);

      const actualDeduction = totalBetAmount * multiplier;
      const actualWinning = netFromNewBets * multiplier;

      updatedUserBalance = await User.findOneAndUpdate(
        {
          gameId: actualGameId,
          wallet: { $gte: roundToTwoDecimals(actualDeduction) },
        },
        { $inc: { wallet: roundToTwoDecimals(actualWinning) } },
        { new: true, projection: { wallet: 1 } }
      );

      if (!updatedUserBalance) {
        // Insufficient balance - mark new bets as failed
        results.forEach((result) => {
          if (result.needsTransaction) {
            result.betState = 0;
            result.operateState = 3;
            result.resultDesc = "余额不足";
          }
        });

        const cleanResults = results.map(
          ({ needsTransaction, betAmount, ...bet }) => bet
        );
        const balanceMultiplier = isDoubleBetting ? 0.5 : 1;

        const completeResponse = {
          code: 200,
          message: "success",
          data: {
            gameType,
            account,
            coin,
            balance: roundToTwoDecimals(currentUser.wallet * balanceMultiplier),
            results: cleanResults,
          },
        };

        const signature = crypto
          .createHash("md5")
          .update(JSON.stringify(completeResponse) + pgSlotSecret)
          .digest("hex");
        return res.set("signature", signature).json(completeResponse);
      }

      // Create new bet records in parallel
      if (newBetRecords.length > 0) {
        await SlotPGSoftModal.insertMany(newBetRecords);
      }
    } else {
      // For settlement-only: update with prize amount
      const totalPrizeAmount = bets.reduce((sum, bet) => {
        if (!bet.isCreateAndSettlement) {
          const existingTransaction = existingBetMap.get(bet.betNoVenue);
          if (
            existingTransaction &&
            !existingTransaction.cancel &&
            !existingTransaction.settle
          ) {
            return sum + (bet.prizeAmount || 0);
          }
        }
        return sum;
      }, 0);

      const actualPrizeAmount = totalPrizeAmount * multiplier;

      updatedUserBalance = await User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(actualPrizeAmount) } },
        { new: true, projection: { wallet: 1 } }
      );

      if (settlementUpdates.length > 0) {
        await Promise.all(
          settlementUpdates.map((update) =>
            SlotPGSoftModal.updateOne(
              { betId: update.betId },
              {
                $set: {
                  settleamount: update.settleamount,
                  settle: true,
                  settlementState: update.settlementState,
                },
              }
            )
          )
        );
      }
    }

    const cleanResults = results.map(
      ({ needsTransaction, betAmount, ...bet }) => bet
    );
    const displayBalanceMultiplier = isDoubleBetting ? 0.5 : 1;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * displayBalanceMultiplier
        ),
        results: cleanResults,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    return res.set("signature", signature).json(completeResponse);
  } catch (error) {
    console.error("PG SOFT: Error in settlementbet:", error.message);
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }
});

router.post("/api/pgslot2.0/resettlementbet", async (req, res) => {
  const { data } = req.body;

  if (!data) {
    const { response, signature } = createErrorResponse(
      400,
      "参数错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }

  try {
    const requestParams = JSON.parse(decryptRequestBody(data, pgSlotSecret));
    const { account, coin = "HKD", bets, gameType = "slot" } = requestParams;

    if (!account || !Array.isArray(bets) || !bets.length) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();
    const betIds = bets.map((bet) => bet.betNoVenue).filter(Boolean);

    // Check if any bet has create+settlement (new betting activity)
    const hasNewBetting = bets.some(
      (bet) => bet.isCreateAndSettlement === true
    );

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, _id: 0 }
      ).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betIds } },
        {
          betId: 1,
          ourbetId: 1,
          betamount: 1,
          settleamount: 1,
          settle: 1,
          cancel: 1,
          _id: 0,
        }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.betId, t])
    );
    const resettlementUpdates = [];
    let totalReversalAmount = 0; // Amount to reverse from previous settlements

    // Build results for each bet - no new records for resettlement
    const results = bets.map((bet) => {
      const {
        betNoVenue,
        netWinningAmount = 0,
        prizeAmount = 0,

        gameCode,
        betAmount,
      } = bet;

      const existingTransaction = existingBetMap.get(betNoVenue);

      if (existingTransaction) {
        if (existingTransaction.cancel) {
          return {
            betType: 1,
            betNoVenue,
            betNoMerchant: existingTransaction.ourbetId,
            account,
            coin,
            betState: 4,
            settlementState: 1,
            operateState: 23,
            resultDesc: "注单已取消",
            needsReversal: false,
          };
        }

        // Calculate reversal amount if bet was previously settled
        if (existingTransaction.settle && existingTransaction.settleamount) {
          totalReversalAmount += existingTransaction.settleamount;
        }

        const settlementState =
          netWinningAmount > 0 ? 3 : netWinningAmount < 0 ? 4 : 5;

        resettlementUpdates.push({
          betId: betNoVenue,
          newNetWinAmount: netWinningAmount,
          newPrizeAmount: prizeAmount,
          oldSettleAmount: existingTransaction.settleamount || 0,
          betAmount: betAmount || 0,
          settlementState,
        });

        return {
          betType: 1,
          betNoVenue,
          betNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          betState: 1,
          settlementState,
          operateState: 1,
          resultDesc: existingTransaction.settle ? "重新结算成功" : "结算成功",
          needsReversal: existingTransaction.settle,
        };
      } else {
        // No existing transaction found - cannot resettle non-existent bet
        return {
          betType: 1,
          betNoVenue,
          betNoMerchant: null,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 20,
          resultDesc: "注单不存在",
          needsReversal: false,
        };
      }
    });

    // Calculate net change for resettlement
    const multiplier = isDoubleBetting ? 2 : 1;
    const newTotalPrizeAmount = bets.reduce((sum, bet) => {
      const existingTransaction = existingBetMap.get(bet.betNoVenue);
      if (
        existingTransaction &&
        existingTransaction.settle &&
        !existingTransaction.cancel
      ) {
        return sum + (bet.prizeAmount || 0);
      }
      return sum;
    }, 0);

    const actualNewPrizeAmount = newTotalPrizeAmount * multiplier;
    const actualReversalAmount = totalReversalAmount;
    const netUpdateAmount = actualNewPrizeAmount - actualReversalAmount;

    let updatedUserBalance;

    // Only validate balance if net update is negative (user owes money)
    if (netUpdateAmount < 0) {
      const requiredBalance = Math.abs(netUpdateAmount);

      updatedUserBalance = await User.findOneAndUpdate(
        {
          gameId: actualGameId,
          wallet: { $gte: roundToTwoDecimals(requiredBalance) },
        },
        { $inc: { wallet: roundToTwoDecimals(netUpdateAmount) } },
        { new: true, projection: { wallet: 1 } }
      );

      if (!updatedUserBalance) {
        // Insufficient balance - mark all resettlement attempts as failed
        results.forEach((result) => {
          if (result.needsReversal) {
            result.betState = 0;
            result.operateState = 3;
            result.resultDesc = "余额不足";
          }
        });

        const cleanResults = results.map(({ needsReversal, ...bet }) => bet);
        const balanceMultiplier = isDoubleBetting ? 0.5 : 1;

        const completeResponse = {
          code: 200,
          message: "success",
          data: {
            gameType,
            account,
            coin,
            balance: roundToTwoDecimals(currentUser.wallet * balanceMultiplier),
            results: cleanResults,
          },
        };

        const signature = crypto
          .createHash("md5")
          .update(JSON.stringify(completeResponse) + pgSlotSecret)
          .digest("hex");
        return res.set("signature", signature).json(completeResponse);
      }
    } else {
      // Positive or zero net update - no balance validation needed
      updatedUserBalance = await User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(netUpdateAmount) } },
        { new: true, projection: { wallet: 1 } }
      );
    }

    // Update existing bet settlements with new amounts
    if (resettlementUpdates.length > 0) {
      await Promise.all(
        resettlementUpdates.map((update) =>
          SlotPGSoftModal.updateOne(
            { betId: update.betId },
            {
              $set: {
                settleamount: update.newPrizeAmount,
                betamount: update.betAmount,
                settle: true,
                resettle: true,
                settlementState: update.settlementState,
              },
            }
          )
        )
      );
    }

    // Clean results and return response
    const cleanResults = results.map(({ needsReversal, ...bet }) => bet);
    const displayBalanceMultiplier = isDoubleBetting ? 0.5 : 1;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * displayBalanceMultiplier
        ),
        results: cleanResults,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    return res.set("signature", signature).json(completeResponse);
  } catch (error) {
    console.error("PG SOFT: Error in resettlementbet:", error.message);
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }
});

router.post("/api/pgslot2.0/backsettlementbet", async (req, res) => {
  const { data } = req.body;

  if (!data) {
    const { response, signature } = createErrorResponse(
      400,
      "参数错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }

  try {
    const requestParams = JSON.parse(decryptRequestBody(data, pgSlotSecret));
    const { account, coin, betNoVenues, gameType } = requestParams;

    if (!account || !Array.isArray(betNoVenues) || !betNoVenues.length) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, _id: 0 }
      ).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betNoVenues } },
        {
          betId: 1,
          ourbetId: 1,
          settleamount: 1,
          settle: 1,
          cancel: 1,
          settlementState: 1,
          _id: 0,
        }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.betId, t])
    );
    let totalRollbackAmount = 0;
    const rollbackUpdates = [];

    // Build results for each bet
    const results = betNoVenues.map((betId) => {
      const existingTransaction = existingBetMap.get(betId);

      if (!existingTransaction) {
        // Bet doesn't exist
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: null,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 20,
          resultDesc: "注单不存在",
        };
      }

      if (existingTransaction.cancel) {
        // Bet is cancelled
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          betState: 4,
          settlementState: 1,
          operateState: 23,
          resultDesc: "注单已取消",
        };
      }

      if (!existingTransaction.settle) {
        // Bet is not settled yet - cannot rollback unsettled bet
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          betState: 1,
          settlementState: 1,
          operateState: 24,
          resultDesc: "注单未结算",
        };
      }

      // Bet is settled - can be rolled back
      // Add settlement amount to rollback (this will be deducted from wallet)
      const settleAmount = existingTransaction.settleamount || 0;
      totalRollbackAmount += settleAmount;

      rollbackUpdates.push({
        betId: betId,
        originalSettleAmount: settleAmount,
        originalSettlementState: existingTransaction.settlementState,
      });

      return {
        betType: 1,
        betNoVenue: betId,
        betNoMerchant: existingTransaction.ourbetId,
        account,
        coin,
        betState: 1, // Back to initial bet state
        settlementState: 1, // Back to unsettled
        operateState: 0,
        resultDesc: "回滚成功",
      };
    });

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: actualGameId,
        wallet: { $gte: roundToTwoDecimals(totalRollbackAmount) },
      },
      { $inc: { wallet: -roundToTwoDecimals(totalRollbackAmount) } },
      { new: true, projection: { wallet: 1 } }
    );

    if (!updatedUserBalance) {
      // Insufficient balance - mark rollback attempts as failed
      results.forEach((result) => {
        if (result.resultDesc === "回滚成功") {
          result.betState = 0;
          result.operateState = 3;
          result.resultDesc = "余额不足";
        }
      });

      const displayBalanceMultiplier = isDoubleBetting ? 0.5 : 1;

      const completeResponse = {
        code: 200,
        message: "success",
        data: {
          gameType,
          account,
          coin,
          balance: roundToTwoDecimals(
            currentUser.wallet * displayBalanceMultiplier
          ),
          results,
        },
      };

      const signature = crypto
        .createHash("md5")
        .update(JSON.stringify(completeResponse) + pgSlotSecret)
        .digest("hex");
      return res.set("signature", signature).json(completeResponse);
    }

    // Update bet records to rollback settlement state
    if (rollbackUpdates.length > 0) {
      await Promise.all(
        rollbackUpdates.map((update) =>
          SlotPGSoftModal.updateOne(
            { betId: update.betId },
            {
              $unset: {
                settleamount: "",
              },
              $set: {
                settlementState: 1,
                settle: false,
                previousSettleAmount: update.originalSettleAmount,
              },
            }
          )
        )
      );
    }

    const displayBalanceMultiplier = isDoubleBetting ? 0.5 : 1;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * displayBalanceMultiplier
        ),
        results,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    return res.set("signature", signature).json(completeResponse);
  } catch (error) {
    console.error("PG SOFT: Error in backsettlementbet:", error.message);
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }
});

router.post("/api/pgslot2.0/cancelsettlementbet", async (req, res) => {
  const { data } = req.body;

  if (!data) {
    const { response, signature } = createErrorResponse(
      400,
      "参数错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }

  try {
    const requestParams = JSON.parse(decryptRequestBody(data, pgSlotSecret));
    const { account, coin, betNoVenues, gameType } = requestParams;

    if (!account || !Array.isArray(betNoVenues) || !betNoVenues.length) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, _id: 0 }
      ).lean(),
      SlotPGSoftModal.find(
        { betId: { $in: betNoVenues } },
        {
          betId: 1,
          ourbetId: 1,
          betamount: 1,
          settleamount: 1,
          settle: 1,
          cancel: 1,
          settlementState: 1,
          _id: 0,
        }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.betId, t])
    );
    let totalRefundAmount = 0;
    let totalBetAmount = 0;
    const cancelUpdates = [];

    // Build results for each bet
    const results = betNoVenues.map((betId) => {
      const existingTransaction = existingBetMap.get(betId);

      if (!existingTransaction) {
        // Bet doesn't exist
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: null,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 20,
          resultDesc: "注单不存在",
        };
      }

      if (existingTransaction.cancel) {
        // Bet is already cancelled
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          betState: 4,
          settlementState: 1,
          operateState: 23,
          resultDesc: "注单已取消",
        };
      }

      if (!existingTransaction.settle) {
        // Bet is not settled yet - cannot cancel unsettled settlement
        return {
          betType: 1,
          betNoVenue: betId,
          betNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          betState: 0,
          settlementState: 1,
          operateState: 2,
          resultDesc: "注单未结算",
        };
      }

      const settleAmount = existingTransaction.settleamount || 0;
      const betAmount = existingTransaction.betamount || 0;

      totalRefundAmount -= settleAmount;
      totalBetAmount += betAmount;

      cancelUpdates.push({
        betId: betId,
        originalBetAmount: betAmount,
        originalSettleAmount: settleAmount,
        originalSettlementState: existingTransaction.settlementState,
      });

      return {
        betType: 1,
        betNoVenue: betId,
        betNoMerchant: existingTransaction.ourbetId,
        account,
        coin,
        betState: 4, // Cancelled state
        settlementState: 1, // Back to unsettled
        operateState: 0,
        resultDesc: "取消成功",
      };
    });

    const netRefundAmount = totalBetAmount + totalRefundAmount;

    let updatedUserBalance;
    if (netRefundAmount < 0) {
      const requiredBalance = Math.abs(netRefundAmount);

      updatedUserBalance = await User.findOneAndUpdate(
        {
          gameId: actualGameId,
          wallet: { $gte: roundToTwoDecimals(requiredBalance) },
        },
        { $inc: { wallet: roundToTwoDecimals(netRefundAmount) } },
        { new: true, projection: { wallet: 1 } }
      );

      if (!updatedUserBalance) {
        // Insufficient balance - mark all resettlement attempts as failed
        results.forEach((result) => {
          if (result.needsReversal) {
            result.betState = 0;
            result.operateState = 3;
            result.resultDesc = "余额不足";
          }
        });

        const balanceMultiplier = isDoubleBetting ? 0.5 : 1;

        const completeResponse = {
          code: 200,
          message: "success",
          data: {
            gameType,
            account,
            coin,
            balance: roundToTwoDecimals(currentUser.wallet * balanceMultiplier),
            results: results,
          },
        };

        const signature = crypto
          .createHash("md5")
          .update(JSON.stringify(completeResponse) + pgSlotSecret)
          .digest("hex");
        return res.set("signature", signature).json(completeResponse);
      }
    } else {
      updatedUserBalance = await User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(netRefundAmount) } },
        { new: true, projection: { wallet: 1 } }
      );
    }

    // Update bet records to cancelled state
    if (cancelUpdates.length > 0) {
      await Promise.all(
        cancelUpdates.map((update) =>
          SlotPGSoftModal.updateOne(
            { betId: update.betId },
            {
              $set: {
                cancel: true,
              },
            }
          )
        )
      );
    }

    // Calculate display balance
    const displayBalanceMultiplier = isDoubleBetting ? 0.5 : 1;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * displayBalanceMultiplier
        ),
        results,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    return res.set("signature", signature).json(completeResponse);
  } catch (error) {
    console.error("PG SOFT: Error in cancelsettlementbet:", error.message);
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }
});

router.post("/api/pgslot2.0/adjustbill", async (req, res) => {
  const { data } = req.body;

  if (!data) {
    const { response, signature } = createErrorResponse(
      400,
      "参数错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }

  try {
    const requestParams = JSON.parse(decryptRequestBody(data, pgSlotSecret));
    const { account, coin, bills, gameType } = requestParams;

    if (!account || !bills || !Array.isArray(bills) || bills.length === 0) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();
    const billIds = bills.map((bet) => bet.billNoVenue).filter(Boolean);

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, _id: 0 }
      ).lean(),
      SlotPGSoftModal.find(
        { billId: { $in: billIds } },
        { _id: 1, billId: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.billId, t])
    );

    // Build results for each bet
    const results = bills.map((bet) => {
      const { billNoVenue, amount, reason, remark } = bet;

      const existingTransaction = existingBetMap.get(billNoVenue);
      const ourTransactionId = generateTransactionId();

      if (existingTransaction) {
        return {
          billNoVenue: billNoVenue,
          billNoMerchant: ourTransactionId,
          account,
          coin,
          operateState: 21,
          amount,
          reason,
          remark,
          needsTransaction: false,
        };
      } else {
        return {
          billNoVenue: billNoVenue,
          billNoMerchant: ourTransactionId,
          account,
          coin,
          operateState: 1,
          amount,
          reason,
          remark,
          needsTransaction: true,
        };
      }
    });

    const newBets = results.filter((bet) => bet.needsTransaction);
    const totalUpdateAmount = newBets.reduce(
      (sum, bet) => sum + (bet.amount || 0),
      0
    );

    let updatedUserBalance;
    const multiplier = isDoubleBetting ? 2 : 1;

    const balancemultiplier = isDoubleBetting ? 0.5 : 1;
    const actualUpdate = totalUpdateAmount * multiplier;

    if (actualUpdate < 0) {
      const requiredBalance = Math.abs(actualUpdate);
      updatedUserBalance = await User.findOneAndUpdate(
        {
          gameId: actualGameId,
          wallet: { $gte: roundToTwoDecimals(requiredBalance) },
        },
        { $inc: { wallet: roundToTwoDecimals(actualUpdate) } },
        { new: true, projection: { wallet: 1 } }
      );

      if (!updatedUserBalance) {
        // Insufficient balance - mark new bets as failed
        results.forEach((result) => {
          if (result.needsTransaction) {
            result.operateState = 3;
          }
        });

        const cleanResults = results.map(
          ({ needsTransaction, amount, reason, remark, ...bet }) => bet
        );
        const balanceMultiplier = isDoubleBetting ? 0.5 : 1;

        const completeResponse = {
          code: 200,
          message: "success",
          data: {
            gameType,
            account,
            coin,
            balance: roundToTwoDecimals(currentUser.wallet * balanceMultiplier),
            results: cleanResults,
          },
        };

        const signature = crypto
          .createHash("md5")
          .update(JSON.stringify(completeResponse) + pgSlotSecret)
          .digest("hex");
        return res.set("signature", signature).json(completeResponse);
      }
    } else {
      updatedUserBalance = await User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(actualUpdate) } },
        { new: true, projection: { wallet: 1 } }
      );
    }

    if (newBets.length > 0) {
      await Promise.all(
        newBets.map((bet) => {
          const applied = roundToTwoDecimals((bet.amount || 0) * multiplier);
          const isNeg = applied < 0;

          return SlotPGSoftModal.create({
            billId: bet.billNoVenue, // was adjustIDVenue
            betId: bet.betNoVenue,
            ourbetId: bet.billNoMerchant,
            username: bet.account.toUpperCase(),
            betamount: isNeg ? Math.abs(applied) : 0, // negative -> betamount
            settleamount: isNeg ? 0 : applied, // positive -> settleamount
            bet: true,
            settle: true,
          });
        })
      );
    }

    const cleanResults = results.map(
      ({ needsTransaction, amount, reason, remark, ...bet }) => bet
    );

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * balancemultiplier
        ),
        results: cleanResults,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    return res.set("signature", signature).json(completeResponse);
  } catch (error) {
    console.error("PG SOFT: Error in settlementbet:", error.message);
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }
});

router.post("/api/pgslot2.0/cancelbill", async (req, res) => {
  const { data } = req.body;

  if (!data) {
    const { response, signature } = createErrorResponse(
      400,
      "参数错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }

  try {
    const requestParams = JSON.parse(decryptRequestBody(data, pgSlotSecret));
    const { account, coin, billNoVenues, gameType } = requestParams;

    if (!account || !Array.isArray(billNoVenues) || !billNoVenues.length) {
      const { response, signature } = createErrorResponse(
        400,
        "参数错误",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const isDoubleBetting = account.toUpperCase().endsWith("2X");
    const actualGameId = isDoubleBetting
      ? account.toUpperCase().slice(0, -2)
      : account.toUpperCase();

    const [currentUser, existingTransactions] = await Promise.all([
      User.findOne(
        { gameId: actualGameId },
        { username: 1, wallet: 1, _id: 0 }
      ).lean(),
      SlotPGSoftModal.find(
        { billId: { $in: billNoVenues } },
        {
          _id: 1,
          billId: 1,
          betamount: 1,
          settleamount: 1,
          ourbetId: 1,
          cancel: 1,
        }
      ).lean(),
    ]);

    if (!currentUser) {
      const { response, signature } = createErrorResponse(
        400,
        "未找到用户",
        pgSlotSecret
      );
      return res.set("signature", signature).json(response);
    }

    const existingBetMap = new Map(
      existingTransactions.map((t) => [t.billId, t])
    );

    let totalRefundAmount = 0;
    let totalBetAmount = 0;
    const cancelUpdates = [];

    const results = billNoVenues.map((billId) => {
      const existingTransaction = existingBetMap.get(billId);

      if (!existingTransaction) {
        // Bet doesn't exist
        return {
          billNoVenue: billId,
          billNoMerchant: null,
          account,
          coin,
          operateState: 20,
        };
      }

      if (existingTransaction.cancel) {
        // Bet is already cancelled
        return {
          billNoVenue: existingTransaction.billId,
          billNoMerchant: existingTransaction.ourbetId,
          account,
          coin,
          operateState: 23,
        };
      }

      const settleAmount = existingTransaction.settleamount || 0;
      const betAmount = existingTransaction.betamount || 0;

      totalRefundAmount -= settleAmount;
      totalBetAmount += betAmount;

      cancelUpdates.push({
        billId: existingTransaction.billId,
      });

      return {
        billNoVenue: existingTransaction.billId,
        billNoMerchant: existingTransaction.ourbetId,
        account,
        coin,
        operateState: 1,
      };
    });

    const netRefundAmount = totalBetAmount + totalRefundAmount;

    let updatedUserBalance;
    if (netRefundAmount < 0) {
      const requiredBalance = Math.abs(netRefundAmount);

      updatedUserBalance = await User.findOneAndUpdate(
        {
          gameId: actualGameId,
          wallet: { $gte: roundToTwoDecimals(requiredBalance) },
        },
        { $inc: { wallet: roundToTwoDecimals(netRefundAmount) } },
        { new: true, projection: { wallet: 1 } }
      );

      if (!updatedUserBalance) {
        // Insufficient balance - mark all resettlement attempts as failed
        results.forEach((result) => {
          result.operateState = 3;
        });

        const balanceMultiplier = isDoubleBetting ? 0.5 : 1;

        const completeResponse = {
          code: 200,
          message: "success",
          data: {
            gameType,
            account,
            coin,
            balance: roundToTwoDecimals(currentUser.wallet * balanceMultiplier),
            results: results,
          },
        };

        const signature = crypto
          .createHash("md5")
          .update(JSON.stringify(completeResponse) + pgSlotSecret)
          .digest("hex");
        return res.set("signature", signature).json(completeResponse);
      }
    } else {
      updatedUserBalance = await User.findOneAndUpdate(
        { gameId: actualGameId },
        { $inc: { wallet: roundToTwoDecimals(netRefundAmount) } },
        { new: true, projection: { wallet: 1 } }
      );
    }

    // Update bet records to cancelled state
    if (cancelUpdates.length > 0) {
      await Promise.all(
        cancelUpdates.map((update) =>
          SlotPGSoftModal.updateOne(
            { billId: update.billId },
            {
              $set: {
                cancel: true,
              },
            }
          )
        )
      );
    }

    // Calculate display balance
    const displayBalanceMultiplier = isDoubleBetting ? 0.5 : 1;

    const completeResponse = {
      code: 200,
      message: "success",
      data: {
        gameType,
        account,
        coin,
        balance: roundToTwoDecimals(
          updatedUserBalance.wallet * displayBalanceMultiplier
        ),
        results,
      },
    };

    const signature = crypto
      .createHash("md5")
      .update(JSON.stringify(completeResponse) + pgSlotSecret)
      .digest("hex");
    return res.set("signature", signature).json(completeResponse);
  } catch (error) {
    console.error("PG SOFT: Error in settlementbet:", error.message);
    const { response, signature } = createErrorResponse(
      500,
      "伺服器错误",
      pgSlotSecret
    );
    return res.set("signature", signature).json(response);
  }
});

router.post("/api/pgsoft/getturnoverforrebate", async (req, res) => {
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

    console.log("PG SLOT QUERYING TIME", startDate, endDate);

    const records = await SlotPGSoftModal.find({
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
        console.warn(`PG SLOT User not found for gameId: ${gameId}`);
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
        gamename: "PG SLOT",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("PG SLOT: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "PG SLOT: Failed to fetch win/loss report",
        zh: "PG SLOT: 获取盈亏报告失败",
      },
    });
  }
});

router.post("/api/pgsoft2x/getturnoverforrebate", async (req, res) => {
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

    console.log("PG SLOT QUERYING TIME", startDate, endDate);

    const records = await SlotPGSoftModal.find({
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
        console.warn(`PG SLOT2x User not found for gameId: ${gameId}`);
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
        gamename: "PG SLOT2X",
        gamecategory: "Slot Games",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("PG SLOT: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "PG SLOT: Failed to fetch win/loss report",
        zh: "PG SLOT: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/pgsoft/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotPGSoftModal.find({
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
          gamename: "PG SLOT",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PG SLOT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pgsoft2x/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SlotPGSoftModal.find({
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
          gamename: "PG SLOT2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PG SLOT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pgsoft/:userId/gamedata",
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

          if (slotGames["PG SLOT"]) {
            totalTurnover += slotGames["PG SLOT"].turnover || 0;
            totalWinLoss += slotGames["PG SLOT"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PG SLOT",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PG SLOT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pgsoft2x/:userId/gamedata",
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

          if (slotGames["PG SLOT2X"]) {
            totalTurnover += slotGames["PG SLOT2X"].turnover || 0;
            totalWinLoss += slotGames["PG SLOT2X"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PG SLOT2X",
          gamecategory: "Slot Games",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("PG SLOT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pgsoft/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotPGSoftModal.find({
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
          gamename: "PG SLOT",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PG SLOT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pgsoft2x/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SlotPGSoftModal.find({
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
          gamename: "PG SLOT2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PG SLOT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pgsoft/kioskreport",
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

          if (liveCasino["PG SLOT"]) {
            totalTurnover += Number(liveCasino["PG SLOT"].turnover || 0);
            totalWinLoss += Number(liveCasino["PG SLOT"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PG SLOT",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PG SLOT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/pgsoft2x/kioskreport",
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

          if (liveCasino["PG SLOT2X"]) {
            totalTurnover += Number(liveCasino["PG SLOT2X"].turnover || 0);
            totalWinLoss += Number(liveCasino["PG SLOT2X"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "PG SLOT2X",
          gamecategory: "Slot Games",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("PG SLOT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "PG SLOT: Failed to fetch win/loss report",
          zh: "PG SLOT: 获取盈亏报告失败",
        },
      });
    }
  }
);

module.exports = router;
