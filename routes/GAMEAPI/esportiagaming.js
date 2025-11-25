const express = require("express");
const router = express.Router();
const axios = require("axios");
const moment = require("moment");
const crypto = require("crypto");
const { authenticateToken } = require("../../auth/auth");
const { authenticateAdminToken } = require("../../auth/adminAuth");
const {
  User,
  adminUserWalletLog,
  GameDataLog,
} = require("../../models/users.model");
const { adminUser, adminLog } = require("../../models/adminuser.model");
const GameWalletLog = require("../../models/gamewalletlog.model");
const ESportIAGamingModal = require("../../models/esport_iagaming.model");
const Decimal = require("decimal.js");
const bodyParser = require("body-parser");

require("dotenv").config();

const iaesportAgentPrefix = "EW9H";
const webURL = "https://www.ezwin9.com/";
const iaesportAPIURL = "https://api.ilustre-analysis.net/api";
const iaesportSecret = process.env.IAESPORT_SECRET;
const iaesportIV = process.env.IAESPORT_IV;

function generateAuthKey(params) {
  const sortedKeys = Object.keys(params).sort();

  const paramString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join(",");

  return crypto.createHash("md5").update(paramString).digest("hex");
}

function encryptParams(params) {
  const jsonString = JSON.stringify(params);

  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(iaesportSecret),
    Buffer.from(iaesportIV)
  );

  let encrypted = cipher.update(jsonString, "utf8", "base64");
  encrypted += cipher.final("base64");

  return encrypted;
}

