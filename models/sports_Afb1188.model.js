const mongoose = require("mongoose");
const moment = require("moment");

const sportAfb1188schema = new mongoose.Schema(
  {
    betId: {
      type: String,
    },
    settleId: {
      type: String,
      default: null,
    },
    tranId: {
      type: String,
    },
    cancelId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["D", "N", "A", "R", "C", "RG", "RP", "RR"],
      default: "A",
    },
    matchstats: {
      type: String,
      enum: ["P", "WA", "LA", "WH", "LH", "D"],
      default: "P",
    },
    betamount: {
      type: Number,
    },
    settleamount: {
      type: Number,
    },
    lastWinlose: {
      type: Number,
      default: null, // Store the last winlose amount for calculations
    },
    originalSettlement: {
      type: Number,
      default: null, // Store the first settlement amount for reference
    },
    username: {
      type: String,
    },
    dangerous: {
      type: Boolean,
    },
    bet: {
      type: Boolean,
    },
    cancel: {
      type: Boolean,
    },
    cancelroute: {
      type: Boolean,
    },
    settle: {
      type: Boolean,
      default: false,
    },
    cancelSettled: {
      type: Boolean,
      default: false,
    },
    claimed: {
      type: Boolean,
      default: false,
    },
    disqualified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      currentTime: () => moment().utc().toDate(), // Ensure timestamps are stored in UTC
    },
  }
);

sportAfb1188schema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const SportAFB1188Modal = mongoose.model(
  "SportAFB1188Modal",
  sportAfb1188schema
);

module.exports = SportAFB1188Modal;
