const mongoose = require("mongoose");
const moment = require("moment");

const sportswssportunlimitedSchema = new mongoose.Schema(
  {
    betId: {
      type: String,
    },

    betamount: {
      type: Number,
    },
    winlossamount: {
      type: Number,
    },
    status: {
      type: Number,
    },
    tresult: {
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

sportswssportunlimitedSchema.index(
  { createdAt: -1 },
  { expireAfterSeconds: 432000 }
);

const SportsWsSportUnlimitedModal = mongoose.model(
  "SportsWsSportUnlimitedModal",
  sportswssportunlimitedSchema
);

module.exports = SportsWsSportUnlimitedModal;
