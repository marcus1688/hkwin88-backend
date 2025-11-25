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
const jwt = require("jsonwebtoken");
const moment = require("moment");
const Decimal = require("decimal.js");
const querystring = require("querystring");
const lmwpayModal = require("../../models/paymentgateway_lmwpay.model");
const UserWalletLog = require("../../models/userwalletlog.model");
const Bonus = require("../../models/bonus.model");
const Promotion = require("../../models/promotion.model");
const Deposit = require("../../models/deposit.model");
// const { checkAndUpdateVIPLevel } = require("../users");
// const { submitLuckySpin } = require("../deposit");

require("dotenv").config();

const lmwpayPrefix = "EW9";
const lmwpaySecret = process.env.LMWPAY_SECRET;
const webURL = "https://www.ezwin9.com/";
const lmwpayAPIURL = "https://hk01.ot-pb-ipsv001.com/services/api/v1";
const callbackUrl = "https://api.ezwin9.com/api/lmwpay/receivedcalled168";

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

function generateTransactionId(prefix = "") {
  const uuid = uuidv4().replace(/-/g, "").substring(0, 16);
  return prefix ? `${prefix}${uuid}` : uuid;
}

// ✅ CORRECTED: Format datetime as YYYYMMDDHHmmss (no spaces, hyphens, or colons)
function getCurrentDateTimeForAuth() {
  return moment.utc().add(8, "hours").format("YYYYMMDDHHmmss");
}

// ✅ CORRECTED: Generate Basic Auth in correct format
function generateLMWPayBasicAuth(prefix, secret) {
  const datetime = getCurrentDateTimeForAuth(); // Format: YYYYMMDDHHmmss
  const credentials = `${prefix}:${secret}:${datetime}`;
  const base64 = Buffer.from(credentials).toString("base64");

  return `Basic ${base64}`;
}

