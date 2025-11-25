const mongoose = require("mongoose");
const moment = require("moment");

const sportswssportSchema = new mongoose.Schema(
  {
    betId: {
      type: String,
    },
    transId: {
      type: String,
    },
    betamount: {
      type: Number,
    },
    settleamount: {
      type: Number,
    },
    status: {
      type: Number,
    },
    resultStatus: {
      type: Number,
    },
    resultTransId: {
      type: String,
    },
    rollbackStatus: {
      type: Number,
    },
    rollbackTransId: {
      type: String,
    },
    rollbackamount: {
      type: Number,
    },
    cancelStatus: {
      type: Number,
    },
    cancelTransId: {
      type: String,
    },
    cancelamount: {
      type: Number,
    },
    username: {
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

sportswssportSchema.index({ createdAt: -1 }, { expireAfterSeconds: 432000 });

const SportsWsSportModal = mongoose.model(
  "SportsWsSportModal",
  sportswssportSchema
);

module.exports = SportsWsSportModal;
