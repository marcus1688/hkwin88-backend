const mongoose = require("mongoose");
const moment = require("moment");

const otherHorsebookSchema = new mongoose.Schema(
  {
    username: {
      type: String,
    },
    platform: {
      type: String,
    },
    roundId: {
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
    settle: {
      type: Boolean,
    },
    cancel: {
      type: Boolean,
    },
    adjusted: {
      type: Boolean,
    },
    void: {
      type: Boolean,
    },
    refunded: {
      type: Boolean,
    },
    freespin: {
      type: Boolean,
    },
    promo: {
      type: Boolean,
    },
    resettle: {
      type: Boolean,
    },
    tip: {
      type: Boolean,
    },
    cancelTip: {
      type: Boolean,
    },
    remark: {
      type: String,
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

otherHorsebookSchema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const otherHorsebookModal = mongoose.model(
  "otherHorsebookModal",
  otherHorsebookSchema
);

module.exports = otherHorsebookModal;
