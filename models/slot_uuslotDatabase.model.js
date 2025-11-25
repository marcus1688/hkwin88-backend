const mongoose = require("mongoose");
const moment = require("moment");

const GameUUSLOTDataSchema = new mongoose.Schema(
  {
    gameNameEN: {
      type: String,
    },
    gameNameCN: {
      type: String,
    },
    gameNameHK: {
      type: String,
    },
    imageUrlEN: {
      type: String,
    },
    gameID: {
      type: String,
    },
    gameType: {
      type: String,
    },
    rtpRate: {
      type: String,
    },
    imageUrlCN: {
      type: String,
    },
    hot: {
      type: Boolean,
      default: false,
    },
    maintenance: {
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

GameUUSLOTDataSchema.index({ createdAt: -1 });

const GameUUSLOTGameModal = mongoose.model(
  "GameUUSLOTGameModal",
  GameUUSLOTDataSchema
);

module.exports = GameUUSLOTGameModal;
