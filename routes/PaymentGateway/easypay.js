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
const easyPayModal = require("../../models/paymentgateway_easypay.model");
const UserWalletLog = require("../../models/userwalletlog.model");
const Bonus = require("../../models/bonus.model");
const Promotion = require("../../models/promotion.model");
const Deposit = require("../../models/deposit.model");
const Withdraw = require("../../models/withdraw.model");
const paymentgateway = require("../../models/paymentgateway.model");
const PaymentGatewayTransactionLog = require("../../models/paymentgatewayTransactionLog.model");
const { checkAndUpdateVIPLevel } = require("../users");
const kioskbalance = require("../../models/kioskbalance.model");
const { updateKioskBalance } = require("../../services/kioskBalanceService");
const BankTransactionLog = require("../../models/banktransactionlog.model");
const BankList = require("../../models/banklist.model");
// const { submitLuckySpin } = require("../deposit");

require("dotenv").config();

const easypayMerchantCode = "EP001-51";
const easypaySecret = process.env.EASYPAY_SECRET;
const webURL = "https://www.ezwin9.com/";
const easypayAPIURL = "https://easypayonline.org/api";
const callbackUrl = "https://api.ezwin9.com/api/easypay/receivedcalled168";
const transferoutcallbackUrl =
  "https://api.ezwin9.com/api/easypay/receivedtransfercalled168";

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

function generateTransactionId(prefix = "") {
  const uuid = uuidv4().replace(/-/g, "").substring(0, 16);
  return prefix ? `${prefix}${uuid}` : uuid;
}

