const mongoose = require("mongoose");
const moment = require("moment");

const liveafbschema = new mongoose.Schema(
  {
    username: {
      type: String,
    },
    betId: {
      type: String,
    },
    tipId: {
      type: String,
    },
    winLossId: {
      type: String,
    },
    uuid: {
      type: String,
    },
    modifyuuid: {
      type: String,
    },
    betStatus: {
      type: String,
    },
    tranId: {
      type: String,
      default: null,
    },
    betamount: {
      type: Number,
    },
    tipamount: {
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
    tip: {
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

liveafbschema.index({ createdAt: -1 }, { expireAfterSeconds: 172800 });

const LiveAFBModal = mongoose.model("LiveAFBModal", liveafbschema);

module.exports = LiveAFBModal;
