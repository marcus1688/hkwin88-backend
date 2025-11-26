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
const GameWalletLog = require("../../models/gamewalletlog.model");
const moment = require("moment");
require("dotenv").config();

function generateUniqueTransactionId(prefix) {
  const uuid = uuidv4().replace(/-/g, ""); // Remove hyphens
  return `${prefix}-${uuid.substring(0, 43)}`; // Ensure the length is 50 characters maximum
}

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
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

function generateUniqueTransactionId(prefix) {
  const uuid = uuidv4().replace(/-/g, "");
  return `${prefix}-${uuid.substring(0, 14)}`;
}

async function GameWalletLogAttempt(
  username,
  transactiontype,
  remark,
  amount,
  gamename,
  gamebalance,
  beforewalletbalance,
  afterwalletbalance
) {
  await GameWalletLog.create({
    username,
    transactiontype,
    remark: remark || "",
    amount,
    gamename: gamename,
    gamebalance,
    beforewalletbalance,
    afterwalletbalance,
  });
}

async function JokerCheckBalance(user) {
  try {
    const timestamp = moment().unix();

    const fields = {
      Method: "GC",
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

    if (response.status !== 200) {
      return {
        success: false,
        error: response.data,
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error("JOKER error in checking balance:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function JokerDeposit(user, trfamount) {
  try {
    const requestID = generateUniqueTransactionId("hkwin88");
    const timestamp = moment().unix();

    const fields = {
      Method: "TC",
      Username: user.gameId,
      Timestamp: timestamp,
      RequestID: requestID,
      Amount: trfamount,
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

    if (response.status !== 200) {
      return {
        success: false,
        error: response.data,
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error("JOKER error in deposit:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function JokerWithdraw(user, trfamount) {
  try {
    const requestID = generateUniqueTransactionId("hkwin88");
    const timestamp = moment().unix();

    const fields = {
      Method: "TC",
      Username: user.gameId,
      Timestamp: timestamp,
      RequestID: requestID,
      Amount: -trfamount,
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

    if (response.status !== 200) {
      return {
        success: false,
        error: response.data,
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error("JOKER error in withdraw:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
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

router.post(
  "/api/joker/register/:userId",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { userId } = req.params;
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

      const registerResponse = await registerJokerUser(user);
      if (!registerResponse.success) {
        return res.status(200).json({
          success: false,
          message: {
            en: "JOKER: Registration failed. Please try again or contact customer support for further assistance.",
            zh: "JOKER: 注册失败。请重试或联系客服寻求进一步帮助。",
            ms: "JOKER: Pendaftaran gagal. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan lanjut.",
            zh_hk: "JOKER: 註冊失敗。請重試或聯絡客服尋求進一步協助。",
            id: "JOKER: Pendaftaran gagal. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: {
          en: "JOKER: Account registered successfully.",
          zh: "JOKER: 账户注册成功。",
          ms: "JOKER: Akaun berjaya didaftarkan.",
          zh_hk: "JOKER: 帳戶註冊成功。",
          id: "JOKER: Akun berhasil didaftarkan.",
        },
        gameAccount: {
          gameID: `${gameAPPID}.${user.gameId}`,
          gamePW: gamePassword,
        },
      });
    } catch (error) {
      console.log("JOKER error fetching balance", error.message);
      return res.status(200).json({
        success: false,
        message: {
          en: "JOKER: Registration failed due to a technical issue. Please try again or contact customer support for assistance.",
          zh: "JOKER: 由于技术问题注册失败。请重试或联系客服寻求帮助。",
          ms: "JOKER: Pendaftaran gagal kerana masalah teknikal. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan.",
          zh_hk: "JOKER: 由於技術問題註冊失敗。請重試或聯絡客服尋求協助。",
          id: "JOKER: Pendaftaran gagal karena masalah teknis. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan.",
        },
      });
    }
  }
);

router.post(
  "/api/joker/getbalance/:userId",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { userId } = req.params;
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

      const balanceResponse = await JokerCheckBalance(user);

      if (!balanceResponse.success) {
        return res.status(200).json({
          success: false,
          message: {
            en: "JOKER: Unable to retrieve player balance. Please try again or contact customer support for assistance.",
            zh: "JOKER: 无法获取玩家余额。请重试或联系客服寻求帮助。",
            ms: "JOKER: Tidak dapat mendapatkan baki pemain. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan.",
            zh_hk: "JOKER: 無法獲取玩家餘額。請重試或聯絡客服尋求協助。",
            id: "JOKER: Tidak dapat mengambil saldo pemain. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan.",
          },
        });
      }

      return res.status(200).json({
        success: true,
        balance: balanceResponse.data.Credit,
        outstanding: balanceResponse.data.OutstandingCredit,
      });
    } catch (error) {
      console.log("JOKER error fetching balance", error.message);
      return res.status(200).json({
        success: false,
        message: {
          en: "JOKER: Unable to retrieve player balance. Please try again or contact customer support for assistance.",
          zh: "JOKER: 无法获取玩家余额。请重试或联系客服寻求帮助。",
          ms: "JOKER: Tidak dapat mendapatkan baki pemain. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan.",
          zh_hk: "JOKER: 無法獲取玩家餘額。請重試或聯絡客服尋求協助。",
          id: "JOKER: Tidak dapat mengambil saldo pemain. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan.",
        },
      });
    }
  }
);

router.post(
  "/api/joker/deposit/:userId",
  authenticateAdminToken,
  async (req, res) => {
    let formattedDepositAmount = 0;
    try {
      const { transferAmount } = req.body;
      formattedDepositAmount = roundToTwoDecimals(transferAmount);

      if (isNaN(formattedDepositAmount) || formattedDepositAmount <= 0) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Deposit amount must be a positive number greater than 0.",
            zh: "存款金额必须为正数且大于0。",
            ms: "Jumlah deposit mestilah nombor positif dan lebih besar daripada 0.",
            zh_hk: "存款金額必須為正數且大於0。",
            id: "Jumlah deposit harus berupa angka positif dan lebih besar dari 0.",
          },
        });
      }

      const { userId } = req.params;
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

      if (!user.jokerGameName) {
        return res.status(200).json({
          success: false,
          message: {
            en: "JOKER: Game account not registered. Please register an account first to proceed.",
            zh: "JOKER: 游戏账户未注册。请先注册账户以继续。",
            ms: "JOKER: Akaun permainan tidak berdaftar. Sila daftar akaun terlebih dahulu untuk meneruskan.",
            zh_hk: "JOKER: 遊戲帳戶未註冊。請先註冊帳戶以繼續。",
            id: "JOKER: Akun permainan belum terdaftar. Silakan daftar akun terlebih dahulu untuk melanjutkan.",
          },
        });
      }

      if (user.gameStatus.joker.transferInStatus) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Transfer is temporarily locked. Please contact customer support for assistance.",
            zh: "转账暂时锁定。请联系客服寻求帮助。",
            ms: "Pemindahan dikunci buat sementara. Sila hubungi sokongan pelanggan untuk bantuan.",
            zh_hk: "轉帳暫時鎖定。請聯絡客服尋求協助。",
            id: "Transfer terkunci sementara. Silakan hubungi dukungan pelanggan untuk bantuan.",
          },
        });
      }

      const depositResponse = await JokerDeposit(user, formattedDepositAmount);

      if (!depositResponse.success) {
        return res.status(200).json({
          success: false,
          message: {
            en: "JOKER: Deposit failed. Please try again or contact customer support for further assistance.",
            zh: "JOKER: 存款失败。请重试或联系客服寻求进一步帮助。",
            ms: "JOKER: Deposit gagal. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan lanjut.",
            zh_hk: "JOKER: 存款失敗。請重試或聯絡客服尋求進一步協助。",
            id: "JOKER: Deposit gagal. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
          },
        });
      }

      await GameWalletLogAttempt(
        user.username,
        "Transfer In",
        "Transfer",
        roundToTwoDecimals(formattedDepositAmount),
        "JOKER",
        roundToTwoDecimals(depositResponse.data.Credit || 0),
        0,
        0
      );

      return res.status(200).json({
        success: true,
        message: {
          en: "JOKER: Deposit completed successfully.",
          zh: "JOKER: 存款成功完成。",
          ms: "JOKER: Deposit berjaya diselesaikan.",
          zh_hk: "JOKER: 存款成功完成。",
          id: "JOKER: Deposit berhasil diselesaikan.",
        },
      });
    } catch (error) {
      console.log("JOKER error deposit", error.message);
      return res.status(200).json({
        success: false,
        message: {
          en: "JOKER: Deposit failed. Please try again or contact customer support for further assistance.",
          zh: "JOKER: 存款失败。请重试或联系客服寻求进一步帮助。",
          ms: "JOKER: Deposit gagal. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan lanjut.",
          zh_hk: "JOKER: 存款失敗。請重試或聯絡客服尋求進一步協助。",
          id: "JOKER: Deposit gagal. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
        },
      });
    }
  }
);

router.post(
  "/api/joker/withdraw/:userId",
  authenticateAdminToken,
  async (req, res) => {
    let formattedWithdrawAmount = 0;
    try {
      const { transferAmount } = req.body;
      formattedWithdrawAmount = roundToTwoDecimals(transferAmount);

      if (isNaN(formattedWithdrawAmount) || formattedWithdrawAmount <= 0) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Withdrawal amount must be a positive number greater than 0.",
            zh: "提款金额必须为正数且大于0。",
            ms: "Jumlah pengeluaran mestilah nombor positif dan lebih besar daripada 0.",
            zh_hk: "提款金額必須為正數且大於0。",
            id: "Jumlah penarikan harus berupa angka positif dan lebih besar dari 0.",
          },
        });
      }

      const { userId } = req.params;
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

      if (!user.jokerGameName) {
        return res.status(200).json({
          success: false,
          message: {
            en: "JOKER: Game account not registered. Please register an account first to proceed.",
            zh: "JOKER: 游戏账户未注册。请先注册账户以继续。",
            ms: "JOKER: Akaun permainan tidak berdaftar. Sila daftar akaun terlebih dahulu untuk meneruskan.",
            zh_hk: "JOKER: 遊戲帳戶未註冊。請先註冊帳戶以繼續。",
            id: "JOKER: Akun permainan belum terdaftar. Silakan daftar akun terlebih dahulu untuk melanjutkan.",
          },
        });
      }

      if (user.gameStatus.joker.transferOutStatus) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Transfer is temporarily locked. Please contact customer support for assistance.",
            zh: "转账暂时锁定。请联系客服寻求帮助。",
            ms: "Pemindahan dikunci buat sementara. Sila hubungi sokongan pelanggan untuk bantuan.",
            zh_hk: "轉帳暫時鎖定。請聯絡客服尋求協助。",
            id: "Transfer terkunci sementara. Silakan hubungi dukungan pelanggan untuk bantuan.",
          },
        });
      }

      const withdrawResponse = await JokerWithdraw(
        user,
        formattedWithdrawAmount
      );

      if (!withdrawResponse.success) {
        return res.status(200).json({
          success: false,
          message: {
            en: "JOKER: Withdrawal failed. Please try again or contact customer support for further assistance.",
            zh: "JOKER: 提款失败。请重试或联系客服寻求进一步帮助。",
            ms: "JOKER: Pengeluaran gagal. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan lanjut.",
            zh_hk: "JOKER: 提款失敗。請重試或聯絡客服尋求進一步協助。",
            id: "JOKER: Penarikan gagal. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
          },
        });
      }

      await GameWalletLogAttempt(
        user.username,
        "Transfer Out",
        "Transfer",
        roundToTwoDecimals(formattedWithdrawAmount),
        "JOKER",
        roundToTwoDecimals(withdrawResponse.data.Credit || 0),
        0,
        0
      );

      return res.status(200).json({
        success: true,
        message: {
          en: "JOKER: Withdrawal completed successfully.",
          zh: "JOKER: 提款成功完成。",
          ms: "JOKER: Pengeluaran berjaya diselesaikan.",
          zh_hk: "JOKER: 提款成功完成。",
          id: "JOKER: Penarikan berhasil diselesaikan.",
        },
      });
    } catch (error) {
      console.log("JOKER error deposit", error.message);
      return res.status(200).json({
        success: false,
        message: {
          en: "JOKER: Withdrawal failed. Please try again or contact customer support for further assistance.",
          zh: "JOKER: 提款失败。请重试或联系客服寻求进一步帮助。",
          ms: "JOKER: Pengeluaran gagal. Sila cuba lagi atau hubungi sokongan pelanggan untuk bantuan lanjut.",
          zh_hk: "JOKER: 提款失敗。請重試或聯絡客服尋求進一步協助。",
          id: "JOKER: Penarikan gagal. Silakan coba lagi atau hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
        },
      });
    }
  }
);

module.exports = router;
module.exports.registerJokerUser = registerJokerUser;
module.exports.JokerCheckBalance = JokerCheckBalance;
