const mongoose = require("mongoose");
const moment = require("moment");

const afbSequenceSchema = new mongoose.Schema(
  {
    lastSequenceId: {
      type: String,
      default: "0",
    },
  },
  {
    timestamps: {
      currentTime: () => moment().utc().toDate(),
    },
  }
);

const AFBSequence = mongoose.model("AFBSequence", afbSequenceSchema);

module.exports = AFBSequence;
