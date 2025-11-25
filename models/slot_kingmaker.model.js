const mongoose = require("mongoose");
const moment = require("moment");

const slotkingmakerschema = new mongoose.Schema(
  {
    username: {
      type: String,
    },
    betamount: {
      type: Number,
    },
    settleamount: {
      type: Number,
    },
    opSettleId: {
      type: String,
    },
    opBetId: {
      type: String,
    },
    betId: {
      type: String,
    },
    status: {
      type: String,
      default: null,
    },
    bet: {
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

slotkingmakerschema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const SlotKingMakerModal = mongoose.model(
  "SlotKingMakerModal",
  slotkingmakerschema
);

module.exports = SlotKingMakerModal;
