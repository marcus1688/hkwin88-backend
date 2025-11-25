const SportsWsSportUnlimitedModal = require("../models/sport_wssportunlimited.model");
const SportsAFB1188UnlimitedModal = require("../models/sports_Afb1188unlimited.model");
const SportsCMD368UnlimitedModal = require("../models/sport_cmdunlimited.model");
const moment = require("moment");
const axios = require("axios");
const crypto = require("crypto");

const webURL = "https://www.ezwin9.com/";
const wssportAPIURL = "https://pi-api-gen.wsgamings.com";
const wssportAgentID = "AAHKNTEZW9";
const wssportSecret = process.env.WSSPORT_SECRET;

function generateturnoversignature(secretKey, agentId) {
  const rawString = `${secretKey}agentid=${agentId}`;

  return crypto.createHash("md5").update(rawString).digest("hex");
}

async function processWsSportTickets() {
  try {
    const hash = generateturnoversignature(wssportSecret, wssportAgentID);

    const startdate = moment.utc().startOf("day").format("YYYYMMDDHHmmss");
    const enddate = moment.utc().endOf("day").format("YYYYMMDDHHmmss");

    const params = new URLSearchParams({ startdate, enddate, hash });

    const response = await axios.get(
      `${wssportAPIURL}/api/SportAgent/${wssportAgentID}/Ticket?${params.toString()}`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.data.status !== "success") {
      return { success: false, error: response.data.message };
    }

    // Filter valid tickets
    const validTickets = response.data.data.filter(
      (ticket) =>
        ticket.status === "0" && ticket.tresult != null && ticket.wamt != null
    );

    // Get existing betIds to avoid duplicate queries
    const betIds = validTickets.map((t) => t.id);
    const existingBetIds = new Set(
      (
        await SportsWsSportUnlimitedModal.find(
          { betId: { $in: betIds } },
          { betId: 1 }
        )
      ).map((doc) => doc.betId)
    );

    // Prepare bulk insert data
    const ticketsToInsert = validTickets
      .filter((ticket) => !existingBetIds.has(ticket.id))
      .map((ticket) => ({
        betId: ticket.id,
        betamount: parseFloat(ticket.bamt),
        winlossamount: parseFloat(ticket.wamt),
        status: parseInt(ticket.status),
        tresult: parseInt(ticket.tresult),
        username: ticket.user.replace("AAHKNTEZW9", ""),
        claimed: false,
        disqualified: false,
      }));

    // Bulk insert
    let storedCount = 0;
    if (ticketsToInsert.length > 0) {
      await SportsWsSportUnlimitedModal.insertMany(ticketsToInsert, {
        ordered: false,
      });
      storedCount = ticketsToInsert.length;
    }

    return {
      success: true,
      total: response.data.data.length,
      stored: storedCount,
      skipped: validTickets.length - storedCount,
    };
  } catch (error) {
    console.error("Error processing WS Sport tickets:", error);
    return { success: false, error: error.message };
  }
}

const afb1188Key = process.env.AFB1188_SECRET;
const afb1188APIURL = "https://api.afb1188.net";
const afb1188AgentName = "ezwin9";

