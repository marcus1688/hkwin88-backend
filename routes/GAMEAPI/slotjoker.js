const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const { authenticateToken } = require("../../auth/auth");
const { authenticateAdminToken } = require("../../auth/adminAuth");
const { User, adminUserWalletLog } = require("../../models/users.model");
const { adminUser, adminLog } = require("../../models/adminuser.model");
const { v4: uuidv4 } = require("uuid");
const querystring = require("querystring");
const moment = require("moment");

require("dotenv").config();

function generateUniqueTransactionId(prefix) {
  const uuid = uuidv4().replace(/-/g, ""); // Remove hyphens
  return `${prefix}-${uuid.substring(0, 43)}`; // Ensure the length is 50 characters maximum
}

const gameAPIURL = "https://w.apiext88.net";
const webURL = "https://www.hkwin88.com/";
const gameAPPID = "FTXS";
const gameKEY = process.env.JOKER_SECRET;
const gamePassword = "Qwer1122";

function generateSignature(fields, secretKey) {
  const data = [];
  for (const key in fields) {
    data.push(`${key}=${fields[key]}`);
  }
  data.sort();

  const rawData = data.join("&");

  const hmac = crypto.createHmac("sha1", Buffer.from(secretKey, "utf8"));
  hmac.update(rawData, "utf8");

  return hmac.digest("base64");
}

async function setJokerPassword(user) {
  try {
    const timestamp = moment().unix();

    const fields = {
      Method: "SP",
      Username: user.gameId,
      Password: gamePassword,
      Timestamp: timestamp,
    };

    const Signature = generateSignature(fields, gameKEY);

    const response = await axios.post(
      `${gameAPIURL}?appid=${gameAPPID}&signature=${encodeURIComponent(
        Signature
      )}`,
      fields,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.Status !== "OK") {
      return {
        success: false,
        error: response.data,
      };
    }

    await User.findOneAndUpdate(
      { username: user.username },
      {
        $set: {
          jokerGamePW: gamePassword,
        },
      }
    );

    return { success: true, data: response.data, password: gamePassword };
  } catch (error) {
    console.error("JOKER error in setting password:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function registerJokerUser(user) {
  try {
    const timestamp = moment().unix();

    const fields = {
      Method: "CU",
      Username: user.gameId,
      Timestamp: timestamp,
    };

    const Signature = generateSignature(fields, gameKEY);

    const response = await axios.post(
      `${gameAPIURL}?appid=${gameAPPID}&signature=${encodeURIComponent(
        Signature
      )}`,
      fields,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.Status !== "Created" && response.data.Status !== "OK") {
      return {
        success: false,
        error: response.data,
      };
    }

    await User.findOneAndUpdate(
      { username: user.username },
      {
        $set: {
          jokerGameName: `${gameAPPID}.${user.gameId}`,
        },
      }
    );

    const setPasswordResponse = await setJokerPassword(user);

    if (!setPasswordResponse.success) {
      console.log("failed to set password for user", setPasswordResponse);
      return {
        success: false,
        error: setPasswordResponse.error,
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error("JOKER error in creating member:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = router;
module.exports.registerJokerUser = registerJokerUser;
module.exports.setJokerPassword = setJokerPassword;
