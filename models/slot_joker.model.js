const mongoose = require("mongoose");
const moment = require("moment");

const slotJokerschema = new mongoose.Schema(
  {
    betId: {
      type: String,
    },
    beganbalance: {
      type: Number,
    },
    endbalance: {
      type: Number,
    },
    gameName: {
      type: String,
    },
    betamount: {
      type: Number,
    },
    settleamount: {
      type: Number,
    },
    username: {
      type: String,
    },
    bet: {
      type: Boolean,
    },
    settle: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    claimed: {
      type: Boolean,
      default: false,
    },
    disqualified: {
      type: Boolean,
      default: false,
    },
    betTime: {
      type: Date,
    },
  },
  {
    timestamps: {
      currentTime: () => moment().utc().toDate(), // Ensure timestamps are stored in UTC
    },
  }
);

slotJokerschema.index({ createdAt: -1 }, { expireAfterSeconds: 7876000 });

const slotJokerModal = mongoose.model("slotJokerModal", slotJokerschema);

module.exports = slotJokerModal;
