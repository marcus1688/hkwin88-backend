const mongoose = require("mongoose");
const moment = require("moment");

const liveevolutionschema = new mongoose.Schema(
  {
    username: {
      type: String,
    },
    betId: {
      type: String,
    },
    settleId: {
      type: String,
    },
    cancelId: {
      type: String,
    },
    promoId: {
      type: String,
    },
    tranId: {
      type: String,
      default: null,
    },
    gameId: {
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

liveevolutionschema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const LiveEvolutionModal = mongoose.model(
  "LiveEvolutionModal",
  liveevolutionschema
);

module.exports = LiveEvolutionModal;
