const mongoose = require("mongoose");
const moment = require("moment");

const slotkagamingSchema = new mongoose.Schema(
  {
    transId: {
      type: String,
    },
    betId: {
      type: String,
    },
    settleId: {
      type: String,
    },
    username: {
      type: String,
    },
    betamount: {
      type: Number,
    },
    settleamount: {
      type: Number,
    },

    bet: {
      type: Boolean,
    },
    cancel: {
      type: Boolean,
    },
    bonus: {
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

slotkagamingSchema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const SlotKaGamingModal = mongoose.model(
  "SlotKaGamingModal",
  slotkagamingSchema
);

module.exports = SlotKaGamingModal;
