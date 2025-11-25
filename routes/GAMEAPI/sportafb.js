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
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const qs = require("querystring");
const GameWalletLog = require("../../models/gamewalletlog.model");
const SportAFB1188Modal = require("../../models/sports_Afb1188.model");
require("dotenv").config();

const afb1188Key = process.env.AFB1188_SECRET;
const webURL = "https://www.ezwin9.com/";
const afb1188APIURL = "https://api.afb1188.net";
const afb1188AgentName = "ezwin9";

function generateRandomText(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
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

// router.post("/api/afb1188/getbetsdetails", async (req, res) => {
//   try {
//     const start = moment.utc().startOf("days").format("YYYY-MM-DD HH:mm:ss");
//     const end = moment.utc().endOf("days").format("YYYY-MM-DD HH:mm:ss");

//     console.log(start, end);

//     const tokenRequestData = {
//       companyKey: afb1188Key,
//       Act: "RP_GET_CUSTOMER",
//       portfolio: "sportsbook",
//       startDate: start,
//       endDate: end,
//       lang: "EN-US",
//       AgentName: afb1188AgentName,
//     };

//     const tokenResponse = await axios.post(
//       `${afb1188APIURL}/Public/InnoExcData.ashx`,
//       tokenRequestData,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     if (tokenResponse.data.error !== "0") {
//       throw new Error(`Token generation failed: ${tokenResponse.data.error}`);
//     }

//     return res.status(200).json({
//       success: true,
//       data: tokenResponse.data,
//     });
//   } catch (error) {
//     console.log("AFB1188 Token Error:", error.message);
//     return {
//       success: false,
//       error: error.message,
//     };
//   }
// });

async function getAFB1188Token(user) {
  try {
    const tokenRequestData = {
      companyKey: afb1188Key,
      userName: user.gameId,
      currencyName: "HKD",
    };

    const tokenResponse = await axios.post(
      `${afb1188APIURL}/Public/ckAcc.ashx`,
      tokenRequestData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (tokenResponse.data.error !== "0") {
      throw new Error(`Token generation failed: ${tokenResponse.data.error}`);
    }

    return {
      success: true,
      token: tokenResponse.data.token,
      username: tokenResponse.data.username,
      serverId: tokenResponse.data.serverId,
    };
  } catch (error) {
    console.log("AFB1188 Token Error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

router.post("/api/afb1188/launchGame", authenticateToken, async (req, res) => {
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

    if (user.gameLock.afb1188.lock) {
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

    const generatedtoken = await getAFB1188Token(user);

    if (!generatedtoken.success) {
      console.log("AFB1188 error to launch game", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "AFB1188: Game launch failed. Please try again or customer service for assistance.",
          zh: "AFB1188: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "AFB1188: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "AFB1188: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "AFB1188: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    let lang = "EN-CA";

    if (gameLang === "en") {
      lang = "EN-US";
    } else if (gameLang === "zh") {
      lang = "ZH-CN";
    } else if (gameLang === "ms") {
      lang = "EN-AU";
    } else if (gameLang === "id") {
      lang = "EN-AU";
    } else if (gameLang === "zh_hk") {
      lang = "EN-CA";
    }

    let platform = "d";
    if (clientPlatform === "web") {
      platform = "d";
    } else if (clientPlatform === "mobile") {
      platform = "m";
    }

    const loginParams = new URLSearchParams({
      us: user.gameId,
      k: generatedtoken.token,
      device: platform,
      oddsstyle: "HK",
      oddsmode: "Double",
      lang: lang,
      currencyName: "HKD",
      sk: "WO",
      ismmy: "0",
      IsHideChipSet: "0",
      print_txt: "EZWIN9",
      Callbackurl: webURL,
    });

    const gameUrl = `${afb1188APIURL}/Public/validate.aspx?${loginParams.toString()}`;

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "AFB1188"
    );

    return res.status(200).json({
      success: true,
      gameLobby: gameUrl,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("AFB1188 error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "AFB1188: Game launch failed. Please try again or customer service for assistance.",
        zh: "AFB1188: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "AFB1188: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "AFB1188: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "AFB1188: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/afb1188/getbalance", async (req, res) => {
  try {
    const { userName, companyKey } = req.body;

    if (companyKey !== afb1188Key) {
      return res.status(200).json({
        balance: 0,
        errorCode: 1,
        errorMessage: "Invalid Key.",
      });
    }

    const currentUser = await User.findOne(
      { gameId: userName },
      { wallet: 1 }
    ).lean();

    if (!currentUser) {
      return res.status(200).json({
        balance: 0,
        errorCode: 2,
        errorMessage: "Invalid Username.",
      });
    }

    return res.status(200).json({
      balance: roundToTwoDecimals(currentUser.wallet),
      errorCode: 0,
      errorMessage: "",
    });
  } catch (error) {
    console.log("afb1188 calbac url error", error.message);
    return res.status(200).json({
      balance: 0,
      errorCode: 1,
      errorMessage: "Server Error.",
    });
  }
});

router.post("/api/afb1188/bet", async (req, res) => {
  try {
    const { companyKey, userName, amount, transferCode, id } = req.body;

    if (companyKey !== afb1188Key) {
      return res.status(200).json({
        errorMessage: "Invalid Key.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "1",
      });
    }

    const [existingBet, currentUser] = await Promise.all([
      SportAFB1188Modal.findOne({ betId: id }, { _id: 1 }).lean(),
      User.findOne(
        { gameId: userName },
        { username: 1, wallet: 1, gameLock: 1, _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        errorMessage: "Invalid Username.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "2",
      });
    }

    if (existingBet) {
      return res.status(200).json({
        errorMessage: "OK",
        betAmount: amount,
        balance: roundToTwoDecimals(currentUser.wallet),
        accountName: userName,
        errorCode: "0",
      });
    }

    if (currentUser.gameLock?.afb1188?.lock) {
      return res.status(200).json({
        errorMessage: "Player Banned.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "1",
      });
    }

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: roundToTwoDecimals(amount) },
      },
      { $inc: { wallet: -roundToTwoDecimals(amount) } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        errorMessage: "Insufficient Balance.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "1",
      });
    }

    await SportAFB1188Modal.create({
      username: userName,
      betId: id,
      bet: true,
      betamount: roundToTwoDecimals(amount),
      tranId: transferCode,
    });

    return res.status(200).json({
      errorMessage: "OK",
      betAmount: amount,
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      accountName: userName,
      errorCode: "0",
    });
  } catch (error) {
    console.error("AFB1188 Balance API Error:", error);
    return res.status(200).json({
      errorMessage: "Server Error.",
      balance: 0,
      accountName: "",
      betAmount: 0,
      errorCode: "1",
    });
  }
});

router.post("/api/afb1188/settle", async (req, res) => {
  try {
    const {
      companyKey,
      userName,
      winlose,
      transferCode,
      resultType,
      ValidAmt,
      res: matchResult,
      SendResultNum,
    } = req.body;

    if (companyKey !== afb1188Key) {
      return res.status(200).json({
        errorMessage: "Invalid Key.",
        balance: 0,
        errorCode: "1",
      });
    }

    const [currentUser, existingBet] = await Promise.all([
      User.findOne({ gameId: userName }, { _id: 1, wallet: 1 }).lean(),
      SportAFB1188Modal.findOne({ tranId: transferCode }).lean(),
    ]);

    if (!currentUser) {
      console.log("User not found:", userName);
      return res.status(200).json({
        errorMessage: "Invalid Username.",
        balance: 0,
        errorCode: "2",
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        errorMessage: "No Bet Found.",
        balance: 0,
        errorCode: "1",
      });
    }

    if (existingBet.settle && existingBet.matchstats === matchResult) {
      return res.status(200).json({
        errorMessage: "OK",
        balance: roundToTwoDecimals(currentUser.wallet),
        errorCode: "0",
      });
    }

    let balanceUpdate = 0;

    const winAmount = parseFloat(winlose) || 0;
    const validAmount = parseFloat(ValidAmt) || 0;
    const originalBetAmount = existingBet.betamount || 0;
    const sendResultNum = parseInt(SendResultNum) || 0;

    const isFirstSettlementAfterCancel =
      existingBet.cancel && !existingBet.cancelSettled;

    if (isFirstSettlementAfterCancel && sendResultNum > 0) {
      balanceUpdate = originalBetAmount + winAmount;
    } else if (sendResultNum > 0) {
      const previousSettlement = existingBet.lastWinlose || 0;
      balanceUpdate = previousSettlement + winAmount;
    } else {
      balanceUpdate = existingBet.betamount + winAmount;
    }

    const finalUpdateAmount = roundToTwoDecimals(balanceUpdate);

    const [updatedUserBalance, _] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: userName },
        { $inc: { wallet: finalUpdateAmount } },
        { new: true, lean: true, projection: { wallet: 1 } }
      ).lean(),

      SportAFB1188Modal.findOneAndUpdate(
        { tranId: transferCode },
        {
          $set: {
            settleId: transferCode,
            settle: true,
            settleamount: roundToTwoDecimals(finalUpdateAmount),
            lastWinlose: -winAmount,
            matchstats: matchResult,
            status: req.body.status || "A",
            cancelSettled: existingBet.cancel
              ? true
              : existingBet.cancelSettled,
          },
        },
        { new: true }
      ),
    ]);

    return res.status(200).json({
      errorMessage: "OK",
      balance: parseFloat(roundToTwoDecimals(updatedUserBalance.wallet)),
      errorCode: "0",
    });
  } catch (error) {
    console.error("AFB1188 Balance API Error:", error);
    return res.status(200).json({
      errorMessage: "Server Error.",
      balance: 0,
      errorCode: "1",
    });
  }
});
router.post("/api/afb1188/cancel", async (req, res) => {
  try {
    const { companyKey, userName, cancelType, transferCode } = req.body;

    if (companyKey !== afb1188Key) {
      return res.status(200).json({
        errorMessage: "Invalid Key.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "1",
      });
    }

    const [currentUser, existingBet, existingCancelbet] = await Promise.all([
      User.findOne({ gameId: userName }, { _id: 1, wallet: 1 }).lean(),
      SportAFB1188Modal.findOne(
        { tranId: transferCode },
        { _id: 1, lastWinlose: 1, settleamount: 1 }
      ).lean(),
      SportAFB1188Modal.findOne(
        { tranId: transferCode, cancelroute: true },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      console.log("User not found:", SourceName);
      return res.status(200).json({
        errorMessage: "Invalid Username.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "2",
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        errorMessage: "No Bet Found.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "1",
      });
    }

    if (existingCancelbet) {
      return res.status(200).json({
        errorMessage: "OK",
        betAmount: existingBet.betamount,
        balance: roundToTwoDecimals(currentUser.wallet),
        accountName: userName,
        errorCode: "0",
      });
    }

    let updateAmount = 0;

    if (cancelType === "betRefusted") {
      updateAmount = roundToTwoDecimals(existingBet.lastWinlose);
    } else if (cancelType === "resultRefusted") {
      updateAmount = -roundToTwoDecimals(existingBet.settleamount);
    }
    console.log("updateAmount", updateAmount);
    const [updatedUserBalance] = await Promise.all([
      User.findOneAndUpdate(
        { _id: currentUser._id },
        { $inc: { wallet: updateAmount } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      SportAFB1188Modal.findOneAndUpdate(
        { tranId: transferCode },
        { $set: { cancelroute: true, cancelId: transferCode } }
      ),
    ]);

    return res.status(200).json({
      errorMessage: "OK",
      betAmount: existingBet.betamount,
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      accountName: userName,
      errorCode: "0",
    });
  } catch (error) {
    console.error("AFB1188 Balance API Error:", error);
    return res.status(200).json({
      errorMessage: "Server Error.",
      balance: 0,
      accountName: "",
      betAmount: 0,
      errorCode: "1",
    });
  }
});

router.post("/api/afb1188/dangerousbet", async (req, res) => {
  try {
    const { companyKey, MbName, transferCode, status } = req.body;

    if (companyKey !== afb1188Key) {
      return res.status(200).json({
        errorCode: "1",
        balance: 0,
        errorMessage: "Invalid Key.",
      });
    }

    const [currentUser] = await Promise.all([
      User.findOne({ gameId: MbName }, { _id: 1, wallet: 1 }).lean(),
    ]);

    if (!currentUser) {
      console.log("User not found:", SourceName);
      return res.status(200).json({
        errorCode: "1",
        balance: 0,
        errorMessage: "Member does not exist",
      });
    }

    const [] = await Promise.all([
      SportAFB1188Modal.findOneAndUpdate(
        { tranId: transferCode },
        { $set: { dangerous: true, status: status } }
      ),
    ]);

    return res.status(200).json({
      errorCode: "0",
      balance: roundToTwoDecimals(currentUser.wallet),
      errorMessage: "OK",
    });
  } catch (error) {
    console.error("AFB1188 Balance API Error:", error);
    return res.status(200).json({
      errorMessage: "Server Error.",
      balance: 0,
      errorCode: "1",
    });
  }
});

router.post("/api/afb1188/rollback", async (req, res) => {
  try {
    const { companyKey, userName, amount, transferCode, id } = req.body;

    if (companyKey !== afb1188Key) {
      return res.status(200).json({
        errorMessage: "Invalid Key.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "1",
      });
    }

    const [currentUser, existingBet, existingCancelbet] = await Promise.all([
      User.findOne({ gameId: userName }, { _id: 1, wallet: 1 }).lean(),
      SportAFB1188Modal.findOne(
        { tranId: transferCode },
        {
          _id: 1,
          betamount: 1,
          settleamount: 1,
          settled: 1,
          matchStats: 1,
          cancelled: 1,
        }
      ).lean(),
      SportAFB1188Modal.findOne(
        { tranId: transferCode, cancel: true },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        errorMessage: "Invalid Username.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "2",
      });
    }

    if (!existingBet) {
      return res.status(200).json({
        errorMessage: "No Bet Found.",
        balance: 0,
        accountName: "",
        betAmount: 0,
        errorCode: "1",
      });
    }

    if (existingCancelbet) {
      return res.status(200).json({
        errorMessage: "OK",
        betAmount: existingBet.betamount,
        balance: roundToTwoDecimals(currentUser.wallet),
        accountName: userName,
        errorCode: "0",
      });
    }

    // Calculate rollback amount
    const toupdateamt = existingBet.betamount + existingBet.settleamount;

    const [updatedUserBalance, updatedBet] = await Promise.all([
      User.findOneAndUpdate(
        { gameId: userName },
        { $inc: { wallet: -roundToTwoDecimals(toupdateamt) } },
        { new: true, lean: true, projection: { wallet: 1 } }
      ).lean(),

      SportAFB1188Modal.findOneAndUpdate(
        { tranId: transferCode },
        { $set: { cancel: true, cancelId: transferCode } },
        { new: true }
      ),
    ]);

    return res.status(200).json({
      errorMessage: "OK",
      betAmount: existingBet.betamount,
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      accountName: userName,
      errorCode: "0",
    });
  } catch (error) {
    console.error("=== AFB1188 ROLLBACK ERROR ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error.stack);

    return res.status(200).json({
      errorMessage: "Server Error.",
      balance: 0,
      accountName: "",
      betAmount: 0,
      errorCode: "1",
    });
  }
});

router.post("/api/afb1188/getturnoverforrebate", async (req, res) => {
  try {
    const { date } = req.body;

    let startDate, endDate;
    if (date === "today") {
      startDate = moment.utc().add(8, "hours").startOf("day").toDate();
      endDate = moment.utc().add(8, "hours").endOf("day").toDate();
    } else if (date === "yesterday") {
      startDate = moment
        .utc()
        .add(8, "hours")
        .subtract(1, "days")
        .startOf("day")
        .toDate();

      endDate = moment
        .utc()
        .add(8, "hours")
        .subtract(1, "days")
        .endOf("day")
        .toDate();
    }

    console.log("AFB1188 Sports QUERYING TIME", startDate, endDate);

    const requestData = {
      companyKey: afb1188Key,
      Act: "RP_GET_CUSTOMER_TRANSDATE",
      portfolio: "sportsbook",
      startDate: startDate,
      endDate: endDate,
      lang: "EN-US",
      AgentName: afb1188AgentName,
      currencyName: "HKD",
    };

    const response = await axios.post(
      `${afb1188APIURL}/Public/InnoExcData.ashx`,
      requestData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.error !== "0") {
      throw new Error(`BET Record generation failed: ${response.data.error}`);
    }

    const records = response.data.playerBetList || [];
    const uniqueGameIds = [...new Set(records.map((record) => record.u))];

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
      const gameId = record.u;
      const actualUsername = gameIdToUsername[gameId];

      if (!actualUsername) {
        console.warn(`AFB1188 Sports User not found for gameId: ${gameId}`);
        return;
      }

      if (!playerSummary[actualUsername]) {
        playerSummary[actualUsername] = { turnover: 0, winloss: 0 };
      }

      playerSummary[actualUsername].turnover += parseFloat(record.b) || 0;

      playerSummary[actualUsername].winloss = 0;
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
        gamename: "AFB1188",
        gamecategory: "Sports",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("AFB1188: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "AFB1188: Failed to fetch win/loss report",
        zh: "AFB1188: 获取盈亏报告失败",
      },
    });
  }
});

router.get(
  "/admin/api/afb1188/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SportAFB1188Modal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancelroute: { $ne: true },
      });

      // Aggregate turnover and win/loss for each player
      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;
        totalWinLoss += -(record.lastWinlose || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));
      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "AFB1188",
          gamecategory: "Sports",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("AFB1188: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "AFB1188: Failed to fetch win/loss report",
          zh: "AFB1188: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/afb1188/:userId/gamedata",
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
          gameCategories["Sports"] &&
          gameCategories["Sports"] instanceof Map
        ) {
          const slotGames = Object.fromEntries(gameCategories["Sports"]);

          if (slotGames["AFB1188"]) {
            totalTurnover += slotGames["AFB1188"].turnover || 0;
            totalWinLoss += slotGames["AFB1188"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "AFB1188",
          gamecategory: "Sports",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("AFB1188: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        success: false,
        message: {
          en: "AFB1188: Failed to fetch win/loss report",
          zh: "AFB1188: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/afb1188/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SportAFB1188Modal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
        cancelroute: { $ne: true },
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss += record.lastWinlose || 0;
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "AFB1188",
          gamecategory: "Sports",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("AFB1188: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "AFB1188: Failed to fetch win/loss report",
          zh: "AFB1188: 获取盈亏报告失败",
        },
      });
    }
  }
);

router.get(
  "/admin/api/afb1188/kioskreport",
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
          const liveCasino = Object.fromEntries(gameCategories["Sports"]);

          if (liveCasino["AFB1188"]) {
            totalTurnover += Number(liveCasino["AFB1188"].turnover || 0);
            totalWinLoss += Number(liveCasino["AFB1188"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "AFB1188",
          gamecategory: "Sports",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("AFB1188: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "AFB1188: Failed to fetch win/loss report",
          zh: "AFB1188: 获取盈亏报告失败",
        },
      });
    }
  }
);

module.exports = router;
