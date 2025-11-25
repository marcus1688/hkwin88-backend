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
const xml = require("xml");
const Big = require("big.js");
const SportsWsSportModal = require("../../models/sport_wssport.model");
const SportsWsSportUnlimitedModal = require("../../models/sport_wssportunlimited.model");
require("dotenv").config();

const webURL = "https://www.ezwin9.com/";
const wssportAPIURL = "https://pi-api-gen.wsgamings.com";
const wssportAgentID = "AAHKNTEZW9";
const wssportSecret = process.env.WSSPORT_SECRET;

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

function generateSignature(secretKey, agentId, userId) {
  const rawString = `${secretKey}agentid=${agentId}&userid=${userId}`;

  return crypto.createHash("md5").update(rawString).digest("hex");
}

function generateturnoversignature(secretKey, agentId) {
  const rawString = `${secretKey}agentid=${agentId}`;

  return crypto.createHash("md5").update(rawString).digest("hex");
}

function generateBetResultSignature(secretKey, id, userId, transid) {
  const rawString = `agapikey=${secretKey}&id=${id}&userid=${userId}&transid=${transid}`;

  return crypto.createHash("md5").update(rawString).digest("hex").toUpperCase();
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

// router.post("/api/wssport/testturnover", async (req, res) => {
//   try {
//     const hash = generateturnoversignature(wssportSecret, wssportAgentID);

//     const startdate = moment.utc().startOf("day").format("YYYYMMDDHHmmss");
//     const enddate = moment.utc().endOf("day").format("YYYYMMDDHHmmss");

//     console.log("Fetching tickets for date range:", { startdate, enddate });

//     const params = new URLSearchParams({
//       startdate,
//       enddate,
//       hash,
//     });

//     const response = await axios.get(
//       `${wssportAPIURL}/api/SportAgent/${wssportAgentID}/Ticket?${params.toString()}`,
//       {
//         headers: { "Content-Type": "application/json" },
//       }
//     );

//     if (response.data.status !== "success") {
//       console.log("WS SPORT error fetching tickets:", response.data);
//       return res.status(200).json({
//         success: false,
//         message: "Failed to fetch ticket data",
//       });
//     }

//     const tickets = response.data.data;
//     let storedCount = 0;
//     let skippedCount = 0;

//     // Filter and process tickets
//     for (const ticket of tickets) {
//       // Only process tickets with status = 0, and tresult and wamt not null
//       if (
//         ticket.status === "0" &&
//         ticket.tresult !== null &&
//         ticket.wamt !== null
//       ) {
//         // Remove "AAHKNTEZW9" prefix from username
//         const username = ticket.user.replace("AAHKNTEZW9", "");

//         // Check if ticket already exists
//         const existingTicket = await SportsWsSportUnlimitedModal.findOne({
//           betId: ticket.id,
//         });

//         if (!existingTicket) {
//           // Create new ticket record
//           await SportsWsSportUnlimitedModal.create({
//             betId: ticket.id,
//             betamount: parseFloat(ticket.bamt),
//             winlossamount: parseFloat(ticket.wamt),
//             status: parseInt(ticket.status),
//             tresult: parseInt(ticket.tresult),
//             username: username,
//             claimed: false,
//             disqualified: false,
//           });
//           storedCount++;
//         } else {
//           skippedCount++;
//         }
//       }
//     }

//     console.log(
//       `Processed ${tickets.length} tickets: ${storedCount} stored, ${skippedCount} skipped (duplicates)`
//     );

//     return res.status(200).json({
//       success: true,
//       data: {
//         total: tickets.length,
//         stored: storedCount,
//         skipped: skippedCount,
//       },
//       message: {
//         en: "Tickets processed successfully.",
//         zh: "票据处理成功。",
//         ms: "Tiket berjaya diproses.",
//         zh_hk: "票據處理成功。",
//         id: "Tiket berhasil diproses.",
//       },
//     });
//   } catch (error) {
//     console.log("WS SPORT error processing tickets:", error);
//     return res.status(200).json({
//       success: false,
//       message: {
//         en: "WS SPORT: Failed to process tickets. Please try again or contact customer service.",
//         zh: "WS SPORT: 处理票据失败，请重试或联系客服。",
//         ms: "WS SPORT: Gagal memproses tiket. Sila cuba lagi atau hubungi khidmat pelanggan.",
//         zh_hk: "WS SPORT: 處理票據失敗，老闆試多次或者搵客服。",
//         id: "WS SPORT: Gagal memproses tiket. Silakan coba lagi atau hubungi layanan pelanggan.",
//       },
//     });
//   }
// });

router.post("/api/wssport/launchGame", authenticateToken, async (req, res) => {
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

    if (user.gameLock.wssport.lock) {
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

    let lang = "zh-cn";

    if (gameLang === "en") {
      lang = "en";
    } else if (gameLang === "zh") {
      lang = "zh-cn";
    } else if (gameLang === "zh_hk") {
      lang = "zh-cn";
    } else if (gameLang === "ms") {
      lang = "id-id";
    } else if (gameLang === "id") {
      lang = "id-id";
    }

    let platform = "0";
    if (clientPlatform === "web") {
      platform = "0";
    } else if (clientPlatform === "mobile") {
      platform = "1";
    }

    const fulluserId = `${wssportAgentID}${user.gameId}`;

    const hash = generateSignature(wssportSecret, wssportAgentID, fulluserId);

    const response = await axios.post(
      `${wssportAPIURL}/api/SportMember/${fulluserId}/Login?agentId=${wssportAgentID}&hash=${hash}&lang=${lang}&se=${webURL}&im=${platform}&ot=1`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    if (response.data.status !== "success") {
      console.log("WS SPORT error in launching game", response.data);
      return res.status(200).json({
        success: false,
        message: {
          en: "WS SPORT: Game launch failed. Please try again or customer service for assistance.",
          zh: "WS SPORT: 游戏启动失败，请重试或联系客服以获得帮助。",
          ms: "WS SPORT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "WS SPORT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
          id: "WS SPORT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    await GameWalletLogAttempt(
      user.username,
      "Transfer In",
      "Seamless",
      roundToTwoDecimals(user.wallet),
      "WS SPORTS"
    );

    return res.status(200).json({
      success: true,
      gameLobby: response.data.data.loginUrl,
      message: {
        en: "Game launched successfully.",
        zh: "游戏启动成功。",
        ms: "Permainan berjaya dimulakan.",
        zh_hk: "遊戲啟動成功。",
        id: "Permainan berhasil diluncurkan.",
      },
    });
  } catch (error) {
    console.log("WS SPORT error in launching game", error);
    return res.status(200).json({
      success: false,
      message: {
        en: "WS SPORT: Game launch failed. Please try again or customer service for assistance.",
        zh: "WS SPORT: 游戏启动失败，请重试或联系客服以获得帮助。",
        ms: "WS SPORT: Pelancaran permainan gagal. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
        zh_hk: "WS SPORT: 遊戲開唔到，老闆試多次或者搵客服幫手。",
        id: "WS SPORT: Peluncuran permainan gagal. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
      },
    });
  }
});

router.get("/api/wssport/api/m/bal", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(200).json({
        status: 0,
        data: {},
        message: "881",
      });
    }

    const prefix = userId.substring(0, 10);
    const name = userId.substring(10);

    if (prefix !== wssportAgentID) {
      console.log("Invalid prefix");
      return res.status(200).json({
        status: 0,
        data: {},
        message: "880",
      });
    }

    const currentUser = await User.findOne(
      { gameId: name },
      { wallet: 1, _id: 0 }
    ).lean();

    if (!currentUser) {
      return res.status(200).json({
        status: 0,
        data: {},
        message: "881",
      });
    }

    return res.status(200).json({
      status: 1,
      data: {
        CurrentCredit: roundToTwoDecimals(currentUser.wallet),
      },
      message: null,
    });
  } catch (error) {
    console.error("WS SPORT Error in balance endpoint:", error.message);
    return res.status(500).json({
      status: 0,
      data: {},
      message: "550",
    });
  }
});

router.post("/api/wssport/api/m/bet", async (req, res) => {
  try {
    const { userId, bAmt, payout, status, id, transId } = req.body;

    if (!userId || !transId) {
      return res.status(200).json({
        status: 0,
        data: {},
        message: "881",
      });
    }

    const prefix = userId.substring(0, 10);
    const name = userId.substring(10);

    if (prefix !== wssportAgentID) {
      console.log("Invalid prefix");
      return res.status(200).json({
        status: 0,
        data: {},
        message: "880",
      });
    }

    const [existingBet, currentUser] = await Promise.all([
      SportsWsSportModal.findOne({ transId }, { _id: 1 }).lean(),
      User.findOne(
        { gameId: name },
        { username: 1, wallet: 1, gameLock: 1, _id: 1 }
      ).lean(),
    ]);

    if (!currentUser) {
      return res.status(200).json({
        status: 0,
        data: {},
        message: "881",
      });
    }

    if (currentUser.gameLock.wssport.lock) {
      return res.status(200).json({
        status: 0,
        data: {},
        message: "882",
      });
    }

    if (existingBet) {
      return res.status(200).json({
        status: 1,
        data: {
          userId: userId,
          beforeBalance: roundToTwoDecimals(currentUser.wallet),
          afterBalance: roundToTwoDecimals(currentUser.wallet),
        },
        message: null,
      });
    }

    const updatedUserBalance = await User.findOneAndUpdate(
      {
        gameId: name,
        wallet: { $gte: roundToTwoDecimals(Math.abs(payout)) },
      },
      { $inc: { wallet: roundToTwoDecimals(payout) } },
      { new: true, projection: { wallet: 1 } }
    ).lean();

    if (!updatedUserBalance) {
      return res.status(200).json({
        status: 0,
        data: {},
        message: "571",
      });
    }

    await SportsWsSportModal.create({
      username: name,
      betId: id,
      transId,
      betamount: roundToTwoDecimals(Math.abs(payout)),
      status: status,
    });

    return res.status(200).json({
      status: 1,
      data: {
        userId: userId,
        beforeBalance: roundToTwoDecimals(currentUser.wallet),
        afterBalance: roundToTwoDecimals(updatedUserBalance.wallet),
      },
      message: null,
    });
  } catch (error) {
    console.error("WS SPORT Error in bet endpoint:", error.message);
    return res.status(500).json({
      status: 0,
      data: {},
      message: "550",
    });
  }
});

router.post("/api/wssport/api/m/betresult", async (req, res) => {
  try {
    const betDataArray = Array.isArray(req.body) ? req.body : [req.body];

    const results = await Promise.allSettled(
      betDataArray.map(async (betData) => {
        const { userId, payout, status, id, transId, sign } = betData;

        if (!userId || !transId) {
          return { status: 0, data: {}, message: "881" };
        }

        const prefix = userId.substring(0, 10);
        const name = userId.substring(10);

        if (prefix !== wssportAgentID) {
          return { status: 0, data: {}, message: "880" };
        }

        // Verify signature
        const ourSign = generateBetResultSignature(
          wssportSecret,
          id,
          userId,
          transId
        );
        if (sign !== ourSign) {
          return { status: 0, data: {}, message: "880" };
        }

        // Batch all database queries for maximum efficiency
        const [existingBet, currentUser, existingSettleBet] = await Promise.all(
          [
            SportsWsSportModal.findOne(
              { betId: id },
              { _id: 1, status: 1 }
            ).lean(),
            User.findOne(
              { gameId: name },
              { username: 1, wallet: 1, _id: 1 }
            ).lean(),
            SportsWsSportModal.findOne(
              { resultTransId: transId },
              { _id: 1, resultStatus: 1 }
            ).lean(),
          ]
        );

        // Quick validation checks
        if (!currentUser) {
          return { status: 0, data: {}, message: "881" };
        }

        if (!existingBet) {
          console.log("No matching bet transaction found for betId:", id);
          return { status: 1, message: "Not transaction found" };
        }

        if (existingSettleBet) {
          return { status: 1, message: "" };
        }

        await Promise.all([
          User.findOneAndUpdate(
            { gameId: name },
            { $inc: { wallet: roundToTwoDecimals(payout) } }
          ),
          SportsWsSportModal.create({
            username: name,
            resultTransId: transId,
            settleamount: roundToTwoDecimals(payout),
            resultStatus: status,
            betId: id,
          }),
        ]);

        return { status: 1, message: "" };
      })
    );

    return res.status(200).json({
      status: 1,
      message: "",
    });
  } catch (error) {
    console.error("WS SPORT Error in betresult endpoint:", error.message);
    return res.status(500).json({
      status: 0,
      data: {},
      message: "550",
    });
  }
});

router.post("/api/wssport/api/m/rollback", async (req, res) => {
  try {
    const rollbackDataArray = Array.isArray(req.body) ? req.body : [req.body];

    // Process all rollbacks in parallel for maximum speed
    const results = await Promise.allSettled(
      rollbackDataArray.map(async (betData) => {
        const { userId, payout, status, id, transId, sign, wAmt } = betData;

        if (!userId || !transId) {
          return { status: 0, data: {}, message: "881" };
        }

        const prefix = userId.substring(0, 10);
        const name = userId.substring(10);

        if (prefix !== wssportAgentID) {
          console.log("Invalid prefix for betId:", id);
          return { status: 0, data: {}, message: "880" };
        }

        const ourSign = generateBetResultSignature(
          wssportSecret,
          id,
          userId,
          transId
        );

        if (sign !== ourSign) {
          return { status: 0, data: {}, message: "880" };
        }

        const [existingBet, currentUser, existingSettleBet] = await Promise.all(
          [
            SportsWsSportModal.findOne({ betId: id }, { _id: 1 }).lean(),
            User.findOne(
              { gameId: name },
              { username: 1, wallet: 1, _id: 1 }
            ).lean(),
            SportsWsSportModal.findOne(
              { rollbackTransId: transId },
              { _id: 1 }
            ).lean(),
          ]
        );

        if (!currentUser) {
          return { status: 0, data: {}, message: "881" };
        }

        if (!existingBet) {
          console.log("No matching bet transaction found for betId:", id);
          return { status: 1, message: "Not transaction found" };
        }

        if (existingSettleBet) {
          return { status: 1, message: "" };
        }

        await Promise.all([
          User.findOneAndUpdate(
            { gameId: name },
            { $inc: { wallet: roundToTwoDecimals(payout) } }
          ),
          SportsWsSportModal.create({
            username: name,
            rollbackTransId: transId,
            rollbackamount: roundToTwoDecimals(wAmt),
            rollbackStatus: status,
            betId: id,
          }),
        ]);

        return { status: 1, message: "" };
      })
    );

    return res.status(200).json({
      status: 1,
      message: "",
    });
  } catch (error) {
    console.error("WS SPORT Error in calling ae96 API:", error.message);
    return res.status(500).json({
      status: 0,
      data: {},
      message: "550",
    });
  }
});

router.post("/api/wssport/api/m/betcancel", async (req, res) => {
  try {
    const cancelDataArray = Array.isArray(req.body) ? req.body : [req.body];

    // Process all cancellations in parallel for maximum speed
    const results = await Promise.allSettled(
      cancelDataArray.map(async (cancelData) => {
        const { userId, payout, status, id, transId, sign } = cancelData;

        if (!userId || !transId) {
          return { status: 0, data: {}, message: "881" };
        }

        const prefix = userId.substring(0, 10);
        const name = userId.substring(10);

        if (prefix !== wssportAgentID) {
          console.log("Invalid prefix for betId:", id);
          return { status: 0, data: {}, message: "880" };
        }

        const ourSign = generateBetResultSignature(
          wssportSecret,
          id,
          userId,
          transId
        );

        if (sign !== ourSign) {
          console.log("Validate failed for betId:", id);
          return { status: 0, data: {}, message: "880" };
        }

        const [existingBet, currentUser, existingSettleBet] = await Promise.all(
          [
            SportsWsSportModal.findOne({ betId: id }, { _id: 1 }).lean(),
            User.findOne(
              { gameId: name },
              { username: 1, wallet: 1, _id: 1 }
            ).lean(),
            SportsWsSportModal.findOne(
              { cancelTransId: transId },
              { _id: 1 }
            ).lean(),
          ]
        );

        if (!currentUser) {
          return { status: 0, data: {}, message: "881" };
        }

        if (!existingBet) {
          console.log("No matching bet transaction found for betId:", id);
          return { status: 1, data: {}, message: "Not transaction found" };
        }

        if (existingSettleBet) {
          return { status: 1, data: {}, message: "" };
        }

        await Promise.all([
          User.findOneAndUpdate(
            { gameId: name },
            { $inc: { wallet: -roundToTwoDecimals(payout) } }
          ),
          SportsWsSportModal.create({
            username: name,
            cancelTransId: transId,
            cancelamount: roundToTwoDecimals(payout),
            cancelStatus: status,
            betId: id,
          }),
        ]);

        return { status: 1, data: {}, message: "" };
      })
    );

    return res.status(200).json({
      status: 1,
      data: {},
      message: "",
    });
  } catch (error) {
    console.error("WS SPORT Error in calling ae96 API:", error.message);
    return res.status(500).json({
      status: 0,
      data: {},
      message: "550",
    });
  }
});

router.post("/api/wssport/getturnoverforrebate", async (req, res) => {
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

    console.log("WSSPORT QUERYING TIME", startDate, endDate);

    const records = await SportsWsSportModal.find({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
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
        (record.settleamount || 0) -
        (record.betamount || 0) -
        (record.rollbackamount || 0) +
        (record.cancelamount || 0);
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
        gamename: "WS SPORT",
        gamecategory: "Sports",
        users: playerSummary,
      },
    });
  } catch (error) {
    console.log("WS SPORT: Failed to fetch win/loss report:", error.message);
    return res.status(500).json({
      error: "WS SPORT: Failed to fetch win/loss report",
    });
  }
});

