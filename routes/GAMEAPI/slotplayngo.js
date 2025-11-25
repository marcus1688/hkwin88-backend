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

const playNGoUsername = process.env.PLAYNGO_USERNAME; // API User credentials
const playNGoPassword = process.env.PLAYNGO_PASSWORD; // API User credentials
const playNGoPID = process.env.PLAYNGO_PID; // Product Group ID
const playNGoAPIURL = "https://api-as.playngonetwork.com"; // For Asia Region

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate Basic Authorization header for Play'n GO API
 * @param {string} username - API username
 * @param {string} password - API password
 * @returns {string} - Base64 encoded credentials
 */
function generatePlayNGoAuth(username, password) {
  const credentials = `${username}:${password}`;
  return Buffer.from(credentials).toString("base64");
}

// ============================================
// ROUTES
// ============================================

/**
 * GET ENABLED GAMES LIST FROM PLAY'N GO
 * Endpoint: GET /api/playngo/getenabledgames
 * Purpose: Fetch all enabled games for the product group
 */
router.get("/api/playngo/getenabledgames", async (req, res) => {
  try {
    const { country, region, channel = "mobile" } = req.query;

    console.log("Play'n GO GetEnabledGames Request:", {
      country,
      region,
      channel,
    });

    // Generate Basic Auth
    const authHeader = `Basic ${generatePlayNGoAuth(
      playNGoUsername,
      playNGoPassword
    )}`;

    // Build query parameters
    const params = new URLSearchParams();
    if (country) params.append("country", country);
    if (region) params.append("region", region);
    if (channel) params.append("channel", channel);

    const queryString = params.toString();
    const apiURL = `${playNGoAPIURL}/casino/gamesconfiguration/enabledgames${
      queryString ? `?${queryString}` : ""
    }`;

    // Make the API request
    const response = await axios.get(apiURL, {
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Authorization: authHeader,
        pid: playNGoPID,
      },
    });

    console.log(
      `Play'n GO API Response: ${response.data.length} games retrieved`
    );

    return res.status(200).json({
      success: true,
      totalGames: response.data.length,
      games: response.data,
      message: {
        en: "Games retrieved successfully.",
        zh: "游戏列表获取成功。",
        ms: "Senarai permainan berjaya diambil.",
      },
    });
  } catch (error) {
    console.error("Play'n GO error in getting enabled games:", error.message);

    // Log more details if it's an axios error
    if (error.response) {
      console.error("Play'n GO API Response Error:", {
        status: error.response.status,
        data: error.response.data,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      message: {
        en: "Play'n GO: Failed to retrieve games. Please try again or contact customer service.",
        zh: "Play'n GO: 获取游戏失败，请重试或联系客服。",
        ms: "Play'n GO: Gagal mendapatkan permainan. Sila cuba lagi atau hubungi khidmat pelanggan.",
      },
    });
  }
});

module.exports = router;