function decryptIAData(encryptedData, secret, iv) {
  try {
    // Extract the encrypted string
    let encryptedString;
    if (typeof encryptedData === "string") {
      encryptedString = encryptedData;
    } else if (typeof encryptedData === "object" && encryptedData !== null) {
      const keys = Object.keys(encryptedData);
      if (keys.length > 0) {
        encryptedString = keys[0];
      } else {
        throw new Error("Empty object received");
      }
    } else {
      throw new Error(`Invalid data type: ${typeof encryptedData}`);
    }

    // Clean and normalize the string
    encryptedString = encryptedString.trim();
    encryptedString = encryptedString.replace(/\s+/g, "+");

    // Create key and IV buffers
    const keyBuffer = Buffer.from(secret);
    const ivBuffer = Buffer.from(iv);

    // Manually handle base64 padding
    while (encryptedString.length % 4 !== 0) {
      encryptedString += "=";
    }

    // Convert to buffer
    const encryptedBuffer = Buffer.from(encryptedString, "base64");

    // Try multiple approaches for decryption
    let decrypted = null;

    // Approach 1: Without auto padding
    try {
      const decipher1 = crypto.createDecipheriv(
        "aes-256-cbc",
        keyBuffer,
        ivBuffer
      );
      decipher1.setAutoPadding(false);
      decrypted = decipher1.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher1.final()]);
    } catch (e) {
      console.log("Approach 1 failed:", e.message);

      // Approach 2: With auto padding
      try {
        const decipher2 = crypto.createDecipheriv(
          "aes-256-cbc",
          keyBuffer,
          ivBuffer
        );
        decipher2.setAutoPadding(true);
        decrypted = decipher2.update(encryptedBuffer);
        decrypted = Buffer.concat([decrypted, decipher2.final()]);
      } catch (e2) {
        console.log("Approach 2 failed:", e2.message);

        // Approach 3: Try ECB mode (just in case)
        try {
          const decipher3 = crypto.createDecipheriv(
            "aes-256-ecb",
            keyBuffer,
            Buffer.alloc(0)
          );
          decrypted = decipher3.update(encryptedBuffer);
          decrypted = Buffer.concat([decrypted, decipher3.final()]);
        } catch (e3) {
          console.log("Approach 3 failed:", e3.message);
          throw new Error("All decryption approaches failed");
        }
      }
    }

    if (!decrypted) {
      throw new Error("Decryption produced null result");
    }

    // Convert to string and parse JSON
    const decryptedString = decrypted.toString("utf8");

    // Sometimes there might be padding chars at the end, try to clean them
    const cleanJson = decryptedString.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

    // Parse JSON
    let params;
    try {
      params = JSON.parse(cleanJson);
    } catch (jsonError) {
      console.log(
        "JSON parsing failed. First 100 chars:",
        cleanJson.substring(0, 100)
      );
      throw new Error(`Invalid JSON after decryption: ${jsonError.message}`);
    }

    return {
      success: true,
      data: params,
    };
  } catch (error) {
    console.error("Decryption error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

function decryptIADiscountData(encryptedText) {
  try {
    const key = Buffer.from(secret, "utf8");
    const ivBuf = Buffer.from(iv, "utf8");

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivBuf);
    let decrypted = decipher.update(encryptedText, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return { success: true, data: JSON.parse(decrypted) };
  } catch (err) {
    return {
      success: false,
      error: "AES Decryption failed: " + err.message,
    };
  }
}

function padBase64(str) {
  const padLength = (4 - (str.length % 4)) % 4;
  return str + "=".repeat(padLength);
}

// Function to validate IA auth key
function validateIAAuthKey(params) {
  // Check if auth_key exists
  if (!params.auth_key) {
    return {
      success: false,
      error: "Missing auth_key",
    };
  }

  const receivedAuthKey = params.auth_key;

  const paramsForValidation = { ...params };
  delete paramsForValidation.auth_key;

  const calculatedAuthKey = generateAuthKey(paramsForValidation);

  if (calculatedAuthKey !== receivedAuthKey) {
    return {
      success: false,
      error: "Invalid auth_key",
    };
  }

  return {
    success: true,
    data: paramsForValidation,
  };
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

async function registerIAUser(username, currencyCode = "HKD") {
  try {
    const registerParams = {
      register_username: username,
      currency_code: currencyCode,
    };
    const registerAuthKey = generateAuthKey(registerParams);

    registerParams.auth_key = registerAuthKey;

    const registerEncryptedData = encryptParams(registerParams);

    const registerResponse = await axios.post(
      `${iaesportAPIURL}/user/register`,
      registerEncryptedData,
      {
        headers: {
          "Content-Type": "application/json",
          pch: iaesportAgentPrefix,
        },
      }
    );

    if (
      registerResponse.data.code !== 1 &&
      registerResponse.data.code !== 1001
    ) {
      return {
        success: false,
        error: registerResponse.data.msg,
      };
    }
    return { success: true, data: registerResponse.data };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Route to launch IA session
router.post("/api/iaesport/launchGame", authenticateToken, async (req, res) => {
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
          zh_hk: "搵唔到用戶，麻煩再試多次或者聯絡客服幫手。",
          id: "Pengguna tidak ditemukan. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    if (user.gameLock.iaesport.lock) {
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

    const registerData = await registerIAUser(user.gameId);

    if (!registerData.success) {
      console.log(
        `IA E-SPORT error in registering account ${registerData.error}`
      );
      return res.status(200).json({
        success: false,
        message: {
          en: "IA E-SPORT: Game launch failed. Please try again or contact customer service for assistance.",
          zh: "IA E-SPORT: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "IA E-SPORT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "IA E-SPORT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "IA E-SPORT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    let lang = 3;

    if (gameLang === "en") {
      lang = 2;
    } else if (gameLang === "zh") {
      lang = 1;
    } else if (gameLang === "zh_hk") {
      lang = 3;
    } else if (gameLang === "ms") {
      lang = 6;
    } else if (gameLang === "id") {
      lang = 6;
    }

    let platform = 1;
    if (clientPlatform === "web") {
      platform = 1;
    } else if (clientPlatform === "mobile") {
      platform = 2;
    }

    const params = { lang, username: user.gameId, client: platform };

    const authKey = generateAuthKey(params);

    params.auth_key = authKey;

    const encryptedData = encryptParams(params);

    const response = await axios.post(
      `${iaesportAPIURL}/user/lunch`,
      encryptedData,
      {
        headers: {
          "Content-Type": "text/plain",
          pch: iaesportAgentPrefix,
        },
      }
    );

    if (response.data.code !== 1) {
      console.log("IA E-SPORT error in launching game", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "IA E-SPORT: Game launch failed. Please try again or contact customer service for assistance.",
          zh: "IA E-SPORT: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "IA E-SPORT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "IA E-SPORT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "IA E-SPORT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "IA E-SPORTS"
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
    console.log("IA E-SPORT error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "IA E-SPORT: Game launch failed. Please try again or customer service for assistance.",
        zh: "IA E-SPORT: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "IA E-SPORT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "IA E-SPORT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "IA E-SPORT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/iagaming/balance", async (req, res) => {
  try {
    let rawData = req.body;

    if (typeof rawData === "object" && rawData !== null) {
      const keys = Object.keys(rawData);
      if (keys.length === 1 && rawData[keys[0]] === "") {
        rawData = keys[0].replace(/\s+/g, "+");
      }
    }

    if (!rawData) {
      return res.status(200).json({
        code: 111002,
        message: "Parameter is incorrect (no data received)",
        data: {},
      });
    }
    // Decrypt the data
    const decryptResult = decryptIAData(rawData, iaesportSecret, iaesportIV);
    if (!decryptResult.success) {
      return res.status(200).json({
        code: 111002,
        message: "Parameter is incorrect (decryption failed)",
        data: {},
      });
    }

    const validationResult = validateIAAuthKey(decryptResult.data);

    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error);
      return res.status(200).json({
        code: 111002,
        message: `Parameter is incorrect (${validationResult.error})`,
        data: {},
      });
    }

    const { username } = validationResult.data;

    if (!username) {
      return res.status(200).json({
        code: 111001,
        message: "Username is empty",
        data: {},
      });
    }

    // Find user in database
    const user = await User.findOne({ gameId: username }, { wallet: 1 }).lean();

    if (!user) {
      return res.status(200).json({
        code: 111003,
        message: "User does not exist",
        data: {},
      });
    }

    const available_balance = roundToTwoDecimals(user.wallet);

    return res.status(200).json({
      code: 200,
      message: "操作成功",
      data: {
        available_balance: available_balance.toFixed(4),
      },
    });
  } catch (error) {
    console.error("IA E-SPORT error in balance check:", error.message);
    return res.status(200).json({
      code: 111002,
      message: "Parameter is incorrect",
      data: {},
    });
  }
});

// router.post("/api/iagaming/deposit", async (req, res) => {
//   try {
//     // Decrypt the data
//     const decryptResult = decryptIADiscountData(
//       req.body,
//       iaesportSecret,
//       iaesportIV
//     );
//     if (!decryptResult.success) {
//       return res.status(200).json({
//         code: 111002,
//         message: "Parameter is incorrect (decryption failed)",
//         data: {},
//       });
//     }

//     const validationResult = validateIAAuthKey(decryptResult.data);
//     if (!validationResult.success) {
//       console.error("Validation failed:", validationResult.error);
//       return res.status(200).json({
//         code: 111002,
//         message: `Parameter is incorrect (${validationResult.error})`,
//         data: {},
//       });
//     }

//     const { username, money, orderId, desc, projectId } = validationResult.data;
//     console.log("ia esport, deposit", validationResult.data);
//     if (!username) {
//       return res.status(200).json({
//         code: 111001,
//         message: "Username is empty",
//         data: {},
//       });
//     }

//     const [user, existingBet, existingTransaction] = await Promise.all([
//       User.findOne({ gameId: username }, { _id: 1 }).lean(),
//       ESportIAGamingModal.findOne(
//         { betId: projectId, bet: true },
//         { _id: 1 }
//       ).lean(),
//       ESportIAGamingModal.findOne(
//         { betId: projectId, settle: true },
//         { _id: 1 }
//       ).lean(),
//     ]);

//     if (!user) {
//       return res.status(200).json({
//         code: 111003,
//         message: "User does not exist",
//         data: {},
//       });
//     }

//     if (!existingBet) {
//       return res.status(200).json({
//         code: 111006,
//         message: "Recharge failed",
//         data: {},
//       });
//     }

//     if (existingTransaction) {
//       return res.status(200).json({
//         code: 200,
//         message: "操作成功",
//         data: "",
//       });
//     }

//     const updateAmt = new Decimal(money).toDecimalPlaces(4).toNumber();

//     await Promise.all([
//       User.updateOne({ _id: user._id }, { $inc: { wallet: updateAmt } }),

//       ESportIAGamingModal.updateOne(
//         { betId: projectId },
//         { $set: { settle: true, settleamount: updateAmt, tranId: orderId } },
//         { upsert: true }
//       ),
//     ]);

//     return res.status(200).json({
//       code: 200,
//       message: "操作成功",
//       data: "",
//     });
//   } catch (error) {
//     console.error("IA E-SPORT error in balance check:", error.message);
//     return res.status(200).json({
//       code: 111002,
//       message: "Parameter is incorrect",
//       data: {},
//     });
//   }
// });

router.post("/api/iagaming/deposit", async (req, res) => {
  try {
    let rawData = req.body;

    if (typeof rawData === "object" && rawData !== null) {
      const keys = Object.keys(rawData);
      if (keys.length === 1 && rawData[keys[0]] === "") {
        rawData = keys[0].replace(/\s+/g, "+");
      }
    }

    if (!rawData) {
      return res.status(200).json({
        code: 111002,
        message: "Parameter is incorrect (no data received)",
        data: {},
      });
    }

    // Decrypt the data
    const decryptResult = decryptIAData(rawData, iaesportSecret, iaesportIV);

    if (!decryptResult.success) {
      console.error("Decryption failed for request:", req.body);
      return res.status(200).json({
        code: 111002,
        message: "Parameter is incorrect (decryption failed)",
        data: {},
      });
    }

    const validationResult = validateIAAuthKey(decryptResult.data);

    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error);
      return res.status(200).json({
        code: 111002,
        message: `Parameter is incorrect (${validationResult.error})`,
        data: {},
      });
    }

    const { username, money, orderId, desc, projectId } = validationResult.data;

    if (!username) {
      console.error("Username is empty in deposit request");
      return res.status(200).json({
        code: 111001,
        message: "Username is empty",
        data: {},
      });
    }

    const [user, existingBet, existingTransaction] = await Promise.all([
      User.findOne({ gameId: username }, { _id: 1 }).lean(),
      ESportIAGamingModal.findOne(
        { betId: projectId, bet: true },
        { _id: 1 }
      ).lean(),
      ESportIAGamingModal.findOne(
        { betId: projectId, settle: true },
        { _id: 1 }
      ).lean(),
    ]);

    if (!user) {
      console.error("User not found for gameId:", username);
      return res.status(200).json({
        code: 111003,
        message: "User does not exist",
        data: {},
      });
    }

    if (!existingBet) {
      console.error("No existing bet found for projectId:", projectId);
      return res.status(200).json({
        code: 111006,
        message: "Recharge failed",
        data: {},
      });
    }

    if (existingTransaction) {
      console.log("Transaction already processed for projectId:", projectId);
      return res.status(200).json({
        code: 200,
        message: "操作成功",
        data: "",
      });
    }

    const updateAmt = new Decimal(money).toDecimalPlaces(4).toNumber();

    await Promise.all([
      User.updateOne({ _id: user._id }, { $inc: { wallet: updateAmt } }),

      ESportIAGamingModal.updateOne(
        { betId: projectId },
        { $set: { settle: true, settleamount: updateAmt, tranId: orderId } },
        { upsert: true }
      ),
    ]);

    return res.status(200).json({
      code: 200,
      message: "操作成功",
      data: "",
    });
  } catch (error) {
    console.error("IA E-SPORT error in deposit:", {
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
    });
    return res.status(200).json({
      code: 111002,
      message: "Parameter is incorrect",
      data: {},
    });
  }
});

router.post("/api/iagaming/withdrawal", async (req, res) => {
  try {
    let rawData = req.body;

    if (typeof rawData === "object" && rawData !== null) {
      const keys = Object.keys(rawData);
      if (keys.length === 1 && rawData[keys[0]] === "") {
        rawData = keys[0].replace(/\s+/g, "+");
      }
    }

    if (!rawData) {
      return res.status(200).json({
        code: 111002,
        message: "Parameter is incorrect (no data received)",
        data: {},
      });
    }

    const decryptResult = decryptIAData(rawData, iaesportSecret, iaesportIV);
    if (!decryptResult.success) {
      return res.status(200).json({
        code: 111002,
        message: "Parameter is incorrect (decryption failed)",
        data: {},
      });
    }

    const validationResult = validateIAAuthKey(decryptResult.data);
    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error);
      return res.status(200).json({
        code: 111002,
        message: `Parameter is incorrect (${validationResult.error})`,
        data: {},
      });
    }

    const { username, money, orderId, desc, projectId } = validationResult.data;

    if (!username) {
      return res.status(200).json({
        code: 111001,
        message: "Username is empty",
        data: {},
      });
    }

    // Find user in database
    const user = await User.findOne(
      { gameId: username },
      { _id: 1, username: 1, wallet: 1 }
    ).lean();

    if (!user) {
      return res.status(200).json({
        code: 111003,
        message: "User does not exist",
        data: {},
      });
    }

    const projectIds = projectId.split(",").map((id) => id.trim());

    const existingBets = await ESportIAGamingModal.find(
      { betId: { $in: projectIds }, bet: true },
      { betId: 1 }
    ).lean();

    if (existingBets.length > 0) {
      const duplicateId = existingBets[0].betId;
      console.error(`Project ID ${duplicateId} already exists`);
      return res.status(200).json({
        code: 111007,
        message: "Order number already exists",
        data: {},
      });
    }

    let projects = [];
    try {
      let betDetails;
      if (typeof desc === "string") {
        betDetails = JSON.parse(desc);
      } else if (typeof desc === "object") {
        betDetails = desc;
      } else {
        throw new Error("Invalid description format");
      }

      if (betDetails.projects && Array.isArray(betDetails.projects)) {
        projects = betDetails.projects;
      } else {
        throw new Error("Missing projects in description");
      }
    } catch (error) {
      console.error("Error parsing bet description:", error.message);
      return res.status(200).json({
        code: 111002,
        message: "Parameter is incorrect (invalid description format)",
        data: {},
      });
    }

    // Validate we have matching numbers of projects and projectIds
    if (projectIds.length !== projects.length) {
      console.error(
        `Mismatch: ${projectIds.length} project IDs but ${projects.length} projects`
      );
      return res.status(200).json({
        code: 111002,
        message:
          "Parameter is incorrect (mismatch between project IDs and projects)",
        data: {},
      });
    }

    const betAmount = new Decimal(money).toDecimalPlaces(4).toNumber();

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: user._id,
        wallet: { $gte: betAmount },
      },
      { $inc: { wallet: -betAmount } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        code: 111004,
        message: "Insufficient balance",
        data: {},
      });
    }

    const betRecords = projectIds.map((pid, i) => ({
      username: username,
      betId: pid,
      bet: true,
      betamount: parseFloat(projects[i].amount),
      tranId: orderId,
    }));

    await ESportIAGamingModal.insertMany(betRecords);

    return res.status(200).json({
      code: 200,
      message: "操作成功",
      data: "",
    });
  } catch (error) {
    console.error("IA E-SPORT error in balance check:", error.message);
    return res.status(200).json({
      code: 111002,
      message: "Parameter is incorrect",
      data: {},
    });
  }
});

// ----------------
router.post("/api/iaesport/getturnoverforrebate", async (req, res) => {
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

    console.log("IA E-Sport QUERYING TIME", startDate, endDate);

    const records = await ESportIAGamingModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
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
        gamename: "IA E-Sport",
        gamecategory: "Sports",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("IA E-Sport: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      error: "IA E-Sport: Failed to fetch win/loss report",
    });
  }
});

router.get(
  "/admin/api/iaesport/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await ESportIAGamingModal.find({
        username: user.gameId,
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        cancel: { $ne: true },
        settle: true,
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
          gamename: "IA E-Sport",
          gamecategory: "Sports",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log(
        "IA E-Sport: Failed to fetch win/loss report:",
        error.message
      );
      return res.status(500).json({
        error: "IA E-Sport: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/iaesport/:userId/gamedata",
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

      records.forEach((record) => {
        const gameCategories =
          record.gameCategories instanceof Map
            ? Object.fromEntries(record.gameCategories)
            : record.gameCategories;

        if (
          gameCategories &&
          gameCategories["Sports"] &&
          gameCategories["Sports"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Sports"]);

          if (gamecat["IA E-Sport"]) {
            totalTurnover += gamecat["IA E-Sport"].turnover || 0;
            totalWinLoss += gamecat["IA E-Sport"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "IA E-Sport",
          gamecategory: "Sports",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log(
        "IA E-Sport: Failed to fetch win/loss report:",
        error.message
      );
      return res.status(500).json({
        error: "IA E-Sport: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/iaesport/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await ESportIAGamingModal.find({
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        cancel: { $ne: true },
        settle: true,
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss += (record.betamount || 0) - (record.settleamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "IA E-Sport",
          gamecategory: "Sports",
          totalturnover: totalTurnover,
          totalwinloss: totalWinLoss,
        },
      });
    } catch (error) {
      console.log(
        "IA E-Sport: Failed to fetch win/loss report:",
        error.message
      );
      return res.status(500).json({
        error: "IA E-Sport: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/iaesport/kioskreport",
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
          gameCategories["Sports"] &&
          gameCategories["Sports"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Sports"]);

          if (gamecat["IA E-Sport"]) {
            totalTurnover += Number(gamecat["IA E-Sport"].turnover || 0);
            totalWinLoss += Number(gamecat["IA E-Sport"].winloss || 0);
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "IA E-Sport",
          gamecategory: "Sports",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("IA E-Sport: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "IA E-Sport: Failed to fetch win/loss report",
      });
    }
  }
);

module.exports = router;