function generateBasicAuth(merchantCode, apiPassword) {
  const credentials = `${merchantCode}:${apiPassword}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

router.post(
  "/api/easypay/getpaymentlink",
  authenticateToken,
  async (req, res) => {
    try {
      const { trfAmt, bankCode, promotionId, userfullname, website } = req.body;
      const userId = req.user?.userId;

      if (!trfAmt || !bankCode) {
        return res.status(200).json({
          success: false,
          message: {
            en: !trfAmt
              ? "Transfer amount is required"
              : "Please select a payment method",
            zh: !trfAmt ? "请输入转账金额" : "请选择转账方式",
            zh_hk: !trfAmt ? "麻煩輸入轉賬金額" : "麻煩老闆揀選轉帳方式",
            ms: !trfAmt
              ? "Jumlah pemindahan diperlukan"
              : "Sila pilih kaedah pembayaran",
            id: !trfAmt
              ? "Jumlah transfer diperlukan"
              : "Silakan pilih metode pembayaran",
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
        refno = generateTransactionId("ez9");

        const existing = await easyPayModal.findOne({ ourRefNo: refno }).lean();
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
        amount: formattedAmount,
        tx_id: refno,
        transferror_name: userfullname,
        callback_url: callbackUrl,
        redirect_url: website,
      };

      const basicAuth = generateBasicAuth(easypayMerchantCode, easypaySecret);

      const endpointMap = {
        fps: "/deposit/kuaizhuan_order",
        bank: "/deposit/bank_order",
        qrcode: "/deposit/qr_order",
      };

      const endpoint = endpointMap[bankCode] || "/deposit/qr_order";
      const response = await axios.post(
        `${easypayAPIURL}${endpoint}`,
        requestPayload,
        {
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            merchant: easypayMerchantCode,
            Authorization: basicAuth,
          },
        }
      );

      if (response.data.status !== 1) {
        console.log(`EasyPay API Error: ${response.data}`);

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

      const BANK_CODE_DISPLAY_NAMES = {
        fps: "转数快",
        bank: "银行转账",
        qrcode: "二维码支付",
      };

      await Promise.all([
        easyPayModal.create({
          ourRefNo: refno,
          paymentGatewayRefNo: response.data.data.order_id,
          transfername: "N/A",
          username: user.username,
          amount: Number(formattedAmount),
          transferType: BANK_CODE_DISPLAY_NAMES[bankCode] || bankCode,
          transactiontype: "deposit",
          status: "Pending",
          platformCharge: Number(response.data.data.service_change) || 0,
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
        url: response.data.data.payment_details.redirect_url,
      });
    } catch (error) {
      console.error(
        `Error in EasyPay API - User: ${req.user?.userId}, Amount: ${req.body?.trfAmt}:`,
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

router.post("/api/easypay/receivedcalled168", async (req, res) => {
  try {
    const {
      order_id,
      order_amount,
      status,
      transferror_name,
      tx_id,
      service_change,
    } = req.body;

    if (!order_id || order_amount == null || !status) {
      console.log("Missing required parameters:", {
        order_id,
        order_amount,
        status,
      });
      return res.status(200).json({ status: 0 });
    }

    const statusMapping = {
      COMPLETE: "Success",
    };

    const statusText = statusMapping[status] || "Reject";
    const amount = Number(order_amount);
    const roundedAmount = roundToTwoDecimals(amount);

    const existingTrx = await easyPayModal
      .findOne(
        { paymentGatewayRefNo: order_id },
        { username: 1, status: 1, promotionId: 1, createdAt: 1, _id: 1 }
      )
      .lean();

    if (!existingTrx) {
      console.log(`Transaction not found: ${order_id}, creating record`);
      await easyPayModal.create({
        username: transferror_name || "N/A",
        transfername: transferror_name || "N/A",
        ourRefNo: tx_id,
        paymentGatewayRefNo: order_id,
        amount,
        transactiontype: "deposit",
        status: statusText,
        platformCharge: Number(service_change || 0),
        remark: `No transaction found with reference: ${order_id}. Created from callback.`,
      });

      return res.status(200).json({ status: 0 });
    }

    if (status === "COMPLETE" && existingTrx.status === "Success") {
      console.log("Transaction already processed successfully, skipping");
      return res.status(200).json({
        status: 1,
      });
    }

    if (status === "COMPLETE" && existingTrx.status !== "Success") {
      // ✅ OPTIMIZED: Fetch user, bank, and gateway in parallel
      const [user, bank, gateway] = await Promise.all([
        User.findOne(
          { username: existingTrx.username },
          {
            _id: 1,
            username: 1,
            fullname: 1,
            wallet: 1,
            totaldeposit: 1,
            firstDepositDate: 1,
            duplicateIP: 1,
            duplicateBank: 1,
          }
        ).lean(),

        BankList.findById("6924506341656f9a953db8a0", {
          _id: 1,
          bankname: 1,
          ownername: 1,
          bankaccount: 1,
          qrimage: 1,
          currentbalance: 1,
        }).lean(),

        paymentgateway
          .findOne(
            { name: { $regex: /^easypay$/i } },
            { _id: 1, name: 1, balance: 1 }
          )
          .lean(),
      ]);

      if (!user) {
        console.error(`User not found: ${existingTrx.username}`);
        return res.status(200).json({ status: 0 });
      }

      if (!bank) {
        console.error(`Bank not found: 6924506341656f9a953db8a0`);
        return res.status(200).json({ status: 0 });
      }

      const hasPromotion = !!existingTrx.promotionId;
      const isNewDeposit = !user.firstDepositDate;

      let updatedUser = user;

      if (!hasPromotion) {
        const setObject = {
          lastdepositdate: new Date(),
          ...(isNewDeposit && { firstDepositDate: existingTrx.createdAt }),
        };

        updatedUser = await User.findByIdAndUpdate(
          user._id,
          {
            $inc: {
              wallet: roundedAmount,
              totaldeposit: roundedAmount,
            },
            $set: setObject,
          },
          { new: true, projection: { wallet: 1 } }
        ).lean();

        setImmediate(() => {
          checkAndUpdateVIPLevel(user._id).catch((error) => {
            console.error(
              `VIP level update error for user ${user._id}:`,
              error.message
            );
          });
        });
      }

      const depositStatus = hasPromotion ? "pending" : "approved";
      const oldGatewayBalance = gateway?.balance || 0;
      const oldBankBalance = bank.currentbalance || 0;

      const [newDeposit, , , updatedGateway, updatedBank] = await Promise.all([
        Deposit.create({
          userId: user._id,
          username: user.username,
          fullname: user.fullname || "unknown",
          bankname: "EASYPAY",
          ownername: "Payment Gateway",
          transfernumber: tx_id,
          walletType: "Main",
          transactionType: "deposit",
          method: "auto",
          processBy: "admin",
          amount: roundedAmount,
          walletamount: user.wallet,
          remark: "-",
          status: depositStatus,
          processtime: "00:00:00",
          newDeposit: isNewDeposit,
          transactionId: tx_id,
          duplicateIP: user.duplicateIP,
          duplicateBank: user.duplicateBank,
        }),

        easyPayModal.findByIdAndUpdate(existingTrx._id, {
          $set: {
            status: statusText,
            transfername: transferror_name || "N/A",
          },
        }),

        UserWalletLog.create({
          userId: user._id,
          transactionid: tx_id,
          transactiontime: new Date(),
          transactiontype: "deposit",
          amount: roundedAmount,
          status: depositStatus,
        }),

        paymentgateway.findOneAndUpdate(
          { name: { $regex: /^easypay$/i } },
          { $inc: { balance: roundedAmount } },
          { new: true, projection: { _id: 1, name: 1, balance: 1 } }
        ),

        BankList.findByIdAndUpdate(
          "6924506341656f9a953db8a0",
          [
            {
              $set: {
                totalDeposits: {
                  $add: ["$totalDeposits", roundedAmount],
                },
                currentbalance: {
                  $subtract: [
                    {
                      $add: [
                        "$startingbalance",
                        {
                          $add: ["$totalDeposits", roundedAmount],
                        },
                        "$totalCashIn",
                      ],
                    },
                    {
                      $add: ["$totalWithdrawals", "$totalCashOut"],
                    },
                  ],
                },
              },
            },
          ],
          { new: true, projection: { currentbalance: 1 } }
        ).lean(),
      ]);

      await Promise.all([
        BankTransactionLog.create({
          bankName: bank.bankname,
          ownername: bank.ownername,
          bankAccount: bank.bankaccount,
          remark: "-",
          lastBalance: oldBankBalance,
          currentBalance:
            updatedBank?.currentbalance || oldBankBalance + roundedAmount,
          processby: "admin",
          qrimage: bank.qrimage,
          playerusername: user.username,
          playerfullname: user.fullname,
          transactiontype: "deposit",
          amount: roundedAmount,
        }),

        PaymentGatewayTransactionLog.create({
          gatewayId: gateway?._id,
          gatewayName: gateway?.name || "EASYPAY",
          transactiontype: "deposit",
          amount: roundedAmount,
          lastBalance: oldGatewayBalance,
          currentBalance:
            updatedGateway?.balance || oldGatewayBalance + roundedAmount,
          remark: `Deposit from ${user.username}`,
          playerusername: user.username,
          processby: "system",
          depositId: newDeposit._id,
        }),
      ]);

      if (hasPromotion) {
        try {
          const promotion = await Promotion.findOne(
            { _id: existingTrx.promotionId },
            {
              claimtype: 1,
              bonuspercentage: 1,
              bonusexact: 1,
              maxbonus: 1,
              maintitle: 1,
              maintitleEN: 1,
            }
          ).lean();

          if (!promotion) {
            console.log(`Promotion not found: ${existingTrx.promotionId}`);
          } else {
            // Calculate bonus amount
            let bonusAmount = 0;

            if (promotion.claimtype === "Percentage") {
              bonusAmount =
                (amount * parseFloat(promotion.bonuspercentage)) / 100;
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
              bonusAmount = roundToTwoDecimals(bonusAmount);
              const bonusTransactionId = uuidv4();

              // Create bonus and wallet log in parallel
              await Promise.all([
                Bonus.create({
                  transactionId: bonusTransactionId,
                  userId: user._id,
                  username: user.username,
                  fullname: user.fullname || "unknown",
                  transactionType: "bonus",
                  processBy: "admin",
                  amount: bonusAmount,
                  walletamount: user.wallet,
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
                  amount: bonusAmount,
                  status: "pending",
                  promotionnameCN: promotion.maintitle,
                  promotionnameEN: promotion.maintitleEN,
                }),
              ]);

              console.log(
                `Bonus created: ${bonusAmount} for user ${user.username}`
              );
            }
          }
        } catch (promotionError) {
          console.error("Promotion processing error:", promotionError.message);
        }
      }

      console.log(
        `✅ Payment processed: ${order_id}, Amount: ${amount}, User: ${
          user.username
        }, Promotion: ${hasPromotion ? "Yes (Pending)" : "No (Approved)"}`
      );
    } else if (status !== "COMPLETE") {
      await easyPayModal.findByIdAndUpdate(existingTrx._id, {
        $set: { status: statusText, transfername: transferror_name || "N/A" },
      });
      console.log(
        `Transaction status updated to: ${statusText} for ${order_id}`
      );
    }

    return res.status(200).json({ status: 1 });
  } catch (error) {
    console.error("Payment callback processing error:", {
      error: error.message,
      body: req.body,
      timestamp: moment().utc().format(),
      stack: error.stack,
    });
    return res.status(200).json({ status: 0 });
  }
});

router.get(
  "/admin/api/easypaydata",
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

      const dgData = await easyPayModal
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

router.post("/api/easypay/getwithdrawbanklist", async (req, res) => {
  try {
    const basicAuth = generateBasicAuth(easypayMerchantCode, easypaySecret);
    console.log(`${easypayAPIURL}/withdraw/get_bank_list`);
    const response = await axios.post(
      `${easypayAPIURL}/withdraw/get_bank_list`,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          merchant: easypayMerchantCode,
          Authorization: basicAuth,
        },
      }
    );

    if (response.data.status !== 1) {
      console.log(`EasyPay API Error: ${response.data}`);

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

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(
      `Error in EasyPay API - User: ${req.user?.userId}, Amount: ${req.body?.trfAmt}:`,
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
});

router.post("/admin/api/easypay/requesttransfer/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
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

    const {
      amount,
      bankCode,
      accountHolder,
      accountNumber,
      bankName,
      transactionId,
    } = req.body;

    if (!amount || !bankCode || !accountHolder || !accountNumber) {
      return res.status(200).json({
        success: false,
        message: {
          en: "Please complete all required fields",
          zh: "请完成所有必填项",
          zh_hk: "麻煩完成所有必填項目",
          ms: "Sila lengkapkan semua medan yang diperlukan",
          id: "Silakan lengkapi semua kolom yang diperlukan",
        },
      });
    }

    // let refno;
    // let attempts = 0;
    // const maxAttempts = 5;

    // do {
    //   refno = generateTransactionId("wez9");

    //   const existing = await easyPayModal.findOne({ ourRefNo: refno }).lean();
    //   if (!existing) break;
    //   attempts++;
    // } while (attempts < maxAttempts);

    // if (attempts >= maxAttempts) {
    //   return res.status(200).json({
    //     success: false,
    //     message: {
    //       en: "System busy, Please try again or contact customer service for assistance.",
    //       zh: "系统繁忙，请重试或联系客服以获取帮助。",
    //       zh_hk: "系統繁忙，請重試或聯絡客服以獲取幫助。",
    //       ms: "Sistem sibuk, sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
    //       id: "Sistem sibuk, Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
    //     },
    //   });
    // }

    const formattedAmount = Number(amount).toFixed(2);

    const requestPayload = {
      amount: formattedAmount,
      tx_id: transactionId,
      callback_url: transferoutcallbackUrl,
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: accountHolder,
    };

    const basicAuth = generateBasicAuth(easypayMerchantCode, easypaySecret);

    const response = await axios.post(
      `${easypayAPIURL}/withdraw/bank_order`,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          merchant: easypayMerchantCode,
          Authorization: basicAuth,
        },
      }
    );
    if (response.data.status !== 1) {
      console.log(`EasyPay API Error: ${response.data}`);

      return res.status(200).json({
        success: false,
        message: {
          en: "Payout request failed",
          zh: "申请代付失败",
          zh_hk: "申請代付失敗",
          ms: "Permintaan pembayaran gagal",
          id: "Permintaan pembayaran gagal",
        },
      });
    }

    await Promise.all([
      easyPayModal.create({
        ourRefNo: transactionId,
        paymentGatewayRefNo: response.data.data.order_id,
        transfername: "N/A",
        username: user.username,
        amount: Number(formattedAmount),
        transferType: bankName || bankCode,
        transactiontype: "withdraw",
        status: "Pending",
        platformCharge: Number(response.data.data.service_change) || 0,
        remark: "-",
        promotionId: null,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: {
        en: "Payout request submitted successfully",
        zh: "提交申请代付成功",
        zh_hk: "提交申請代付成功",
        ms: "Permintaan pembayaran berjaya diserahkan",
        id: "Permintaan pembayaran berhasil diajukan",
      },
    });
  } catch (error) {
    console.error(
      `Error in EasyPay API - User: ${req.user?.userId}, Amount: ${req.body?.amount}:`,
      error.response?.data || error.message
    );

    return res.status(200).json({
      success: false,
      message: {
        en: "Payout request failed",
        zh: "申请代付失败",
        zh_hk: "申請代付失敗",
        ms: "Permintaan pembayaran gagal",
        id: "Permintaan pembayaran gagal",
      },
    });
  }
});

router.post("/api/easypay/receivedtransfercalled168", async (req, res) => {
  try {
    const {
      tx_id,
      order_id,
      status,
      final_amount,
      order_amount,
      service_change,
    } = req.body;

    if (!order_id || order_amount == null || !status) {
      console.log("Missing required parameters:", {
        order_id,
        order_amount,
        status,
      });
      return res.status(200).json({ status: 0 });
    }

    const statusMapping = {
      COMPLETE: "Success",
      REJECT: "Reject",
      OVERTIME: "Pending",
    };

    const statusText = statusMapping[status] || "Unknown";
    const amount = Number(order_amount);

    // Find existing transaction
    const existingTrx = await easyPayModal
      .findOne(
        { paymentGatewayRefNo: order_id },
        { username: 1, status: 1, createdAt: 1, _id: 1 }
      )
      .lean();

    if (!existingTrx) {
      console.log(`Transaction not found: ${order_id}, creating record`);
      await easyPayModal.create({
        username: "N/A",
        transfername: "N/A",
        ourRefNo: tx_id,
        paymentGatewayRefNo: order_id,
        amount,
        transactiontype: "withdraw",
        status: statusText,
        platformCharge: Number(service_change || 0),
        remark: `No transaction found with reference: ${order_id}. Created from callback.`,
      });

      return res.status(200).json({ status: 0 });
    }

    // Check if already processed successfully
    if (status === "COMPLETE" && existingTrx.status === "Success") {
      console.log("Transaction already processed successfully, skipping");
      return res.status(200).json({
        status: 1,
      });
    }

    if (status === "COMPLETE" && existingTrx.status !== "Success") {
      const user = await User.findOne(
        { username: existingTrx.username },
        {
          _id: 1,
          username: 1,
          fullname: 1,
          wallet: 1,
          duplicateIP: 1,
          duplicateBank: 1,
        }
      ).lean();

      if (!user) {
        console.error(`User not found: ${existingTrx.username}`);
        return res.status(200).json({ status: 0 });
      }

      const gateway = await paymentgateway
        .findOne(
          { name: { $regex: /^easypay$/i } },
          { _id: 1, name: 1, balance: 1 }
        )
        .lean();

      const oldGatewayBalance = gateway?.balance || 0;

      const [, updatedGateway] = await Promise.all([
        easyPayModal
          .findByIdAndUpdate(existingTrx._id, { status: statusText })
          .lean(),

        paymentgateway
          .findOneAndUpdate(
            { name: { $regex: /^easypay$/i } },
            { $inc: { balance: -roundToTwoDecimals(amount) } },
            { new: true, projection: { _id: 1, name: 1, balance: 1 } }
          )
          .lean(),
      ]);

      await PaymentGatewayTransactionLog.create({
        gatewayId: gateway._id,
        gatewayName: gateway.name,
        transactiontype: "withdraw",
        amount: roundToTwoDecimals(amount),
        lastBalance: oldGatewayBalance,
        currentBalance:
          updatedGateway?.balance ||
          oldGatewayBalance - roundToTwoDecimals(amount),
        remark: `Withdraw from ${user.username}`,
        playerusername: user.username,
        processby: "system",
      });
    } else if (status === "REJECT" && existingTrx.status !== "Reject") {
      const [, , withdraw, updatedUser] = await Promise.all([
        easyPayModal.findByIdAndUpdate(existingTrx._id, {
          $set: { status: statusText },
        }),

        UserWalletLog.findOneAndUpdate(
          { transactionid: tx_id },
          { $set: { status: "cancel" } }
        ),

        Withdraw.findOneAndUpdate(
          { transactionId: tx_id },
          {
            $set: {
              status: "reverted",
              processBy: "admin",
              processtime: "00:00:00",
            },
          },
          {
            new: false,
            projection: { _id: 1, amount: 1, withdrawbankid: 1, remark: 1 },
          }
        ).lean(),

        User.findOneAndUpdate(
          { username: existingTrx.username },
          { $inc: { wallet: roundToTwoDecimals(amount) } },
          {
            new: true,
            projection: { _id: 1, username: 1, fullname: 1, wallet: 1 },
          }
        ).lean(),
      ]);

      if (!withdraw) {
        console.log(`Withdraw not found for tx_id: ${tx_id}`);
        return res.status(200).json({ status: 0 });
      }

      const [kioskSettings, bank] = await Promise.all([
        kioskbalance.findOne({}, { status: 1 }).lean(),
        BankList.findById(withdraw.withdrawbankid).lean(),
      ]);

      if (!bank) {
        console.log("Invalid bank easypay callback");
        return res.status(200).json({ status: 0 });
      }

      const finalUpdates = [];

      if (kioskSettings?.status) {
        const kioskResult = await updateKioskBalance(
          "subtract",
          withdraw.amount,
          {
            username: existingTrx.username,
            transactionType: "withdraw reverted",
            remark: `Withdraw ID: ${withdraw._id}`,
            processBy: "admin",
          }
        );
        if (!kioskResult.success) {
          console.error("Failed to update kiosk balance for withdraw revert");
        }
      }

      await Promise.all([
        BankList.findByIdAndUpdate(withdraw.withdrawbankid, {
          $inc: {
            currentbalance: withdraw.amount,
            totalWithdrawals: -withdraw.amount,
          },
        }),

        BankTransactionLog.create({
          bankName: bank.bankname,
          ownername: bank.ownername,
          bankAccount: bank.bankaccount,
          remark: withdraw.remark || "-",
          lastBalance: bank.currentbalance,
          currentBalance: bank.currentbalance + withdraw.amount,
          processby: "admin",
          transactiontype: "reverted withdraw",
          amount: withdraw.amount,
          qrimage: bank.qrimage,
          playerusername: updatedUser?.username || existingTrx.username,
          playerfullname: updatedUser?.fullname || "N/A",
        }),
      ]);

      console.log(
        `Transaction rejected: ${order_id}, User ${existingTrx.username} refunded ${amount}, New wallet: ${updatedUser?.wallet}`
      );
    } else {
      await easyPayModal.findByIdAndUpdate(existingTrx._id, {
        $set: { status: statusText },
      });
    }

    return res.status(200).json({ status: 1 });
  } catch (error) {
    console.error("Payment callback processing error:", {
      error: error.message,
      body: req.body,
      timestamp: moment().utc().format(),
      stack: error.stack,
    });
    return res.status(200).json({ status: 0 });
  }
});
module.exports = router;
