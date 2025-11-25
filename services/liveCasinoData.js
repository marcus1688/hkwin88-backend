const liveWMCasinoUnlimitedModal = require("../models/live_wmcasinounlimited.model");
const liveAFBUnlimitedModal = require("../models/live_afbunlimited.model");
const AFBSequence = require("../models/live_afbsequence.model");

const moment = require("moment");
const axios = require("axios");
const crypto = require("crypto");

const wmVendorID = "e9hkdapi";
const wmSecret = process.env.WMCASINO_SECRET;
const wmAPIURL = "https://liwb-019.wmapi99.com/api/wallet/Gateway.php";

async function processWMCasinoRecords() {
  try {
    const todayStart = moment
      .utc()
      .add(8, "hours")
      .startOf("day")
      .format("YYYYMMDDHHmmss");
    const todayEnd = moment.utc().add(8, "hours").format("YYYYMMDDHHmmss");

    const launchTimestamp = Math.floor(Date.now() / 1000);

    const launchParams = new URLSearchParams({
      cmd: "GetDateTimeReport",
      vendorId: wmVendorID,
      signature: wmSecret,
      startTime: todayStart,
      endTime: todayEnd,
      timestamp: launchTimestamp,
      timetype: 1,
      datatype: 0,
    });

    const launchResponse = await axios.post(
      `${wmAPIURL}?${launchParams.toString()}`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (launchResponse.data.errorCode !== 0) {
      return {
        success: false,
        error: `Error ${launchResponse.data.errorCode}: ${launchResponse.data.errorMessage}`,
      };
    }

    const recordData = launchResponse.data.result || [];

    // Get existing betIds to avoid duplicates
    const betIds = recordData.map((r) => r.betId);
    const existingBetIds = new Set(
      (
        await liveWMCasinoUnlimitedModal.find(
          { betId: { $in: betIds } },
          { betId: 1 }
        )
      ).map((doc) => doc.betId)
    );

    // Prepare bulk operations
    const bulkOps = recordData
      .filter((record) => !existingBetIds.has(record.betId))
      .map((record) => ({
        insertOne: {
          document: {
            username: record.user,
            betId: record.betId,
            betamount: parseFloat(record.validbet),
            settleamount: parseFloat(record.result),
            roundId: record.round,
            claimed: false,
            disqualified: false,
          },
        },
      }));

    let insertedCount = 0;

    if (bulkOps.length > 0) {
      const result = await liveWMCasinoUnlimitedModal.bulkWrite(bulkOps);
      insertedCount = result.insertedCount;
    }

    return {
      success: true,
      total: recordData.length,
      inserted: insertedCount,
      skipped: recordData.length - insertedCount,
    };
  } catch (error) {
    console.error("Error processing WM Casino records:", error);
    return { success: false, error: error.message };
  }
}

const afbAPIURL = "https://wfapi.gm10066.com/afbapiwflive/app/api.do";
const afbSecret = process.env.AFB_LIVE_SECRET;
const afbSiteCode = "ezwin9";

async function processAFBRecords() {
  try {
    let sequenceDoc = await AFBSequence.findOne();
    if (!sequenceDoc) {
      sequenceDoc = await AFBSequence.create({ lastSequenceId: "0" });
    }

    const requestData = {
      hashCode: afbSecret,
      command: "GET_RECORD_BY_SEQUENCENO",
      params: {
        count: "1000",
        beginId: sequenceDoc.lastSequenceId,
      },
    };

    const response = await axios.post(afbAPIURL, requestData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.data.errorCode !== 0) {
      return {
        success: false,
        error: `Error ${response.data.errorCode}: ${response.data.errorMessage}`,
      };
    }

    const recordData = response.data.params?.recordList || [];

    // Get existing betIds to avoid duplicates
    const betIds = recordData.map((r) => String(r.id));
    const existingBetIds = new Set(
      (
        await liveAFBUnlimitedModal.find(
          { betId: { $in: betIds } },
          { betId: 1 }
        )
      ).map((doc) => doc.betId)
    );

    // Prepare bulk operations
    const bulkOps = recordData
      .filter((record) => !existingBetIds.has(String(record.id)))
      .map((record) => ({
        insertOne: {
          document: {
            username: record.userName,
            betId: String(record.id),
            betamount: parseFloat(record.validStake),
            settleamount: parseFloat(record.winLoss),
            roundId: record.issueNo,
            claimed: false,
            disqualified: false,
          },
        },
      }));

    let insertedCount = 0;

    if (bulkOps.length > 0) {
      const result = await liveAFBUnlimitedModal.bulkWrite(bulkOps);
      insertedCount = result.insertedCount;
    }

    const maxSequenceId = Math.max(...recordData.map((r) => r.sequenceNo));

    if (maxSequenceId !== -Infinity && !isNaN(maxSequenceId)) {
      await AFBSequence.findOneAndUpdate(
        {},
        { lastSequenceId: String(maxSequenceId) },
        { upsert: true }
      );
    }

    return {
      success: true,
      total: recordData.length,
      inserted: insertedCount,
      skipped: recordData.length - insertedCount,
    };
  } catch (error) {
    console.error("Error processing AFB records:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  processWMCasinoRecords,
  processAFBRecords,
};