async function getLMWPayAccessToken() {
  try {
    const basicAuth = generateLMWPayBasicAuth(lmwpayPrefix, lmwpaySecret);

    const response = await axios.post(
      `${lmwpayAPIURL}/service-request`,
      {},
      {
        headers: {
          Authorization: basicAuth,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status !== "success") {
      return {
        success: false,
        error: response.data,
      };
    }

    return {
      success: true,
      data: response.data.data.access_token,
    };
  } catch (error) {
    console.error(
      "❌ Error getting LMWPAY access token:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response.data,
    };
  }
}

router.post(
  "/api/lmwpay/getpaymentlink",
  authenticateToken,
  async (req, res) => {
    try {
      const { trfAmt, promotionId } = req.body;

      const userId = req.user?.userId;

      if (!trfAmt) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Transfer amount is required",
            zh: "请输入转账金额",
            zh_hk: "麻煩輸入轉賬金額",
            ms: "Jumlah pemindahan diperlukan",
            id: "Jumlah transfer diperlukan",
          },
        });
      }

      const tokenData = await getLMWPayAccessToken();

      if (!tokenData.success) {
        console.log(tokenData, "error getting lmwpay token");
        return res.status(200).json({
          success: false,
          message: {
            en: "Failed to generate payment link. Please try again or contact customer service for assistance.",
            zh: "生成支付链接失败，请重试或联系客服以获取帮助。",
            zh_hk: "生成支付連結失敗，麻煩老闆再試多次或者聯絡客服幫手。",
            ms: "Gagal menjana pautan pembayaran. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            id: "Gagal membuat tautan pembayaran. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

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

      if (promotionId) {
        const promotion = await Promotion.findById(promotionId);
        if (!promotion) {
          return res.status(200).json({
            success: false,
            message: {
              en: "Promotion not found, Please try again or contact customer service for assistance.",
              zh: "找不到该优惠活动，请重试或联系客服以获取帮助。",
              zh_hk: "搵唔到呢個優惠活動，請重試或聯絡客服以獲取幫助。",
              ms: "Promosi tidak dijumpai, sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
              id: "Promosi tidak ditemukan, Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
            },
          });
        }
      }

      let refno;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        refno = generateTransactionId("deposit");

        const existing = await lmwpayModal.findOne({ ourRefNo: refno }).lean();
        if (!existing) break;
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        return res.status(200).json({
          success: false,
          message: {
            en: "System busy, Please try again or contact customer service for assistance.",
            zh: "系统繁忙，请重试或联系客服以获取帮助。",
            zh_hk: "系統繁忙，請重試或聯絡客服以獲取幫助。",
            ms: "Sistem sibuk, sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            id: "Sistem sibuk, Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      const formattedAmount = Number(trfAmt).toFixed(2);

      const requestPayload = {
        requestTime: getCurrentDateTimeForAuth(),
        amount: formattedAmount,
        clientAccountName: user.fullname,
        reference1: refno,
      };

      const response = await axios.post(
        `${lmwpayAPIURL}/account-request`,
        requestPayload,
        {
          headers: {
            Authorization: `Bearer ${tokenData.data}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(response.data, "hello");
      if (response.data.status !== "success") {
        console.log(`LMWpay API Error: ${response.data}`);

        return res.status(200).json({
          success: false,
          message: {
            en: "Failed to generate payment link. Please try again or contact customer service for assistance.",
            zh: "生成支付链接失败，请重试或联系客服以获取帮助。",
            zh_hk: "生成支付連結失敗，麻煩老闆再試多次或者聯絡客服幫手。",
            ms: "Gagal menjana pautan pembayaran. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
            id: "Gagal membuat tautan pembayaran. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
          },
        });
      }

      await Promise.all([
        lmwpayModal.create({
          ourRefNo: refno,
          paymentGatewayRefNo: response.data.data.requestId,
          transfername: user.fullname,
          username: user.username,
          amount: Number(formattedAmount),
          transferType: "转数快",
          status: "Pending",
          platformCharge: 0,
          remark: "-",
          promotionId: promotionId || null,
        }),
      ]);

      return res.status(200).json({
        success: true,
        message: {
          en: "Redirecting to payment page...",
          zh: "正在跳转至支付页面...",
          zh_hk: "正在跳緊去支付頁面...",
          ms: "Mengalihkan ke halaman pembayaran...",
          id: "Mengarahkan ke halaman pembayaran...",
        },
        url: response.data.data.accountURL,
      });
    } catch (error) {
      console.error(
        `Error in LMWPAy API - User: ${req.user?.userId}, Amount: ${req.body?.trfAmt}:`,
        error.response?.data || error.message
      );

      return res.status(200).json({
        success: false,
        message: {
          en: "Failed to generate payment link. Please try again or contact customer service for assistance.",
          zh: "生成支付链接失败，请重试或联系客服以获取帮助。",
          zh_hk: "生成支付連結失敗，麻煩老闆再試多次或者聯絡客服幫手。",
          ms: "Gagal menjana pautan pembayaran. Sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          id: "Gagal membuat tautan pembayaran. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }
  }
);

function getOrderIdBeforeAt(orderId) {
  if (!orderId) return "";
  return orderId.split("@")[0];
}

router.post("/api/lmwpay/receivedcalled168", async (req, res) => {
  try {
    const { orderId, amount, status } = req.body;

    if (!orderId || amount === undefined || status === undefined) {
      console.log("Missing required parameters:", { orderId, amount, status });
      return res.status(200).json({
        code: "100",
        description: "Missing required parameters",
      });
    }

    const statusMapping = {
      "-20": "Expired",
      "-10": "Reject",
      0: "Pending",
      5: "Pending Verification",
      10: "Processing",
      20: "Success",
    };

    const statusCode = String(status);
    const statusText = statusMapping[statusCode] || "Unknown";

    const cleanOrderId = getOrderIdBeforeAt(orderId);

    const existingTrx = await lmwpayModal.findOne({ ourRefNo: cleanOrderId });

    if (!existingTrx) {
      console.log(`Transaction not found: ${orderId}, creating record`);
      await lmwpayModal.create({
        username: "N/A",
        ourRefNo: cleanOrderId,
        amount: Number(amount),
        status: statusText,
        remark: `No transaction found with reference: ${orderId}. Created from callback.`,
        createdAt: new Date(),
      });

      return res.status(200).json({
        code: "0",
        description: "Created new transaction record",
      });
    }

    if (status === "20" && existingTrx.status === "Success") {
      console.log("Transaction already processed successfully, skipping");
      return res.status(200).json({
        status: true,
        message: "Transaction already processed successfully",
      });
    }

    if (status === "20" && existingTrx.status !== "Success") {
      const user = await User.findOne({ username: existingTrx.username });

      const setObject = {
        lastdepositdate: new Date(),
        ...(user &&
          !user.firstDepositDate && {
            firstDepositDate: existingTrx.createdAt,
          }),
      };

      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id },
        {
          $inc: {
            wallet: roundToTwoDecimals(Number(amount)),
            totaldeposit: roundToTwoDecimals(Number(amount)),
          },
          $set: setObject,
        },
        { new: true }
      );

      const isNewDeposit =
        !updatedUser.firstDepositDate ||
        updatedUser.firstDepositDate.getTime() ===
          existingTrx.createdAt.getTime();

      const [newDeposit, updatedTrx, newWalletLog] = await Promise.all([
        Deposit.create({
          userId: user._id,
          username: user.username || "unknown",
          fullname: user.fullname || "unknown",
          bankname: "EASYPAY",
          ownername: "Payment Gateway",
          transfernumber: uuidv4(),
          walletType: "Main",
          transactionType: "deposit",
          method: "auto",
          processBy: "admin",
          amount: Number(amount),
          remark: "-",
          transactionId: cleanOrderId,
          status: "approved",
          processtime: "00:00:00",
          newDeposit: isNewDeposit,
        }),

        // Update transaction status
        lmwpayModal.findByIdAndUpdate(
          existingTrx._id,
          { $set: { status: statusText } },
          { new: true }
        ),

        UserWalletLog.create({
          userId: user._id,
          transactionid: cleanOrderId,
          transactiontime: new Date(),
          transactiontype: "deposit",
          amount: Number(amount),
          status: "approved",
        }),
      ]);

      global.sendNotificationToUser(
        user._id,
        {
          en: `Deposit MYR ${roundToTwoDecimals(Number(amount))} approved`,
          ms: `Deposit MYR ${roundToTwoDecimals(
            Number(amount)
          )} telah diluluskan`,
          zh: `存款 MYR ${roundToTwoDecimals(Number(amount))} 已批准`,
        },
        {
          en: "Deposit Approved",
          ms: "Deposit Diluluskan",
          zh: "存款已批准",
        }
      );

      //   setImmediate(() => {
      //     try {
      //       checkAndUpdateVIPLevel(user._id).catch((error) => {
      //         console.error(
      //           `Error checking/updating VIP level for user ${user._id}:`,
      //           error
      //         );
      //       });
      //     } catch (vipError) {
      //       console.error(
      //         `Error in VIP level check for user ${user._id}:`,
      //         vipError
      //       );
      //     }
      //   });

      //   if (
      //     parseFloat(amount) === 30 &&
      //     updatedUser.luckySpinAmount > 0 &&
      //     updatedUser.luckySpinClaim === false
      //   ) {
      //     submitLuckySpin(
      //       updatedUser._id,
      //       newDeposit._id,
      //       "pending",
      //       "manual",
      //       "PENDING",
      //       "manual"
      //     ).catch((error) => {
      //       console.error("Error submitting lucky spin:", error);
      //     });
      //   }

      // Handle promotion if applicable
      if (existingTrx.promotionId) {
        try {
          const promotion = await Promotion.findById(existingTrx.promotionId);

          if (!promotion) {
            console.log("EasyPay, couldn't find promotion");
            // Don't return here, continue processing the rest of the callback
          } else {
            // Calculate bonus amount
            let bonusAmount = 0;
            if (promotion.claimtype === "Percentage") {
              bonusAmount =
                (Number(amount) * parseFloat(promotion.bonuspercentage)) / 100;
              if (promotion.maxbonus > 0 && bonusAmount > promotion.maxbonus) {
                bonusAmount = promotion.maxbonus;
              }
            } else if (promotion.claimtype === "Exact") {
              bonusAmount = parseFloat(promotion.bonusexact);
              if (promotion.maxbonus > 0 && bonusAmount > promotion.maxbonus) {
                bonusAmount = promotion.maxbonus;
              }
            }

            if (bonusAmount > 0) {
              const totalWalletAmount = Number(user.wallet || 0);

              // Create bonus transaction
              const bonusTransactionId = uuidv4();

              // Process bonus in parallel
              await Promise.all([
                Bonus.create({
                  transactionId: bonusTransactionId,
                  userId: user._id,
                  username: user.username,
                  fullname: user.fullname,
                  transactionType: "bonus",
                  processBy: "admin",
                  amount: bonusAmount,
                  walletamount: totalWalletAmount,
                  status: "pending",
                  method: "manual",
                  remark: "-",
                  promotionname: promotion.maintitle,
                  promotionnameEN: promotion.maintitleEN,
                  promotionId: existingTrx.promotionId,
                  depositId: newDeposit._id,
                  duplicateIP: user.duplicateIP,
                }),

                UserWalletLog.create({
                  userId: user._id,
                  transactionid: bonusTransactionId,
                  transactiontime: new Date(),
                  transactiontype: "bonus",
                  amount: Number(bonusAmount),
                  status: "pending",
                  promotionnameCN: promotion.maintitle,
                  promotionnameEN: promotion.maintitleEN,
                }),
              ]);
            }
          }
        } catch (promotionError) {
          console.error("Error processing promotion:", promotionError);
          // Continue processing to ensure callback success
        }
      }
    } else if (status !== "20") {
      await lmwpayModal.findByIdAndUpdate(existingTrx._id, {
        $set: { status: statusText },
      });
    }

    return res.status(200).json({
      code: "0",
      description: "Success",
    });
  } catch (error) {
    console.error("Payment callback processing error:", {
      error: error.message,
      body: req.body,
      timestamp: moment().utc().format(),
      stack: error.stack,
    });
    return res.status(200).json({
      code: "100",
      description: "Error",
    });
  }
});

router.get(
  "/admin/api/lmwpaydata",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      let dateFilter = {};

      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: moment(new Date(startDate)).utc().toDate(),
          $lte: moment(new Date(endDate)).utc().toDate(),
        };
      }

      const dgData = await lmwpayModal
        .find(dateFilter)
        .sort({ createdAt: -1 })
        .lean();
      res.status(200).json({
        success: true,
        message: "EasyPay retrieved successfully",
        data: dgData,
      });
    } catch (error) {
      console.error("Error retrieving user bonus EasyPay:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve bonus EasyPay",
        error: error.message,
      });
    }
  }
);
module.exports = router;