async function processAFB1188Bets() {
  try {
    const startDate = moment
      .utc()
      .startOf("days")
      .format("YYYY-MM-DD HH:mm:ss");
    const endDate = moment.utc().endOf("days").format("YYYY-MM-DD HH:mm:ss");

    const tokenRequestData = {
      companyKey: afb1188Key,
      Act: "RP_GET_CUSTOMER",
      portfolio: "sportsbook",
      startDate,
      endDate,
      lang: "EN-US",
      AgentName: afb1188AgentName,
    };

    const tokenResponse = await axios.post(
      `${afb1188APIURL}/Public/InnoExcData.ashx`,
      tokenRequestData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (tokenResponse.data.error !== "0") {
      return { success: false, error: tokenResponse.data.error };
    }

    const playerBetList = tokenResponse.data?.playerBetList || [];

    // Filter valid bets: status must be 'N' or 'A', and res must not be 'P'
    const validBets = playerBetList.filter(
      (bet) => (bet.status === "N" || bet.status === "A") && bet.res !== "P"
    );

    // Get existing betIds to avoid duplicates
    const betIds = validBets.map((b) => b.id);
    const existingBetIds = new Set(
      (
        await SportsAFB1188UnlimitedModal.find(
          { betId: { $in: betIds } },
          { betId: 1 }
        )
      ).map((doc) => doc.betId)
    );

    // Prepare bulk insert data
    const betsToInsert = validBets
      .filter((bet) => !existingBetIds.has(bet.id))
      .map((bet) => ({
        betId: bet.id,
        username: bet.u,
        betamount: parseFloat(bet.b),
        winlossamount: parseFloat(bet.w),
        status: bet.status,
        result: bet.res,
        claimed: false,
        disqualified: false,
      }));

    // Bulk insert
    let storedCount = 0;
    if (betsToInsert.length > 0) {
      const result = await SportsAFB1188UnlimitedModal.insertMany(
        betsToInsert,
        { ordered: false }
      );
      storedCount = result.length;
    }

    return {
      success: true,
      total: playerBetList.length,
      stored: storedCount,
      skipped: validBets.length - storedCount,
      filtered: playerBetList.length - validBets.length,
    };
  } catch (error) {
    console.error("Error processing AFB1188 bets:", error);
    return { success: false, error: error.message };
  }
}

const cmdAPIURL = "http://api.fts368.com/";
const cmdPartnerCode = "EZW9";
const cmdPartnerKey = process.env.CMD_TOKEN;

// async function processCMD368Bets() {
//   try {
//     const yesterdayStart = moment
//       .utc()
//       .add(8, "hours")
//       .startOf("day")
//       .subtract(1, "days")
//       .format("YYYY-MM-DD HH:mm:ss");
//     const yesterdayEnd = moment
//       .utc()
//       .add(8, "hours")
//       .endOf("day")
//       .subtract(1, "days")
//       .format("YYYY-MM-DD HH:mm:ss");

//     const todayStart = moment
//       .utc()
//       .add(8, "hours")
//       .startOf("day")
//       .format("YYYY-MM-DD HH:mm:ss");
//     const todayEnd = moment
//       .utc()
//       .add(8, "hours")
//       .endOf("day")
//       .format("YYYY-MM-DD HH:mm:ss");

//     const yesterdayResponse = await axios.get(
//       `${cmdAPIURL}/?Method=betrecordbydate&PartnerKey=${cmdPartnerKey}&TimeType=2&StartDate=${yesterdayStart}&EndDate=${yesterdayEnd}&Version=0`,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     // Fetch today's bets
//     const todayResponse = await axios.get(
//       `${cmdAPIURL}/?Method=betrecordbydate&PartnerKey=${cmdPartnerKey}&TimeType=2&StartDate=${todayStart}&EndDate=${todayEnd}&Version=0`,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     // const response = await axios.get(
//     //   `${cmdAPIURL}/?Method=betrecordbydate&PartnerKey=${cmdPartnerKey}&TimeType=2&StartDate=${startDate}&EndDate=${endDate}&Version=0`,
//     //   {
//     //     headers: {
//     //       "Content-Type": "application/json",
//     //     },
//     //   }
//     // );
//     // if (response.data.Code !== 0) {
//     //   return { success: false, error: `API Error Code: ${response.data.Code}` };
//     // }

//     if (yesterdayResponse.data.Code !== 0 || todayResponse.data.Code !== 0) {
//       return {
//         success: false,
//         error: `API Error Code: ${yesterdayResponse.data.Code} / ${todayResponse.data.Code}`,
//       };
//     }

//     // Combine both datasets
//     const yesterdayData = yesterdayResponse.data.Data || [];
//     const todayData = todayResponse.data.Data || [];
//     const betData = [...yesterdayData, ...todayData];

//     // Filter valid bets
//     const validBets = betData.filter(
//       (bet) =>
//         bet.WinLoseStatus !== "P" &&
//         bet.DangerStatus !== "C" &&
//         bet.DangerStatus !== "R" &&
//         bet.IsCashOut !== true
//     );

//     // Prepare bulk operations
//     const bulkOps = validBets.map((bet) => ({
//       updateOne: {
//         filter: { betId: bet.ReferenceNo },
//         update: {
//           $set: {
//             betId: bet.ReferenceNo,
//             username: bet.SourceName,
//             betamount: parseFloat(bet.BetAmount),
//             winlossamount: parseFloat(bet.WinAmount),
//             status: bet.WinLoseStatus,
//             result: bet.DangerStatus,
//           },
//           $setOnInsert: {
//             claimed: false,
//             disqualified: false,
//           },
//         },
//         upsert: true,
//       },
//     }));

//     let insertedCount = 0;
//     let updatedCount = 0;

//     if (bulkOps.length > 0) {
//       const result = await SportsCMD368UnlimitedModal.bulkWrite(bulkOps);
//       insertedCount = result.upsertedCount;
//       updatedCount = result.modifiedCount;
//     }

//     return {
//       success: true,
//       total: betData.length,
//       inserted: insertedCount,
//       updated: updatedCount,
//       filtered: betData.length - validBets.length,
//     };
//   } catch (error) {
//     console.error("Error processing CMD368 bets:", error);
//     return { success: false, error: error.message };
//   }
// }

async function processCMD368Bets() {
  try {
    const todayStart = moment
      .utc()
      .add(8, "hours")
      .startOf("day")
      .format("YYYY-MM-DD HH:mm:ss");
    const todayEnd = moment
      .utc()
      .add(8, "hours")
      .endOf("day")
      .format("YYYY-MM-DD HH:mm:ss");

    const todayResponse = await axios.get(
      `${cmdAPIURL}/?Method=betrecordbydate&PartnerKey=${cmdPartnerKey}&TimeType=2&StartDate=${todayStart}&EndDate=${todayEnd}&Version=0`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (todayResponse.data.Code !== 0) {
      return {
        success: false,
        error: `API Error Code: ${todayResponse.data.Code}`,
      };
    }

    const betData = todayResponse.data.Data || [];

    // Filter valid bets
    const validBets = betData.filter(
      (bet) =>
        bet.WinLoseStatus !== "P" &&
        bet.DangerStatus !== "C" &&
        bet.DangerStatus !== "R" &&
        bet.IsCashOut !== true
    );

    // Prepare bulk operations
    const bulkOps = validBets.map((bet) => ({
      updateOne: {
        filter: { betId: bet.ReferenceNo },
        update: {
          $set: {
            betId: bet.ReferenceNo,
            username: bet.SourceName,
            betamount: parseFloat(bet.BetAmount),
            winlossamount: parseFloat(bet.WinAmount),
            status: bet.WinLoseStatus,
            result: bet.DangerStatus,
          },
          $setOnInsert: {
            claimed: false,
            disqualified: false,
          },
        },
        upsert: true,
      },
    }));

    let insertedCount = 0;
    let updatedCount = 0;

    if (bulkOps.length > 0) {
      const result = await SportsCMD368UnlimitedModal.bulkWrite(bulkOps);
      insertedCount = result.upsertedCount;
      updatedCount = result.modifiedCount;
    }

    return {
      success: true,
      total: betData.length,
      inserted: insertedCount,
      updated: updatedCount,
      filtered: betData.length - validBets.length,
    };
  } catch (error) {
    console.error("Error processing CMD368 bets:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  processWsSportTickets,
  processAFB1188Bets,
  processCMD368Bets,
};
