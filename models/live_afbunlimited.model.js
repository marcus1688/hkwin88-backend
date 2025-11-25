const mongoose = require("mongoose");
const moment = require("moment");

const liveAFBUnlimitedSchema = new mongoose.Schema(
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

liveAFBUnlimitedSchema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const liveAFBUnlimitedModal = mongoose.model(
  "liveAFBUnlimitedModal",
  liveAFBUnlimitedSchema
);

module.exports = liveAFBUnlimitedModal;
