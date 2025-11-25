const mongoose = require("mongoose");
const moment = require("moment");

const sportsafb1188unlimitedSchema = new mongoose.Schema(
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
      type: String,
    },
    result: {
      type: String,
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

sportsafb1188unlimitedSchema.index(
  { createdAt: -1 },
  { expireAfterSeconds: 432000 }
);

const SportsAFB1188UnlimitedModal = mongoose.model(
  "SportsAFB1188UnlimitedModal",
  sportsafb1188unlimitedSchema
);

module.exports = SportsAFB1188UnlimitedModal;
