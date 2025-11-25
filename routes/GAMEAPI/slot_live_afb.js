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
const Decimal = require("decimal.js");
const LiveAFBModal = require("../../models/live_afb.model");

require("dotenv").config();

const webURL = "https://www.ezwin9.com/";
const afbAPIURL = "https://wfapi.gm10066.com/afbapiwflive/app/api.do";
const afbSecret = process.env.AFB_LIVE_SECRET;
const afbSiteCode = "ezwin9";

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

function generateSignature(params, secretKey) {
  // Remove null/undefined/empty values
  const filtered = Object.entries(params).filter(
    ([_, v]) => v !== undefined && v !== ""
  );

  const sorted = filtered.sort(([a], [b]) => a.localeCompare(b));

  const paramString = sorted.map(([k, v]) => `${k}=${v}`).join("&");

  const finalString = `${paramString}&key=${secretKey}`;
  console.log(finalString);
  return crypto.createHash("md5").update(finalString).digest("hex");
}

router.post("/api/afb/testturnover", async (req, res) => {
  try {
    const requestData = {
      hashCode: afbSecret,
      command: "GET_RECORD_BY_SEQUENCENO",
      params: {
        count: "1000",
        beginId: "33",
      },
    };
    const response = await axios.post(afbAPIURL, requestData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log(response.data);
    if (response.data.errorCode !== 0) {
      if (response.data.errorCode === 6999) {
        console.log("AFB LIVE maintenance");
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
      console.log(`AFB LIVE error in launching: ${response.data}`);
      return res.status(200).json({
        success: false,
        message: {
          en: "AFB: Game launch failed. Please try again or customer service for assistance.",
          zh: "AFB: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "AFB: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "AFB: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "AFB: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      gameLobby: response.data,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("AFB error in launching game", error.message);

    return res.status(200).json({
      success: false,
      message: {
        en: "AFB: Game launch failed. Please try again or customer service for assistance.",
        zh: "AFB: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "AFB: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "AFB: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "AFB: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/afb/launchGame", authenticateToken, async (req, res) => {
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

    if (user.gameLock.afb.lock) {
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

    let lang = "HK";

    if (gameLang === "en") {
      lang = "EN";
    } else if (gameLang === "zh") {
      lang = "CN";
    } else if (gameLang === "zh_hk") {
      lang = "HK";
    } else if (gameLang === "ms") {
      lang = "EN";
    } else if (gameLang === "id") {
      lang = "EN";
    }

    let platform = 0;
    let afbGameType = "PC";
    if (clientPlatform === "web") {
      platform = 0;
      afbGameType = "PC";
    } else if (clientPlatform === "mobile") {
      platform = 1;
      afbGameType = "MP";
    }

    const passwordHash = crypto
      .createHash("md5")
      .update(user.gameId)
      .digest("hex")
      .padStart(32, "0");

    const requestData = {
      hashCode: afbSecret,
      command: "LOGIN",
      params: {
        username: user.gameId,
        password: passwordHash,
        currency: "HKD",
        nickname: user.username.substring(0, 20),
        language: lang,
        curHomeUrl: webURL,
        liveLotteryType: afbGameType,
        mob: platform,
        userCode: user.gameId,
        betLimitList: ["CHKD", "DHKD"],
      },
    };
    const response = await axios.post(afbAPIURL, requestData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log(response.data);
    if (response.data.errorCode !== 0) {
      if (response.data.errorCode === 6999) {
        console.log("AFB LIVE maintenance");
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
      console.log(`AFB LIVE error in launching: ${response.data}`);
      return res.status(200).json({
        success: false,
        message: {
          en: "AFB: Game launch failed. Please try again or customer service for assistance.",
          zh: "AFB: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "AFB: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "AFB: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "AFB: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "AFB LIVE"
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.params.link,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("AFB error in launching game", error.message);

    return res.status(200).json({
      success: false,
      message: {
        en: "AFB: Game launch failed. Please try again or customer service for assistance.",
        zh: "AFB: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "AFB: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "AFB: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "AFB: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.post("/api/afb/playerBalance", async (req, res) => {
  try {
    const { siteCode, userCode } = req.body;
    if (!siteCode || !userCode) {
      return res.status(200).json({
        returnCode: 1,
      });
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json({
        returnCode: 2,
      });
    }

    const currentUser = await User.findOne(
      { gameId: userCode },
      { wallet: 1 }
    ).lean();

    if (!currentUser) {
      return res.status(200).json({
        returnCode: 3,
      });
    }

    return res.status(200).json({
      returnCode: 0,
      userCode: userCode,
      balance: roundToTwoDecimals(currentUser.wallet),
      balanceAfter: roundToTwoDecimals(currentUser.wallet),
      walletTime: Date.now(),
    });
  } catch (error) {
    console.error(
      "AFB LIVE: Error in game provider calling ae96 get balance api:",
      error.message
    );
    return res.status(200).json({
      returnCode: 999,
    });
  }
});

router.post("/api/afb/bet", async (req, res) => {
  try {
    const { siteCode, userCode, gameId, gameType, betId, betAmount } = req.body;
    if (
      !siteCode ||
      !userCode ||
      !gameId ||
      !betId ||
      betAmount === undefined ||
      betAmount === null
    ) {
      return res.status(200).json({
        returnCode: 1,
      });
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json({
        returnCode: 2,
      });
    }

    const [currentUser, existingBet, existingTransaction] = await Promise.all([
      User.findOne(
        { gameId: userCode },
        { _id: 1, wallet: 1, "gameLock.afb.lock": 1 }
      ).lean(),
      LiveAFBModal.findOne({ betId: betId }, { _id: 1 }).lean(),
      LiveAFBModal.findOne(
        { betId: betId, $or: [{ settle: true }, { cancel: true }] },
        { _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        returnCode: 3,
      });
    }

    if (currentUser.gameLock?.afb?.lock) {
      return res.status(200).json({
        returnCode: 4,
      });
    }

    if (existingBet || existingTransaction) {
      return res.status(200).json({
        returnCode: 10,
      });
    }

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: roundToTwoDecimals(betAmount) },
      },
      { $inc: { wallet: -roundToTwoDecimals(betAmount) } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        returnCode: 5,
      });
    }

    await LiveAFBModal.create({
      username: userCode,
      betId: betId,
      bet: true,
      tranId: gameId,
      betamount: roundToTwoDecimals(betAmount),
    });

    return res.status(200).json({
      returnCode: 0,
      userCode: userCode,
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      balanceAfter: roundToTwoDecimals(updatedUserBalance.wallet),
      walletTime: Date.now(),
    });
  } catch (error) {
    console.error(
      "AFB: Error in game provider calling pw66 getbalance api:",
      error.message
    );
    return res.status(200).json({
      returnCode: 999,
    });
  }
});

router.post("/api/afb/cancelBet", async (req, res) => {
  try {
    const { siteCode, userCode, gameId, gameType, betId, betAmount } = req.body;
    if (
      !siteCode ||
      !userCode ||
      !gameId ||
      !betId ||
      betAmount === undefined ||
      betAmount === null
    ) {
      return res.status(200).json({
        returnCode: 1,
      });
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json({
        returnCode: 2,
      });
    }

    const [currentUser, existingBet] = await Promise.all([
      User.findOne({ gameId: userCode }, { wallet: 1, _id: 1 }).lean(),
      LiveAFBModal.findOne({
        betStatus: 1,
        betamount: 1,
        cancel: 1,
        settle: 1,
        _id: 1,
      }).lean(),
    ]);
    if (!currentUser) {
      return res.status(200).json({
        returnCode: 3,
      });
    }

    if (!existingBet) {
      await LiveAFBModal.create({
        username: userCode,
        betId: betId,
        bet: true,
        cancel: true,
        betStatus: "CANCELLED",
        betamount: roundToTwoDecimals(betAmount),
      });

      return res.status(200).json({
        returnCode: 0,
        userCode: userCode,
        balance: roundToTwoDecimals(currentUser.wallet),
        balanceAfter: roundToTwoDecimals(currentUser.wallet),
        walletTime: Date.now(),
      });
    }

    if (existingBet.betStatus === "REVOKED") {
      console.log(`Bet ${betId} already revoked for user ${userCode}`);

      return res.status(200).json({
        returnCode: 0,
        userCode: userCode,
        balance: roundToTwoDecimals(currentUser.wallet),
        balanceAfter: roundToTwoDecimals(currentUser.wallet),
        walletTime: Date.now(),
      });
    }

    if (existingBet.cancel === true || existingBet.settle === true) {
      return res.status(200).json({
        returnCode: 0,
        userCode: userCode,
        balance: roundToTwoDecimals(currentUser.wallet),
        balanceAfter: roundToTwoDecimals(currentUser.wallet),
        walletTime: Date.now(),
      });
    }

    const [updatedUserBalance] = await Promise.all([
      User.findByIdAndUpdate(
        currentUser._id,
        { $inc: { wallet: roundToTwoDecimals(betAmount) } },
        { new: true, projection: { wallet: 1 } }
      ).lean(),

      LiveAFBModal.findOneAndUpdate(
        { betId: betId },
        {
          $set: {
            cancel: true,
            ...(existingBet &&
              existingBet.betStatus === "INVALID" && { betStatus: "REVOKED" }),
          },
        },
        { upsert: true, new: true }
      ),
    ]);

    return res.status(200).json({
      returnCode: 0,
      userCode: userCode,
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      balanceAfter: roundToTwoDecimals(updatedUserBalance.wallet),
      walletTime: Date.now(),
    });
  } catch (error) {
    console.error(
      "AFB: Error in game provider calling ae96 get rollback api:",
      error.message
    );
    return res.status(200).json({
      returnCode: 999,
    });
  }
});

router.post("/api/afb/winLoss", async (req, res) => {
  try {
    const { siteCode, winLossList, gameId, gameType } = req.body;
    if (!siteCode || !gameId || !gameType) {
      return res.status(200).json([
        {
          returnCode: 1,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json([
        {
          returnCode: 2,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    const results = [];

    for (const winLossEntry of winLossList) {
      try {
        const {
          uuid,
          winLossId,
          userCode,
          modifyBalance,
          modifyBalanceAfter,
          validBetIdList,
          invalidBetIdList,
        } = winLossEntry;

        if (
          !uuid ||
          !userCode ||
          modifyBalance === null ||
          modifyBalance === undefined
        ) {
          results.push({
            returnCode: 1,
            userCode: userCode || "",
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        const [currentUser, existingUUID] = await Promise.all([
          User.findOne({ gameId: userCode }, { wallet: 1, _id: 1 }).lean(),
          LiveAFBModal.findOne({ uuid: uuid }, { _id: 1 }).lean(),
        ]);

        if (!currentUser) {
          results.push({
            returnCode: 3,
            userCode,
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        if (existingUUID) {
          console.log(`bets already settled for user ${userCode}`);
          results.push({
            returnCode: 0,
            userCode,
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        let existingBets = [];

        if (validBetIdList && validBetIdList.length > 0) {
          [existingBets] = await Promise.all([
            LiveAFBModal.find(
              {
                betId: { $in: validBetIdList },
                username: userCode,
              },
              { betId: 1, _id: 1 }
            ).lean(),
          ]);
        }

        if (
          validBetIdList &&
          validBetIdList.length > 0 &&
          existingBets.length === 0
        ) {
          console.warn(
            `No bets found for user ${userCode} with betIds:`,
            validBetIdList
          );

          results.push({
            returnCode: 5,
            userCode: userCode || "",
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        if (invalidBetIdList && invalidBetIdList.length > 0) {
          updatePromises.push(
            LiveAFBModal.updateMany(
              {
                betId: { $in: invalidBetIdList },
                username: userCode,
                betStatus: { $ne: "REVOKED" },
              },
              {
                $set: {
                  betStatus: "INVALID",
                  uuid: uuid,
                },
              }
            )
          );
        }

        const [updatedUserBalance] = await Promise.all([
          User.findByIdAndUpdate(
            currentUser._id,
            { $inc: { wallet: roundToTwoDecimals(modifyBalance || 0) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          LiveAFBModal.updateMany(
            {
              betId: { $in: validBetIdList },
              username: userCode,
            },
            [
              {
                $set: {
                  settle: true,
                  settleamount: {
                    $cond: {
                      if: { $eq: ["$betId", validBetIdList[0]] }, // If this is the first betId
                      then: roundToTwoDecimals(modifyBalance || 0), // Give full amount
                      else: 0, // Give 0
                    },
                  },
                  winLossId: winLossId,
                  uuid: uuid,
                  betStatus: "SETTLED",
                },
              },
            ]
          ),
        ]);

        results.push({
          returnCode: 0,
          userCode,
          balance: roundToTwoDecimals(updatedUserBalance.wallet),
          balanceAfter: roundToTwoDecimals(updatedUserBalance.wallet),
          walletTime: Date.now(),
        });
      } catch (entryError) {
        console.error(
          `Error processing winLoss entry for user ${winLossEntry.userCode}:`,
          entryError
        );
        results.push({
          returnCode: 1,
          userCode: winLossEntry.userCode || "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        });
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error(
      "AFB: Error in game provider calling ae96 get rollback api:",
      error.message
    );
    return res.status(200).json([
      {
        returnCode: 999,
        userCode: "",
        balance: 0,
        balanceAfter: 0,
        walletTime: Date.now(),
      },
    ]);
  }
});

router.post("/api/afb/winLossRepeat", async (req, res) => {
  try {
    const { siteCode, winLossList, gameId, gameType } = req.body;
    if (!siteCode || !gameId || !gameType) {
      return res.status(200).json([
        {
          returnCode: 1,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json([
        {
          returnCode: 2,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    const results = [];

    for (const winLossEntry of winLossList) {
      try {
        const {
          uuid,
          winLossId,
          userCode,
          modifyBalance,
          modifyBalanceAfter,
          validBetIdList,
          invalidBetIdList,
        } = winLossEntry;

        if (
          !uuid ||
          !userCode ||
          modifyBalance === null ||
          modifyBalance === undefined
        ) {
          results.push({
            returnCode: 1,
            userCode: userCode || "",
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        const [currentUser, existingUUID] = await Promise.all([
          User.findOne({ gameId: userCode }, { wallet: 1, _id: 1 }).lean(),
          LiveAFBModal.findOne({ uuid: uuid }, { _id: 1 }).lean(),
        ]);

        if (!currentUser) {
          results.push({
            returnCode: 3,
            userCode,
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        if (existingUUID) {
          console.log(`bets already settled for user ${userCode}`);
          results.push({
            returnCode: 0,
            userCode,
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        let existingBets = [];

        if (validBetIdList && validBetIdList.length > 0) {
          [existingBets] = await Promise.all([
            LiveAFBModal.find(
              {
                betId: { $in: validBetIdList },
                username: userCode,
              },
              { betId: 1, _id: 1 }
            ).lean(),
          ]);
        }

        if (
          validBetIdList &&
          validBetIdList.length > 0 &&
          existingBets.length === 0
        ) {
          console.warn(
            `No bets found for user ${userCode} with betIds:`,
            validBetIdList
          );

          results.push({
            returnCode: 5,
            userCode: userCode || "",
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        const [updatedUserBalance] = await Promise.all([
          User.findByIdAndUpdate(
            currentUser._id,
            { $inc: { wallet: roundToTwoDecimals(modifyBalance || 0) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          LiveAFBModal.updateMany(
            {
              betId: { $in: validBetIdList },
              username: userCode,
            },
            [
              {
                $set: {
                  settle: true,
                  settleamount: {
                    $cond: {
                      if: { $eq: ["$betId", validBetIdList[0]] }, // If this is the first betId
                      then: roundToTwoDecimals(modifyBalance || 0), // Give full amount
                      else: 0, // Give 0
                    },
                  },
                  winLossId: winLossId,
                  uuid: uuid,
                  betStatus: "SETTLED",
                },
              },
            ]
          ),
        ]);

        results.push({
          returnCode: 0,
          userCode,
          balance: roundToTwoDecimals(updatedUserBalance.wallet),
          balanceAfter: roundToTwoDecimals(updatedUserBalance.wallet),
          walletTime: Date.now(),
        });
      } catch (entryError) {
        console.error(
          `Error processing winLoss entry for user ${winLossEntry.userCode}:`,
          entryError
        );
        results.push({
          returnCode: 1,
          userCode: winLossEntry.userCode || "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        });
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error(
      "AFB: Error in game provider calling ae96 get rollback api:",
      error.message
    );
    return res.status(200).json([
      {
        returnCode: 999,
        userCode: "",
        balance: 0,
        balanceAfter: 0,
        walletTime: Date.now(),
      },
    ]);
  }
});

router.post("/api/afb/winLossModify", async (req, res) => {
  try {
    const { siteCode, winLossList, gameId, gameType } = req.body;
    if (!siteCode || !gameId || !gameType) {
      return res.status(200).json([
        {
          returnCode: 1,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json([
        {
          returnCode: 2,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    const results = [];

    for (const winLossEntry of winLossList) {
      try {
        const {
          uuid,
          winLossId,
          userCode,
          modifyBalance,
          modifyBalanceAfter,
          validBetIdList,
          invalidBetIdList,
        } = winLossEntry;

        if (
          !uuid ||
          !userCode ||
          modifyBalance === null ||
          modifyBalance === undefined
        ) {
          results.push({
            returnCode: 1,
            userCode: userCode || "",
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        const [currentUser, existingUUID] = await Promise.all([
          User.findOne({ gameId: userCode }, { wallet: 1, _id: 1 }).lean(),
          LiveAFBModal.findOne({ modifyuuid: uuid }, { _id: 1 }).lean(),
        ]);

        if (!currentUser) {
          results.push({
            returnCode: 3,
            userCode,
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        if (existingUUID) {
          console.log(`bets already modified for user ${userCode}`);
          results.push({
            returnCode: 0,
            userCode,
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        let existingBets = [];

        if (validBetIdList && validBetIdList.length > 0) {
          [existingBets] = await Promise.all([
            LiveAFBModal.find(
              {
                betId: { $in: validBetIdList },
                username: userCode,
              },
              { betId: 1, _id: 1 }
            ).lean(),
          ]);
        }

        if (
          validBetIdList &&
          validBetIdList.length > 0 &&
          existingBets.length === 0
        ) {
          console.warn(
            `No bets found for user ${userCode} with betIds:`,
            validBetIdList
          );

          results.push({
            returnCode: 5,
            userCode: userCode || "",
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        const bulkOps = validBetIdList.map((betId, index) => ({
          updateOne: {
            filter: { betId: betId, username: userCode },
            update: {
              $set: { modifyuuid: uuid },
              $inc: {
                settleamount:
                  index === 0 ? roundToTwoDecimals(modifyBalance || 0) : 0, // Only first bet gets increment
              },
            },
          },
        }));

        const [updatedUserBalance] = await Promise.all([
          User.findByIdAndUpdate(
            currentUser._id,
            { $inc: { wallet: roundToTwoDecimals(modifyBalance || 0) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          LiveAFBModal.bulkWrite(bulkOps),
        ]);

        results.push({
          returnCode: 0,
          userCode,
          balance: roundToTwoDecimals(updatedUserBalance.wallet),
          balanceAfter: roundToTwoDecimals(updatedUserBalance.wallet),
          walletTime: Date.now(),
        });
      } catch (entryError) {
        console.error(
          `Error processing winLoss entry for user ${winLossEntry.userCode}:`,
          entryError
        );
        results.push({
          returnCode: 1,
          userCode: winLossEntry.userCode || "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        });
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error(
      "AFB: Error in game provider calling ae96 get rollback api:",
      error.message
    );
    return res.status(200).json([
      {
        returnCode: 999,
        userCode: "",
        balance: 0,
        balanceAfter: 0,
        walletTime: Date.now(),
      },
    ]);
  }
});

router.post("/api/afb/winLossModifyRepeat", async (req, res) => {
  try {
    const { siteCode, winLossList, gameId, gameType } = req.body;
    if (!siteCode || !gameId || !gameType) {
      return res.status(200).json([
        {
          returnCode: 1,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json([
        {
          returnCode: 2,
          userCode: "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        },
      ]);
    }

    const results = [];

    for (const winLossEntry of winLossList) {
      try {
        const {
          uuid,
          winLossId,
          userCode,
          modifyBalance,
          modifyBalanceAfter,
          validBetIdList,
          invalidBetIdList,
        } = winLossEntry;

        if (
          !uuid ||
          !userCode ||
          modifyBalance === null ||
          modifyBalance === undefined
        ) {
          results.push({
            returnCode: 1,
            userCode: userCode || "",
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        const [currentUser, existingUUID] = await Promise.all([
          User.findOne({ gameId: userCode }, { wallet: 1, _id: 1 }).lean(),
          LiveAFBModal.findOne({ modifyuuid: uuid }, { _id: 1 }).lean(),
        ]);

        if (!currentUser) {
          results.push({
            returnCode: 3,
            userCode,
            balance: 0,
            balanceAfter: 0,
            walletTime: Date.now(),
          });
          continue;
        }

        if (existingUUID) {
          console.log(`bets already modified for user ${userCode}`);
          results.push({
            returnCode: 0,
            userCode,
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        let existingBets = [];

        if (validBetIdList && validBetIdList.length > 0) {
          [existingBets] = await Promise.all([
            LiveAFBModal.find(
              {
                betId: { $in: validBetIdList },
                username: userCode,
              },
              { betId: 1, _id: 1 }
            ).lean(),
          ]);
        }

        if (
          validBetIdList &&
          validBetIdList.length > 0 &&
          existingBets.length === 0
        ) {
          console.warn(
            `No bets found for user ${userCode} with betIds:`,
            validBetIdList
          );

          results.push({
            returnCode: 5,
            userCode: userCode || "",
            balance: roundToTwoDecimals(currentUser.wallet),
            balanceAfter: roundToTwoDecimals(currentUser.wallet),
            walletTime: Date.now(),
          });
          continue;
        }

        const bulkOps = validBetIdList.map((betId, index) => ({
          updateOne: {
            filter: { betId: betId, username: userCode },
            update: {
              $set: { modifyuuid: uuid },
              $inc: {
                settleamount:
                  index === 0 ? roundToTwoDecimals(modifyBalance || 0) : 0, // Only first bet gets increment
              },
            },
          },
        }));

        const [updatedUserBalance] = await Promise.all([
          User.findByIdAndUpdate(
            currentUser._id,
            { $inc: { wallet: roundToTwoDecimals(modifyBalance || 0) } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          LiveAFBModal.bulkWrite(bulkOps),
        ]);

        results.push({
          returnCode: 0,
          userCode,
          balance: roundToTwoDecimals(updatedUserBalance.wallet),
          balanceAfter: roundToTwoDecimals(updatedUserBalance.wallet),
          walletTime: Date.now(),
        });
      } catch (entryError) {
        console.error(
          `Error processing winLoss entry for user ${winLossEntry.userCode}:`,
          entryError
        );
        results.push({
          returnCode: 1,
          userCode: winLossEntry.userCode || "",
          balance: 0,
          balanceAfter: 0,
          walletTime: Date.now(),
        });
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error(
      "AFB: Error in game provider calling ae96 get rollback api:",
      error.message
    );
    return res.status(200).json([
      {
        returnCode: 999,
        userCode: "",
        balance: 0,
        balanceAfter: 0,
        walletTime: Date.now(),
      },
    ]);
  }
});

router.post("/api/afb/tip", async (req, res) => {
  try {
    const { siteCode, userCode, tipId, gameType, tipAmount } = req.body;
    if (
      !siteCode ||
      !userCode ||
      !tipId ||
      tipAmount === undefined ||
      tipAmount === null
    ) {
      return res.status(200).json({
        returnCode: 1,
      });
    }

    if (siteCode !== afbSiteCode) {
      return res.status(200).json({
        returnCode: 2,
      });
    }

    const [currentUser, existingBet] = await Promise.all([
      User.findOne({ gameId: userCode }, { _id: 1, wallet: 1 }).lean(),
      LiveAFBModal.findOne({ tipId: tipId }, { _id: 1 }).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        returnCode: 3,
      });
    }

    if (currentUser.gameLock?.afb?.lock) {
      return res.status(200).json({
        returnCode: 4,
      });
    }

    if (existingBet) {
      return res.status(200).json({
        returnCode: 10,
      });
    }

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        _id: currentUser._id,
        wallet: { $gte: roundToTwoDecimals(tipAmount) },
      },
      { $inc: { wallet: -roundToTwoDecimals(tipAmount) } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        returnCode: 5,
      });
    }

    await LiveAFBModal.create({
      username: userCode,
      tipId: tipId,
      tip: true,
      tipamount: roundToTwoDecimals(tipAmount),
    });

    return res.status(200).json({
      returnCode: 0,
      userCode: userCode,
      balance: roundToTwoDecimals(updatedUserBalance.wallet),
      balanceAfter: roundToTwoDecimals(updatedUserBalance.wallet),
      walletTime: Date.now(),
    });
  } catch (error) {
    console.error(
      "AFB: Error in game provider calling pw66 getbalance api:",
      error.message
    );
    return res.status(200).json({
      returnCode: 999,
    });
  }
});

router.post("/api/afb/getturnoverforrebate", async (req, res) => {
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

    console.log("AFB LIVE QUERYING TIME", startDate, endDate);

    const records = await LiveAFBModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
      settle: true,
      cancel: { $ne: true },
      tip: { $ne: true },
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
        gamename: "AFB LIVE",
        gamecategory: "Live Casino",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("AFB LIVE: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      error: "AFB LIVE: Failed to fetch win/loss report",
    });
  }
});

router.get(
  "/admin/api/afb/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await LiveAFBModal.find({
        username: user.gameId,
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        settle: true,
        cancel: { $ne: true },
        tip: { $ne: true },
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
          gamename: "AFB LIVE",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("AFB LIVE: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "AFB LIVE: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/afb/:userId/gamedata",
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
          gameCategories["Live Casino"] &&
          gameCategories["Live Casino"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Live Casino"]);

          if (gamecat["AFB LIVE"]) {
            totalTurnover += gamecat["AFB LIVE"].turnover || 0;
            totalWinLoss += gamecat["AFB LIVE"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "AFB LIVE",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("AFB LIVE: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "AFB LIVE: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/afb/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await LiveAFBModal.find({
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        settle: true,
        cancel: { $ne: true },
        tip: { $ne: true },
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
          gamename: "AFB LIVE",
          gamecategory: "Live Casino",
          totalturnover: totalTurnover,
          totalwinloss: totalWinLoss,
        },
      });
    } catch (error) {
      console.log("AFB LIVE: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "AFB LIVE: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/afb/kioskreport",
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
          gameCategories["Live Casino"] &&
          gameCategories["Live Casino"] instanceof Map
        ) {
          const gamecat = Object.fromEntries(gameCategories["Live Casino"]);

          if (gamecat["AFB LIVE"]) {
            totalTurnover += Number(gamecat["AFB LIVE"].turnover || 0);
            totalWinLoss += Number(gamecat["AFB LIVE"].winloss || 0);
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "AFB LIVE",
          gamecategory: "Live Casino",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("AFB LIVE: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "AFB LIVE: Failed to fetch win/loss report",
      });
    }
  }
);
module.exports = router;
