const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const { User, GameDataLog } = require("../../models/users.model");
const axios = require("axios");
const moment = require("moment");
const { authenticateToken } = require("../../auth/auth");
const { authenticateAdminToken } = require("../../auth/adminAuth");
const crypto = require("crypto");
const querystring = require("querystring");
const liveWMCasinoModal = require("../../models/live_wmcasino.model");
const GameWalletLog = require("../../models/gamewalletlog.model");
require("dotenv").config();

const wmVendorID = "e9hkdapi";
const wmSecret = process.env.WMCASINO_SECRET;
const webURL = "https://www.ezwin9.com/";
const wmAPIURL = "https://liwb-019.wmapi99.com/api/wallet/Gateway.php";

function getCurrentFormattedDate() {
  return moment.utc().add(8, "hours").format("YYYY-MM-DD HH:mm:ss");
}

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

const generatePassword = () => {
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

async function registerWMCasinoUser(user) {
  try {
    const registrationTimestamp = Math.floor(Date.now() / 1000);

    const registerPassword = generatePassword();

    const registrationParams = new URLSearchParams({
      cmd: "MemberRegister",
      vendorId: wmVendorID,
      signature: wmSecret,
      user: user.gameId,
      password: registerPassword,
      username: user.username,
      timestamp: registrationTimestamp,
      syslang: 0,
    });

    const response = await axios.post(
      `${wmAPIURL}?${registrationParams.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errorCode !== 0) {
      if (response.data.errorCode === 911) {
        return {
          success: false,
          error: response.data.errorMessage,
          maintenance: true,
        };
      }

      return {
        success: false,
        error: response.data.errorMessage,
        maintenance: false,
      };
    }
    return {
      success: true,
      data: response.data,
      password: registerPassword,
      maintenance: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response.data,
      maintenance: false,
    };
  }
}

router.post("/api/wmcasino/testturnover", async (req, res) => {
  try {
    // Get today's date range
    const todayStart = moment
      .utc()
      .add(8, "hours")
      .startOf("day")
      .format("YYYYMMDDHHmmss");
    const todayEnd = moment.utc().add(8, "hours").format("YYYYMMDDHHmmss");

    const launchTimestamp = Math.floor(Date.now() / 1000);

    const launchParams = new URLSearchParams({
      cmd: "GetDateTimeReport",
      vendorId: wmVendorID,
      signature: wmSecret,
      startTime: todayStart,
      endTime: todayEnd,
      timestamp: launchTimestamp,
      timetype: 1, // 1: settlement time
      datatype: 0, // 0: win/loss report
    });

    const launchResponse = await axios.post(
      `${wmAPIURL}?${launchParams.toString()}`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(launchResponse.data, "hi");
    if (launchResponse.data.errorCode !== 0) {
      console.log("WM CASINO error:", launchResponse.data.errorMessage);

      if (launchResponse.data.errorCode === 911) {
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

      return res.status(200).json({
        success: false,
        message: {
          en: "WM CASINO: Failed to fetch game records.",
          zh: "WM CASINO: 获取游戏记录失败。",
          ms: "WM CASINO: Gagal mendapatkan rekod permainan.",
          zh_hk: "WM CASINO: 攞唔到遊戲紀錄。",
          id: "WM CASINO: Gagal mengambil catatan permainan.",
        },
      });
    }

    const recordData = launchResponse.data.result || [];

    return res.status(200).json({
      success: true,
      data: {
        total: recordData.length,
        records: recordData,
      },
      message: {
        en: "Game records fetched successfully.",
        zh: "游戏记录获取成功。",
        ms: "Rekod permainan berjaya diperoleh.",
        zh_hk: "遊戲紀錄成功獲取。",
        id: "Catatan permainan berhasil diambil.",
      },
    });
  } catch (error) {
    console.log("WM CASINO error:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "WM CASINO: Failed to fetch game records.",
        zh: "WM CASINO: 获取游戏记录失败。",
        ms: "WM CASINO: Gagal mendapatkan rekod permainan.",
        zh_hk: "WM CASINO: 攞唔到遊戲紀錄。",
        id: "WM CASINO: Gagal mengambil catatan permainan.",
      },
    });
  }
});

router.post("/api/wmcasino/launchGame", authenticateToken, async (req, res) => {
  try {
    const { gameLang } = req.body;
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

    if (user.gameLock.wmcasino.lock) {
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

    let wmCasinoPass = user.wmCasinoGamePW;

    if (!user.wmCasinoGamePW) {
      const registerData = await registerWMCasinoUser(user);

      if (!registerData.success) {
        console.log(`WM CASINO error in registering account ${registerData}`);

        if (registerData.maintenance) {
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

        return res.status(200).json({
          success: false,
          message: {
            en: "WM CASINO: Game launch failed. Please try again or customer service for assistance.",
            zh: "WM CASINO: 游戏启动失败，请重试或联系客服以获得帮助。",
            ms: "WM CASINO: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            zh_hk: "WM CASINO: 遊戲開唔到，老闆試多次或者搵客服幫手。",
            id: "WM CASINO: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      await User.findOneAndUpdate(
        { username: user.username },
        {
          $set: {
            wmCasinoGamePW: registerData.password,
          },
        }
      );

      wmCasinoPass = registerData.password;
    }

    let lang = 9;
    let voice = "cn";

    if (gameLang === "en") {
      lang = 1;
      voice = "en";
    } else if (gameLang === "zh") {
      lang = 0;
      voice = "cn";
    } else if (gameLang === "ms") {
      lang = 7;
      voice = "ms";
    } else if (gameLang === "id") {
      lang = 8;
      voice = "in";
    } else if (gameLang === "zh_hk") {
      lang = 9;
      voice = "cn";
    }

    let sysLang = 0;
    if (gameLang === "zh_hk") {
      sysLang = 0;
    } else {
      sysLang = 1;
    }

    const launchTimestamp = Math.floor(Date.now() / 1000);
    const launchParams = new URLSearchParams({
      cmd: "LoginGame",
      vendorId: wmVendorID,
      signature: wmSecret,
      user: user.gameId,
      password: wmCasinoPass,
      lang,
      voice,
      returnurl: webURL,
      timestamp: launchTimestamp,
      syslang: sysLang,
    });

    const launchResponse = await axios.post(
      `${wmAPIURL}?${launchParams.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (launchResponse.data.errorCode !== 0) {
      console.log(
        "WM CASINO error in launching game",
        launchResponse.data.errorMessage
      );

      if (launchResponse.data.errorCode === 911) {
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

      return res.status(200).json({
        success: false,
        message: {
          en: "WM CASINO: Game launch failed. Please try again or customer service for assistance.",
          zh: "WM CASINO: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "WM CASINO: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "WM CASINO: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "WM CASINO: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "WM CASINO"
    );

    return res.status(200).json({
      success: true,
      gameLobby: launchResponse.data.result,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("WM CASINO error in launching game", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "WM CASINO: Game launch failed. Please try again or customer service for assistance.",
        zh: "WM CASINO: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "WM CASINO: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "WM CASINO: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "WM CASINO: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

function sendResponse(res, errorCode, errorMessage, result) {
  return res.status(200).json({
    errorCode,
    errorMessage,
    result,
  });
}

router.post("/api/wmcasino", async (req, res) => {
  const currentTime = getCurrentFormattedDate();

  try {
    const { cmd, signature, user, money, dealid, code, gameno } = req.body;
    if (signature !== wmSecret) {
      return sendResponse(res, 1, "Invalid Credentials", {
        user: null,
        money: null,
        responseDate: currentTime,
      });
    }

    const currentUser = await User.findOne(
      { gameId: user },
      { username: 1, wallet: 1, gameLock: 1, _id: 1 }
    ).lean();

    if (!currentUser) {
      console.log("user not found");
      return sendResponse(res, 1, "User not found", {
        user: null,
        money: null,
        responseDate: currentTime,
      });
    }

    const currentWallet = roundToTwoDecimals(currentUser.wallet);

    switch (cmd) {
      case "CallBalance": {
        return sendResponse(res, 0, "CallBalance Success", {
          user,
          money: currentWallet.toFixed(2),
          responseDate: currentTime,
        });
      }

      case "PointInout": {
        const amount = roundToTwoDecimals(parseFloat(money));

        const existingTransaction = await liveWMCasinoModal
          .findOne({ trxId: dealid, code: code, username: user }, { _id: 1 })
          .lean();

        if (existingTransaction) {
          return sendResponse(res, 0, "Transaction exists", {
            money: amount.toFixed(2),
            responseDate: currentTime,
            dealid,
            cash: currentWallet.toFixed(2),
          });
        }

        if (amount < 0 && Math.abs(amount) > currentWallet) {
          return sendResponse(res, 10805, "Insufficient funds", {
            money: amount.toFixed(2),
            responseDate: currentTime,
            dealid,
            cash: currentWallet.toFixed(2),
          });
        }

        if (amount < 0 && currentUser.gameLock?.wmcasino?.lock) {
          return sendResponse(res, 10505, "Account disabled", {
            money: amount.toFixed(2),
            responseDate: currentTime,
            dealid,
            cash: currentWallet.toFixed(2),
          });
        }

        const getTransactionData = (code, amount) => {
          const absAmount = Math.abs(amount);

          switch (code) {
            case "0": // Slot Finish
              return {
                settle: true,
                bet: true,
                settleamount: absAmount,
                betamount: 0,
              };
            case "1": // Point increase (win)
              return {
                settle: true,
                settleamount: absAmount,
              };
            case "2": // Point decrease (bet)
              return {
                bet: true,
                settle: false,
                betamount: absAmount,
              };
            case "3":
              return {
                settle: true,
                settleamount: absAmount,
              };
            case "4": // Point decrease by game reset
              return {
                bet: true,
                betamount: absAmount,
              };
            case "5": // Re-payout cancel
              return {
                cancel: true,
                settleamount: absAmount,
                betamount: 0,
              };
          }
        };
        const transactionData = getTransactionData(code, amount);

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: user },
            { $inc: { wallet: amount } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          (async () => {
            if (code === "2" || code === "4") {
              // Code 2: Point decrease (bet) - Always create new bet record
              return await liveWMCasinoModal.create({
                username: user,
                betId: gameno,
                trxId: dealid,
                code,
                trasferAmount: Math.abs(amount),
                betamount: transactionData.betamount || 0,
                settleamount: transactionData.settleamount || 0,
                settle: transactionData.settle || false,
                bet: transactionData.bet || false,
                cancel: transactionData.cancel || false,
              });
            } else if (code === "1" || code === "3" || code === "5") {
              // Code 1: Point increase (win/settlement) - Settle all bets with same gameno
              const existingBets = await liveWMCasinoModal
                .find({
                  username: user,
                  betId: gameno,
                  settle: { $ne: true }, // Only get unsettled bets
                })
                .sort({ createdAt: 1 })
                .lean();

              if (existingBets.length === 0) {
                // No existing bets to settle, create new settlement record
                return await liveWMCasinoModal.create({
                  username: user,
                  betId: gameno,
                  trxId: dealid,
                  code,
                  trasferAmount: Math.abs(amount),
                  betamount: 0,
                  settleamount: transactionData.settleamount || 0,
                  settle: true,
                  bet: false,
                  cancel: transactionData.cancel || false,
                });
              } else {
                // Update the first bet with settlement data and mark others as settled
                const firstBetUpdate = liveWMCasinoModal.findByIdAndUpdate(
                  existingBets[0]._id,
                  {
                    $set: {
                      code,
                      trasferAmount: Math.abs(amount),
                      settleamount: transactionData.settleamount || 0,
                      settle: true,
                      trxId: dealid,
                    },
                  },
                  { new: true, lean: true }
                );

                // Mark all other unsettled bets with same betId as settled
                const otherBetsUpdate =
                  existingBets.length > 1
                    ? liveWMCasinoModal.updateMany(
                        {
                          username: user,
                          betId: gameno,
                          _id: {
                            $in: existingBets.slice(1).map((bet) => bet._id),
                          },
                          settle: { $ne: true },
                        },
                        {
                          $set: {
                            settle: true,
                            trxId: dealid,
                          },
                        }
                      )
                    : Promise.resolve();

                const [firstResult] = await Promise.all([
                  firstBetUpdate,
                  otherBetsUpdate,
                ]);
                return firstResult;
              }
            } else {
              // Other codes (0, 3, 4, 5) - Handle as before with upsert logic
              return await liveWMCasinoModal.findOneAndUpdate(
                {
                  username: user,
                  trxId: dealid,
                },
                {
                  $set: {
                    code,
                    trasferAmount: Math.abs(amount),
                    betamount: transactionData.betamount || 0,
                    settleamount: transactionData.settleamount || 0,
                    settle: transactionData.settle || false,
                    bet: transactionData.bet || false,
                    cancel: transactionData.cancel || false,
                  },
                  $setOnInsert: {
                    username: user,
                    betId: gameno,
                    trxId: dealid,
                  },
                },
                {
                  upsert: true,
                  new: true,
                  lean: true,
                }
              );
            }
          })(),

          // liveWMCasinoModal.findOneAndUpdate(
          //   {
          //     username: user,
          //     betId: gameno,
          //   },
          //   {
          //     $set: {
          //       code,
          //       trasferAmount: Math.abs(amount),
          //       betamount: transactionData.betamount,
          //       settleamount: transactionData.settleamount,
          //       settle: transactionData.settle,
          //       bet: transactionData.bet,
          //       cancel: transactionData.cancel,
          //     },
          //     $setOnInsert: {
          //       username: user,
          //       betId: gameno,
          //       trxId: dealid,
          //     },
          //   },
          //   {
          //     upsert: true,
          //     new: false,
          //     lean: true,
          //   }
          // ),
        ]);

        if (!updatedUserBalance) {
          throw new Error("Failed to update balance");
        }

        return sendResponse(res, 0, "PointInout Success", {
          money: amount.toFixed(2),
          responseDate: currentTime,
          dealid,
          cash: roundToTwoDecimals(updatedUserBalance.wallet).toFixed(2),
        });
      }

      case "TimeoutBetReturn": {
        const amount = roundToTwoDecimals(parseFloat(money));

        if (currentUser.gameLock?.wmcasino?.lock) {
          return sendResponse(res, 10505, "Account disabled", {
            money: amount.toFixed(2),
            responseDate: currentTime,
            dealid,
            cash: currentWallet.toFixed(2),
          });
        }

        const existingTransaction = await liveWMCasinoModal
          .findOne(
            { trxId: dealid, resettle: true, username: user },
            { _id: 1 }
          )
          .lean();

        if (existingTransaction) {
          return sendResponse(res, 0, "Transaction exists", {
            money: amount.toFixed(2),
            responseDate: currentTime,
            dealid,
            cash: currentWallet.toFixed(2),
          });
        }

        const [updatedUserBalance] = await Promise.all([
          User.findOneAndUpdate(
            { gameId: user },
            { $inc: { wallet: amount } },
            { new: true, projection: { wallet: 1 } }
          ).lean(),

          liveWMCasinoModal.findOneAndUpdate(
            { trxId: dealid },
            {
              $set: {
                username: user,
                resettle: true,
              },
            },
            { upsert: true }
          ),
        ]);

        return sendResponse(res, 0, "TimeoutBetReturn Success", {
          money: amount.toFixed(2),
          responseDate: currentTime,
          dealid,
          cash: roundToTwoDecimals(updatedUserBalance.wallet).toFixed(2),
        });
      }

      default:
        return sendResponse(res, 1, "Invalid command", {
          user: null,
          money: null,
          responseDate: currentTime,
        });
    }
  } catch (error) {
    console.error("Error in game provider calling ae96 api:", error);
    return sendResponse(res, 1, "Internal server error", {
      user: null,
      money: null,
      responseDate: currentTime,
    });
  }
});

function convertToHongKongStartOfDay(dateString) {
  return moment.tz(dateString, "Asia/Hong_Kong").format("YYYYMMDD000000");
}

function convertToHongKongEndOfDay(dateString) {
  return moment.tz(dateString, "Asia/Hong_Kong").format("YYYYMMDD235959");
}

router.post("/api/wmcasino/getturnoverforrebate", async (req, res) => {
  try {
    const today = moment.utc().add(8, "hours").format("YYYY-MM-DD");
    const yesterday = moment
      .utc()
      .add(8, "hours")
      .subtract(1, "days")
      .format("YYYY-MM-DD");

    const { date } = req.body;

    let start, end;

    if (date === "today") {
      start = convertToHongKongStartOfDay(today);
      end = convertToHongKongEndOfDay(today);
    } else if (date === "yesterday") {
      start = convertToHongKongStartOfDay(yesterday);
      end = convertToHongKongEndOfDay(yesterday);
    } else {
      console.log(date, "WM CASINO: Invalid date");
      return res.status(400).json({
        error: "No Date value being pass in",
      });
    }

    console.log("WM CASINO QUERYING TIME", start, end);

    const timestamp = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
      cmd: "GetDateTimeReport",
      vendorId: wmVendorID,
      signature: wmSecret,
      startTime: start,
      endTime: end,
      timestamp: timestamp,
      syslang: 0,
      timetype: 0,
      datatype: 0,
    });

    const apiUrl = `${wmAPIURL}?${params.toString()}`;
    const apiResponse = await axios.post(
      apiUrl,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (
      apiResponse.data.errorCode !== 107 &&
      apiResponse.data.errorCode !== 0
    ) {
      console.log(`WM CASINO: ${apiResponse.data.errorMessage}`);
      return res
        .status(500)
        .json({ error: `WM CASINO: Failed to fetch win/loss report` });
    }

    const transactions = apiResponse.data.result;

    const gameIdSummary = {};

    if (transactions) {
      transactions.forEach((transaction) => {
        const gameId = transaction.user; // This is the gameId from your User schema

        // Initialize totals for the gameId if not present
        if (!gameIdSummary[gameId]) {
          gameIdSummary[gameId] = {
            turnover: 0,
            winloss: 0,
          };
        }
        // Add validbet and winloss to the user's total
        gameIdSummary[gameId].turnover += parseFloat(transaction.validbet || 0);
        gameIdSummary[gameId].winloss += parseFloat(transaction.result || 0);
      });
    }

    const gameIds = Object.keys(gameIdSummary);

    const users = await User.find(
      { gameId: { $in: gameIds } },
      { username: 1, gameId: 1, _id: 0 }
    ).lean();

    const gameIdToUsername = {};
    users.forEach((user) => {
      gameIdToUsername[user.gameId] = user.username;
    });

    const usernameSummary = {};

    Object.keys(gameIdSummary).forEach((gameId) => {
      const username = gameIdToUsername[gameId];

      if (username) {
        // User found in database
        usernameSummary[username] = gameIdSummary[gameId];
      } else {
        // User not found, keep gameId but add a note
        console.warn(`WM CASINO: User not found for gameId: ${gameId}`);
        usernameSummary[`${gameId}_NOT_FOUND`] = gameIdSummary[gameId];
      }
    });

    // Construct the final response
    return res.status(200).json({
      success: true,
      summary: {
        gamename: "WM CASINO",
        gamecategory: "Live Casino",
        users: usernameSummary,
      },
    });
  } catch (error) {
    console.log("WM CASINO: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      error: "WM CASINO: Failed to fetch win/loss report",
    });
  }
});

router.get(
  "/admin/api/wmcasino/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await liveWMCasinoModal.find({
        username: user.gameId,
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
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
      // Construct the final response
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WM CASINO",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("WM CASINO: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "WM CASINO: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/wmcasino/:userId/gamedata",
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
          gameCategories["Live Casino"] &&
          gameCategories["Live Casino"] instanceof Map
        ) {
          const liveCasino = Object.fromEntries(gameCategories["Live Casino"]);

          if (liveCasino["WM CASINO"]) {
            totalTurnover += liveCasino["WM CASINO"].turnover || 0;
            totalWinLoss += liveCasino["WM CASINO"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WM CASINO",
          gamecategory: "Live Casino",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("WM CASINO: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "WM CASINO: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/wmcasino/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await liveWMCasinoModal.find({
        createdAt: {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        },
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

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WM CASINO",
          gamecategory: "Live Casino",
          totalturnover: totalTurnover,
          totalwinloss: totalWinLoss,
        },
      });
    } catch (error) {
      console.error("WM CASINO: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "WM CASINO: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/wmcasino/kioskreport",
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
          const liveCasino = Object.fromEntries(gameCategories["Live Casino"]);

          if (liveCasino["WM CASINO"]) {
            totalTurnover += Number(liveCasino["WM CASINO"].turnover || 0);
            totalWinLoss += Number(liveCasino["WM CASINO"].winloss || 0) * -1;
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WM CASINO",
          gamecategory: "Live Casino",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("WM CASINO: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "WM CASINO: Failed to fetch win/loss report",
      });
    }
  }
);
module.exports = router;