router.get(
  "/admin/api/wssport/:userId/dailygamedata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const userId = req.params.userId;

      const user = await User.findById(userId);

      const records = await SportsWsSportModal.find({
        username: user.gameId,
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss +=
          (record.settleamount || 0) -
          (record.betamount || 0) -
          (record.rollbackamount || 0) +
          (record.cancelamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WS SPORT",
          gamecategory: "Sports",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("WS SPORT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "WS SPORT: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/wssport/:userId/gamedata",
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

          if (gamecat["WS SPORT"]) {
            totalTurnover += gamecat["WS SPORT"].turnover || 0;
            totalWinLoss += gamecat["WS SPORT"].winloss || 0;
          }
        }
      });

      // Format the total values to two decimal places
      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WS SPORT",
          gamecategory: "Sports",
          user: {
            username: user.username,
            turnover: totalTurnover,
            winloss: totalWinLoss,
          },
        },
      });
    } catch (error) {
      console.log("WS SPORT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "WS SPORT: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/wssport/dailykioskreport",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const records = await SportsWsSportModal.find({
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
      });

      let totalTurnover = 0;
      let totalWinLoss = 0;

      records.forEach((record) => {
        totalTurnover += record.betamount || 0;

        totalWinLoss +=
          (record.betamount || 0) -
          (record.settleamount || 0) -
          (record.rollbackamount || 0) +
          (record.cancelamount || 0);
      });

      totalTurnover = Number(totalTurnover.toFixed(2));
      totalWinLoss = Number(totalWinLoss.toFixed(2));

      // Return the aggregated results
      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WS SPORT",
          gamecategory: "Sports",
          totalturnover: totalTurnover,
          totalwinloss: totalWinLoss,
        },
      });
    } catch (error) {
      console.log("WS SPORT: Failed to fetch win/loss report:", error.message);
      return res.status(500).json({
        error: "WS SPORT: Failed to fetch win/loss report",
      });
    }
  }
);

router.get(
  "/admin/api/wssport/kioskreport",
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

          if (gamecat["WS SPORT"]) {
            totalTurnover += Number(gamecat["WS SPORT"].turnover || 0);
            totalWinLoss += Number(gamecat["WS SPORT"].winloss || 0);
          }
        }
      });

      return res.status(200).json({
        success: true,
        summary: {
          gamename: "WS SPORT",
          gamecategory: "Sports",
          totalturnover: Number(totalTurnover.toFixed(2)),
          totalwinloss: Number(totalWinLoss.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("WS SPORT: Failed to fetch win/loss report:", error);
      return res.status(500).json({
        success: false,
        error: "WS SPORT: Failed to fetch win/loss report",
      });
    }
  }
);
module.exports = router;
