const mongoose = require("mongoose");
const moment = require("moment");

const slotpgsoftschema = new mongoose.Schema(
  {
    ourbetId: {
      type: String,
    },
    billId: {
      type: String,
    },
    betId: {
      type: String,
    },
    tranId: {
      type: String,
      default: null,
    },
    betamount: {
      type: Number,
    },
    settleamount: {
      type: Number,
    },
    previousSettleAmount: {
      type: Number,
    },
    betState: {
      type: Number,
    },
    settlementState: {
      type: Number,
    },
    username: {
      type: String,
    },
    bet: {
      type: Boolean,
    },
    resettle: {
      type: Boolean,
    },
    fail: {
      type: Boolean,
    },
    cancel: {
      type: Boolean,
    },
    settle: {
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

slotpgsoftschema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const SlotPGSoftModal = mongoose.model("SlotPGSoftModal", slotpgsoftschema);

module.exports = SlotPGSoftModal;
