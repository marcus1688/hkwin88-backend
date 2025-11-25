const mongoose = require("mongoose");
const moment = require("moment");

const liveWMCasinoUnlimitedSchema = new mongoose.Schema(
  {
    username: {
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
    betId: {
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
      currentTime: () => moment().utc().toDate(),
    },
  }
);

liveWMCasinoUnlimitedSchema.index(
  { createdAt: -1 },
  { expireAfterSeconds: 172800 }
);

const liveWMCasinoUnlimitedModal = mongoose.model(
  "liveWMCasinoUnlimitedModal",
  liveWMCasinoUnlimitedSchema
);

module.exports = liveWMCasinoUnlimitedModal;
