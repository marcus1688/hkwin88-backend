const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const { authenticateToken } = require("../../auth/auth");
const { authenticateAdminToken } = require("../../auth/adminAuth");
const {
  User,
  adminUserWalletLog,
  GameDataLog,
} = require("../../models/users.model");
const { v4: uuidv4 } = require("uuid");
const querystring = require("querystring");
const moment = require("moment");
const { adminUser, adminLog } = require("../../models/adminuser.model");
const Bonus = require("../../models/bonus.model");
const UserWalletLog = require("../../models/userwalletlog.model");
const Deposit = require("../../models/deposit.model");
const Promotion = require("../../models/promotion.model");

const SlotLivePPModal = require("../../models/slot_live_pp_model");
const liveWMCasinoModal = require("../../models/live_wmcasino.model");
const SlotLiveMicroGamingModal = require("../../models/slot_live_microgaming.model");
const LiveWeCasinoModal = require("../../models/live_wecasino.model");
const SlotApolloModal = require("../../models/slot_apollo.model");
const LiveYeebetModal = require("../../models/live_yeebet.model");
const SlotCQ9Modal = require("../../models/slot_cq9.model");
const SlotFachaiModal = require("../../models/slot_fachai.model");
const SlotFunkyModal = require("../../models/slot_funky.model");
const SlotHabaneroModal = require("../../models/slot_habanero.model");
const SlotJDBModal = require("../../models/slot_jdb.model");
const SlotJiliModal = require("../../models/slot_jili.model");
const SlotJokerModal = require("../../models/slot_joker.model");
const SlotLive22Modal = require("../../models/slot_live22.model");
const SlotSpadeGamingModal = require("../../models/slot_spadegaming.model");
const SportCMDModal = require("../../models/sport_cmd.model");
const SportsWsSportModal = require("../../models/sport_wssport.model");
const SportAFB1188Modal = require("../../models/sports_Afb1188.model");
const ESportIAGamingModal = require("../../models/esport_iagaming.model");
const EsportTfGamingModal = require("../../models/esport_tfgaming.model");
const otherHorsebookModal = require("../../models/other_horsebook.model");
const SlotClotplayModal = require("../../models/slot_clotplay.model");
const SlotEpicWinModal = require("../../models/slot_epicwin.model");
const OtherVGModal = require("../../models/other_vg.model");
const LiveAFBModal = require("../../models/live_afb.model");
const LiveEvolutionModal = require("../../models/live_evolution.model");
const SlotBNGModal = require("../../models/slot_bng.model");
const SlotKaGamingModal = require("../../models/slot_kagaming.model");
const SlotPegasusModal = require("../../models/slot_pegasus.model");
const SlotUUSlotModal = require("../../models/slot_uuslot.model");
const SlotKingMakerModal = require("../../models/slot_kingmaker.model");
const SlotLiveGSCModal = require("../../models/slot_live_gsc.model");
const SportsWsSportUnlimitedModal = require("../../models/sport_wssportunlimited.model");
const SportsAFB1188UnlimitedModal = require("../../models/sports_Afb1188unlimited.model");
const SportsCMD368UnlimitedModal = require("../../models/sport_cmdunlimited.model");
const SlotPGSoftModal = require("../../models/slot_pgsoft.model");
const liveSexybcrtModal = require("../../models/live_sexybcrt.model");

const liveWMCasinoUnlimitedModal = require("../../models/live_wmcasinounlimited.model");
const liveAFBUnlimitedModal = require("../../models/live_afbunlimited.model");

const InstantRebate = require("../../models/instantrebate.model");

require("dotenv").config();

const createRebateRecord = async (
  player,
  categories,
  totalCommission,
  username,
  isError = false,
  errorReason = null
) => {
  try {
    // Build formula string with parentheses for multiple parts
    const livePart =
      player.gameBreakdown["Live Casino"] > 0
        ? `(${player.gameBreakdown["Live Casino"]} * 0.01)`
        : "";
    const sportsPart =
      player.gameBreakdown["Sports"] > 0
        ? `(${player.gameBreakdown["Sports"]} * 0.02)`
        : "";
    const othersPart =
      player.gameBreakdown["Others"] > 0
        ? `(${player.gameBreakdown["Others"]} * 0.009)`
        : "";

    const formulaParts = [livePart, sportsPart, othersPart].filter(
      (part) => part !== ""
    );
    const formula =
      formulaParts.length > 0
        ? `${formulaParts.join(" + ")} = ${totalCommission.toFixed(2)}`
        : "0 = 0.00";

    // Prepare live category games data
    const liveGames = [];
    categories["Live Casino"].games.forEach((game) => {
      const playerInGame = game.playerData.find(
        (p) => p.username === player.username
      );
      if (playerInGame && playerInGame.turnover > 0) {
        liveGames.push({
          gameName: game.gameName,
          totalTurnover: playerInGame.turnover,
        });
      }
    });

    // Prepare sports category games data
    const sportsGames = [];
    categories["Sports"].games.forEach((game) => {
      const playerInGame = game.playerData.find(
        (p) => p.username === player.username
      );
      if (playerInGame && playerInGame.turnover > 0) {
        sportsGames.push({
          gameName: game.gameName,
          totalTurnover: playerInGame.turnover,
        });
      }
    });

    // Prepare others category games data
    const othersGames = [];
    categories["Others"].games.forEach((game) => {
      const playerInGame = game.playerData.find(
        (p) => p.username === player.username
      );
      if (playerInGame && playerInGame.turnover > 0) {
        othersGames.push({
          gameName: game.gameName,
          totalTurnover: playerInGame.turnover,
        });
      }
    });

    const rebateData = new InstantRebate({
      timeCalled: new Date(),
      username: isError ? `Invalid User (${username})` : username,
      live: {
        games: liveGames,
      },
      sports: {
        games: sportsGames,
      },
      others: {
        games: othersGames,
      },
      totalCommission: totalCommission,
      formula: isError ? `${formula} - ERROR: ${errorReason}` : formula,
      grandTotalTurnover: player.totalTurnover,
      processed: !isError,
    });

    await rebateData.save();
    console.log(
      `InstantRebate record saved for ${username} ${
        isError ? "(ERROR)" : "(SUCCESS)"
      }`
    );

    return rebateData._id;
  } catch (rebateError) {
    console.error(`Error saving rebate data for ${username}:`, rebateError);
    throw rebateError;
  }
};

const checkUserQualification = async (userId) => {
  try {
    console.log(`Checking qualification for user: ${userId}`);

    // Get user's deposits and bonuses with proper filtering
    const [deposits, bonuses] = await Promise.all([
      Deposit.find({
        userId,
        status: "approved",
        reverted: false,
      }).sort({ createdAt: -1 }),
      Bonus.find({
        userId,
        status: "approved",
        reverted: false,
      }).sort({ createdAt: -1 }),
    ]);

    console.log(
      `User ${userId}: Found ${deposits.length} deposits, ${bonuses.length} bonuses`
    );

    // If no approved deposits found, user is disqualified
    if (!deposits || deposits.length === 0) {
      console.log(`User ${userId}: Disqualified - No approved deposits found`);
      return {
        qualified: false,
        disqualifyFromDate: new Date(0),
        reason: "No approved deposits found",
      };
    }

    // If no bonuses found, user is qualified from first deposit
    if (!bonuses || bonuses.length === 0) {
      console.log(
        `User ${userId}: Qualified - No bonuses claimed, qualify from ${deposits[0].createdAt}`
      );
      return {
        qualified: true,
        qualifyFromDate: deposits[0].createdAt, // Latest deposit
        reason: "No bonuses claimed",
      };
    }

    // Find deposits that are linked to bonuses
    const linkedDepositIds = new Set(
      bonuses.filter((bonus) => bonus.depositId).map((bonus) => bonus.depositId)
    );

    console.log(
      `User ${userId}: Linked deposit IDs: [${Array.from(linkedDepositIds).join(
        ", "
      )}]`
    );

    // Find the latest pure deposit (not linked to any bonus)
    const latestPureDeposit = deposits.find(
      (deposit) => !linkedDepositIds.has(deposit.transactionId)
    );

    console.log(
      `User ${userId}: Latest pure deposit: ${
        latestPureDeposit
          ? `${latestPureDeposit.transactionId} at ${latestPureDeposit.createdAt}`
          : "None found"
      }`
    );

    // If no pure deposit found, user is disqualified
    if (!latestPureDeposit) {
      console.log(
        `User ${userId}: Disqualified - All deposits are linked to bonuses`
      );
      return {
        qualified: false,
        disqualifyFromDate: new Date(0),
        reason: "All deposits are linked to bonuses",
      };
    }

    // Find the latest bonus that affects this user
    const latestBonus = bonuses[0]; // Most recent bonus

    console.log(
      `User ${userId}: Latest bonus: ${
        latestBonus
          ? `${latestBonus.transactionId} at ${latestBonus.createdAt}`
          : "None"
      }`
    );

    // If latest pure deposit is more recent than any bonus activity, qualify
    if (!latestBonus || latestPureDeposit.createdAt > latestBonus.createdAt) {
      console.log(
        `User ${userId}: Qualified - Pure deposit without linked bonus, qualify from ${latestPureDeposit.createdAt}`
      );
      return {
        qualified: true,
        qualifyFromDate: latestPureDeposit.createdAt,
        reason: "Pure deposit without linked bonus",
      };
    }

    // If there's bonus activity after the latest pure deposit, disqualify from bonus date
    console.log(
      `User ${userId}: Disqualified - Bonus claimed after latest pure deposit`
    );
    return {
      qualified: false,
      disqualifyFromDate: latestBonus.createdAt,
      reason: "Bonus claimed after latest pure deposit",
    };
  } catch (error) {
    console.error(`Error checking user qualification for ${userId}:`, error);
    return {
      qualified: false,
      disqualifyFromDate: new Date(0),
      reason: "Error checking qualification",
    };
  }
};

router.post("/api/all/categorizedgamedata", async (req, res) => {
  try {
    console.log("\n==========================================");
    console.log("🚀 Starting categorized game data processing...");
    console.log("==========================================\n");

    const getCategorizedGameData = async (
      Model,
      aggregation,
      category,
      gameName
    ) => {
      try {
        console.log(`\n=== Processing ${gameName} in ${category} ===`);

        const isJokerGame = gameName.toLowerCase().includes("joker");
        const isWeCasinoGame = gameName.toLowerCase().includes("we casino");

        const gameUsers = await Model.distinct("username", {
          ...aggregation.$match,
          $and: [{ claimed: false }, { disqualified: false }],
        });

        console.log(`Found ${gameUsers.length} unique users in ${gameName}`);

        const normalizedUsernames = [
          ...new Set(
            gameUsers.map((username) =>
              username.toUpperCase().replace(/2[xX]$/, "")
            )
          ),
        ];
        console.log(
          `${normalizedUsernames.length} normalized unique usernames in ${gameName}`
        );

        const users = await User.find({
          gameId: { $in: normalizedUsernames },
        }).select("_id gameId");

        console.log(
          `Found ${users.length} matching users in User collection for ${gameName}`
        );

        const qualificationResults = await Promise.all(
          users.map(async (user) => {
            const qualification = await checkUserQualification(user._id);
            console.log(
              `User ${user.gameId}: ${
                qualification.qualified ? "Qualified" : "Disqualified"
              } - ${qualification.reason}`
            );

            return {
              userId: user._id,
              gameId: user.gameId,
              normalizedGameId: user.gameId.toUpperCase().replace(/2[xX]$/, ""),
              ...qualification,
            };
          })
        );

        const qualificationMap = new Map();
        qualificationResults.forEach((result) => {
          qualificationMap.set(result.normalizedGameId, result);
        });

        console.log(
          `Qualification map created with ${qualificationMap.size} entries for ${gameName}`
        );

        const turnoverCalculation = isJokerGame
          ? {
              $add: [
                { $ifNull: ["$betamount", 0] },
                { $ifNull: ["$fishTurnover", 0] },
              ],
            }
          : isWeCasinoGame
          ? {
              $ifNull: [{ $ifNull: ["$validbetamount", "$betamount"] }, 0],
            }
          : { $ifNull: ["$betamount", 0] };

        console.log(
          `${gameName}: Using ${
            isJokerGame
              ? "betamount + fishturnover"
              : isWeCasinoGame
              ? "validbetamount (fallback to betamount)"
              : "betamount only"
          } for turnover calculation`
        );

        const pipeline = [
          {
            $match: {
              ...aggregation.$match,
              claimed: false,
              disqualified: false,
            },
          },
          {
            $addFields: {
              normalizedUsername: {
                $toUpper: {
                  $cond: {
                    if: {
                      $regexMatch: { input: "$username", regex: /2[xX]$/ },
                    },
                    then: {
                      $substr: [
                        "$username",
                        0,
                        { $subtract: [{ $strLenCP: "$username" }, 2] },
                      ],
                    },
                    else: "$username",
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: "$normalizedUsername",
              // turnover: { $sum: { $ifNull: ["$betamount", 0] } },
              turnover: { $sum: turnoverCalculation },
              documentIds: { $push: "$_id" },
              records: {
                $push: {
                  id: "$_id",
                  createdAt: "$createdAt",
                  betamount: "$betamount",
                  turnoverAmount: turnoverCalculation,
                },
              },
            },
          },
          {
            $group: {
              _id: null,
              totalTurnover: { $sum: "$turnover" },
              playerData: {
                $push: {
                  username: "$_id",
                  turnover: "$turnover",
                  documentIds: "$documentIds",
                  records: "$records",
                },
              },
              allDocumentIds: { $push: "$documentIds" },
            },
          },
          {
            $addFields: {
              allDocumentIds: {
                $reduce: {
                  input: "$allDocumentIds",
                  initialValue: [],
                  in: { $concatArrays: ["$$value", "$$this"] },
                },
              },
            },
          },
        ];

        console.log(`Running aggregation pipeline for ${gameName}...`);
        const result = await Model.aggregate(pipeline);
        const data = result[0] || {
          totalTurnover: 0,
          playerData: [],
          allDocumentIds: [],
        };

        console.log(
          `Raw data from ${gameName}: ${data.playerData.length} players, total turnover: ${data.totalTurnover}`
        );

        // Process each player's records based on qualification
        const qualifiedPlayerData = [];
        const disqualificationPromises = [];

        for (const player of data.playerData) {
          console.log(`\n--- Processing player: ${player.username} ---`);
          const qualification = qualificationMap.get(player.username);

          if (!qualification) {
            console.log(`❌ No qualification found for ${player.username}`);
            disqualificationPromises.push(
              Model.updateMany(
                { _id: { $in: player.documentIds } },
                { $set: { disqualified: true } }
              )
            );
            continue;
          }

          if (!qualification.qualified) {
            console.log(
              `❌ Player ${player.username} not qualified: ${qualification.reason}`
            );
            disqualificationPromises.push(
              Model.updateMany(
                { _id: { $in: player.documentIds } },
                { $set: { disqualified: true } }
              )
            );
            continue;
          }

          console.log(
            `✅ Player ${player.username} qualified from ${qualification.qualifyFromDate}`
          );

          // Player is qualified - filter records by qualification date
          const qualifyFromDate = new Date(qualification.qualifyFromDate);
          const qualifiedRecords = player.records.filter(
            (record) => new Date(record.createdAt) >= qualifyFromDate
          );

          const disqualifiedRecords = player.records.filter(
            (record) => new Date(record.createdAt) < qualifyFromDate
          );

          console.log(
            `Player ${player.username}: ${qualifiedRecords.length} qualified records, ${disqualifiedRecords.length} disqualified records`
          );

          // Update disqualified records
          if (disqualifiedRecords.length > 0) {
            const disqualifiedIds = disqualifiedRecords.map((r) => r.id);
            console.log(
              `Marking ${disqualifiedIds.length} records as disqualified for ${player.username}`
            );
            disqualificationPromises.push(
              Model.updateMany(
                { _id: { $in: disqualifiedIds } },
                { $set: { disqualified: true } }
              )
            );
          }

          // Only include player if they have qualified records
          if (qualifiedRecords.length > 0) {
            const qualifiedTurnover = qualifiedRecords.reduce(
              (sum, record) => sum + (record.turnoverAmount || 0),
              0
            );
            const qualifiedDocumentIds = qualifiedRecords.map((r) => r.id);

            console.log(
              `Player ${player.username}: Qualified turnover = ${qualifiedTurnover}`
            );

            qualifiedPlayerData.push({
              username: player.username,
              turnover: qualifiedTurnover,
              documentIds: qualifiedDocumentIds,
              qualificationInfo: qualification,
            });
          } else {
            console.log(
              `Player ${player.username}: No qualified records found`
            );
          }
        }

        // Execute all disqualification updates
        console.log(
          `Executing ${disqualificationPromises.length} disqualification updates...`
        );
        await Promise.all(disqualificationPromises);

        // Recalculate total with qualified data only
        const qualifiedTotalTurnover = qualifiedPlayerData.reduce(
          (sum, player) => sum + player.turnover,
          0
        );

        console.log(
          `${gameName} final results: ${qualifiedPlayerData.length} qualified players, total turnover: ${qualifiedTotalTurnover}`
        );

        return {
          category,
          gameName,
          model: Model,
          totalTurnover: qualifiedTotalTurnover,
          playerData: qualifiedPlayerData,
          allDocumentIds: data.allDocumentIds || [],
          qualificationResults: qualificationResults,
        };
      } catch (error) {
        console.error(`❌ Error fetching data for ${gameName}:`, error);
        return {
          category,
          gameName,
          model: Model,
          totalTurnover: 0,
          playerData: [],
          allDocumentIds: [],
          qualificationResults: [],
        };
      }
    };

    const aggregations = {
      ppLive: {
        $match: {
          refunded: false,
          ended: true,
          gameType: "Live",
        },
      },
      wmcasino: {
        $match: {},
      },
      microgamingSlot: {
        $match: {
          cancel: { $ne: true },
          settle: true,
          gameType: "SLOT",
        },
      },
      microgamingLive: {
        $match: {
          cancel: { $ne: true },
          settle: true,
          gameType: "LIVE",
        },
      },
      wecasino: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
      },
      yeebet: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
      },
      evolution: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
      },
      afblive: {
        $match: {},
      },
      // Sports aggregations
      cmd368: {
        $match: {},
      },
      wssport: {
        $match: {},
      },
      afb1188: {
        $match: {},
      },
      iagaming: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      tfgaming: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
      },
      horsebook: {
        $match: {
          platform: "HORSEBOOK",
          $and: [
            { $or: [{ cancel: false }, { cancel: { $exists: false } }] },
            { $or: [{ void: false }, { void: { $exists: false } }] },
            { $or: [{ refunded: false }, { refunded: { $exists: false } }] },
            { $or: [{ tip: false }, { tip: { $exists: false } }] },
          ],
          remark: { $ne: "Tip has been cancelled" },
        },
      },
      // Others aggregations
      apollo: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      ppSlot: {
        $match: {
          refunded: false,
          ended: true,
          gameType: "Slot",
        },
      },
      cq9: {
        $match: {
          cancel: { $ne: true },
          refund: { $ne: true },
          settle: true,
        },
      },
      fachai: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      funky: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      habanero: {
        $match: {
          refund: { $ne: true },
          settle: true,
        },
      },
      jdb: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      jili: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      joker: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      live22: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      spadegaming: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      clotplay: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      epicwin: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      vgqipai: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      bng: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      kagaming: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      pegasus: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      uuslot: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      kingmaker: {
        $match: {},
      },
      gsc: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      pgslot: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
      },
      sexybcrt: {
        $match: {
          platform: "SEXYBCRT",
          $and: [
            { $or: [{ cancel: false }, { cancel: { $exists: false } }] },
            { $or: [{ void: false }, { void: { $exists: false } }] },
            { $or: [{ refunded: false }, { refunded: { $exists: false } }] },
            { $or: [{ tip: false }, { tip: { $exists: false } }] },
          ],
          remark: { $ne: "Tip has been cancelled" },
        },
      },
    };

    console.log("📊 Starting parallel execution of all game queries...");

    // Execute all queries in parallel
    const promiseResults = await Promise.allSettled([
      getCategorizedGameData(
        SlotLivePPModal,
        aggregations.ppLive,
        "Live Casino",
        "PP Live"
      ),
      getCategorizedGameData(
        liveWMCasinoUnlimitedModal,
        aggregations.wmcasino,
        "Live Casino",
        "WM Casino"
      ),
      getCategorizedGameData(
        SlotLiveMicroGamingModal,
        aggregations.microgamingSlot,
        "Others",
        "Microgaming Slot"
      ),
      getCategorizedGameData(
        SlotLiveMicroGamingModal,
        aggregations.microgamingLive,
        "Live Casino",
        "Microgaming Live"
      ),
      getCategorizedGameData(
        LiveWeCasinoModal,
        aggregations.wecasino,
        "Live Casino",
        "We Casino"
      ),
      getCategorizedGameData(
        LiveYeebetModal,
        aggregations.yeebet,
        "Live Casino",
        "Yeebet"
      ),
      getCategorizedGameData(
        LiveEvolutionModal,
        aggregations.evolution,
        "Live Casino",
        "Evolution"
      ),
      getCategorizedGameData(
        liveAFBUnlimitedModal,
        aggregations.afblive,
        "Live Casino",
        "AFB Live"
      ),
      // Sports
      getCategorizedGameData(
        SportsCMD368UnlimitedModal,
        aggregations.cmd368,
        "Sports",
        "CMD368"
      ),
      getCategorizedGameData(
        SportsWsSportUnlimitedModal,
        aggregations.wssport,
        "Sports",
        "WS Sport"
      ),
      getCategorizedGameData(
        SportsAFB1188UnlimitedModal,
        aggregations.afb1188,
        "Sports",
        "AFB1188"
      ),
      getCategorizedGameData(
        ESportIAGamingModal,
        aggregations.iagaming,
        "Sports",
        "IA Gaming"
      ),
      getCategorizedGameData(
        EsportTfGamingModal,
        aggregations.tfgaming,
        "Sports",
        "TF Gaming"
      ),
      getCategorizedGameData(
        otherHorsebookModal,
        aggregations.horsebook,
        "Sports",
        "Horsebook"
      ),
      // Others
      getCategorizedGameData(
        SlotApolloModal,
        aggregations.apollo,
        "Others",
        "Apollo"
      ),
      getCategorizedGameData(
        SlotLivePPModal,
        aggregations.ppSlot,
        "Others",
        "PP Slot"
      ),
      getCategorizedGameData(SlotCQ9Modal, aggregations.cq9, "Others", "CQ9"),
      getCategorizedGameData(
        SlotFachaiModal,
        aggregations.fachai,
        "Others",
        "Fachai"
      ),
      getCategorizedGameData(
        SlotFunkyModal,
        aggregations.funky,
        "Others",
        "Funky"
      ),
      getCategorizedGameData(
        SlotHabaneroModal,
        aggregations.habanero,
        "Others",
        "Habanero"
      ),
      getCategorizedGameData(SlotJDBModal, aggregations.jdb, "Others", "JDB"),
      getCategorizedGameData(
        SlotJiliModal,
        aggregations.jili,
        "Others",
        "Jili"
      ),
      getCategorizedGameData(
        SlotJokerModal,
        aggregations.joker,
        "Others",
        "Joker"
      ),
      getCategorizedGameData(
        SlotLive22Modal,
        aggregations.live22,
        "Others",
        "Live22"
      ),
      getCategorizedGameData(
        SlotSpadeGamingModal,
        aggregations.spadegaming,
        "Others",
        "Spade Gaming"
      ),
      getCategorizedGameData(
        SlotClotplayModal,
        aggregations.clotplay,
        "Others",
        "Clotplay"
      ),
      getCategorizedGameData(
        SlotEpicWinModal,
        aggregations.epicwin,
        "Others",
        "Epic Win"
      ),
      getCategorizedGameData(
        OtherVGModal,
        aggregations.vgqipai,
        "Others",
        "VG Qipai"
      ),
      getCategorizedGameData(SlotBNGModal, aggregations.bng, "Others", "BNG"),
      getCategorizedGameData(
        SlotKaGamingModal,
        aggregations.kagaming,
        "Others",
        "KA Gaming"
      ),
      getCategorizedGameData(
        SlotPegasusModal,
        aggregations.pegasus,
        "Others",
        "Pegasus"
      ),
      getCategorizedGameData(
        SlotUUSlotModal,
        aggregations.uuslot,
        "Others",
        "UU Slot"
      ),
      getCategorizedGameData(
        SlotKingMakerModal,
        aggregations.kingmaker,
        "Others",
        "King Maker"
      ),
      getCategorizedGameData(
        SlotLiveGSCModal,
        aggregations.gsc,
        "Others",
        "GSC"
      ),
      getCategorizedGameData(
        SlotPGSoftModal,
        aggregations.pgslot,
        "Others",
        "PG Soft"
      ),
      getCategorizedGameData(
        liveSexybcrtModal,
        aggregations.sexybcrt,
        "Live Casino",
        "Sexybcrt"
      ),
    ]);

    console.log("\n📊 Processing results from all games...");

    // Process results and categorize
    const categories = {
      "Live Casino": { games: [], totalTurnover: 0, allPlayerData: {} },
      Sports: { games: [], totalTurnover: 0, allPlayerData: {} },
      Others: { games: [], totalTurnover: 0, allPlayerData: {} },
    };

    // Combine all players data by username across all games
    const allPlayersCombined = {};

    promiseResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const data = result.value;
        console.log(
          `✅ ${data.gameName}: ${data.playerData.length} players, turnover: ${data.totalTurnover}`
        );

        categories[data.category].games.push({
          gameName: data.gameName,
          totalTurnover: data.totalTurnover,
          playerData: data.playerData,
          model: data.model,
        });
        categories[data.category].totalTurnover += data.totalTurnover;

        // Combine player data across all games
        data.playerData.forEach((player) => {
          if (!allPlayersCombined[player.username]) {
            allPlayersCombined[player.username] = {
              username: player.username,
              totalTurnover: 0,
              gameBreakdown: {
                "Live Casino": 0,
                Sports: 0,
                Others: 0,
              },
            };
          }
          allPlayersCombined[player.username].totalTurnover += player.turnover;
          allPlayersCombined[player.username].gameBreakdown[data.category] +=
            player.turnover;
        });
      } else {
        console.log(`❌ Promise ${index} failed:`, result.reason);
      }
    });

    // Calculate grand totals
    const grandTotalTurnover =
      categories["Live Casino"].totalTurnover +
      categories["Sports"].totalTurnover +
      categories["Others"].totalTurnover;

    console.log(`\n💰 Grand total turnover: ${grandTotalTurnover}`);
    console.log(
      `👥 Combined players: ${Object.keys(allPlayersCombined).length}`
    );

    console.log("\n🏦 Starting wallet updates...");

    const updatePromises = Object.values(allPlayersCombined).map(
      async (player) => {
        try {
          console.log(
            `\n💳 Processing wallet update for ${player.username}...`
          );

          // Calculate commission based on category percentages
          const liveCasinoCommission =
            player.gameBreakdown["Live Casino"] * 0.01; // 1%
          const sportsCommission = player.gameBreakdown["Sports"] * 0.02; // 2%
          const othersCommission = player.gameBreakdown["Others"] * 0.009; // 0.9%

          const totalCommission = Number(
            (
              liveCasinoCommission +
              sportsCommission +
              othersCommission
            ).toFixed(2)
          );

          console.log(`Player ${player.username} commission calculation:`);
          console.log(
            `  Live Casino: ${
              player.gameBreakdown["Live Casino"]
            } * 0.01 = ${liveCasinoCommission.toFixed(4)}`
          );
          console.log(
            `  Sports: ${
              player.gameBreakdown["Sports"]
            } * 0.02 = ${sportsCommission.toFixed(4)}`
          );
          console.log(
            `  Others: ${
              player.gameBreakdown["Others"]
            } * 0.009 = ${othersCommission.toFixed(4)}`
          );
          console.log(`  Total Commission: ${totalCommission}`);

          if (totalCommission > 0) {
            // Find and update user's wallettwo
            console.log(`Updating wallettwo for ${player.username}...`);
            const updateResult = await User.findOneAndUpdate(
              { gameId: player.username },
              { $inc: { wallettwo: totalCommission } },
              { new: true }
            );

            if (updateResult) {
              console.log(
                `✅ Updated wallettwo for ${
                  player.username
                }: +${totalCommission.toFixed(2)}`
              );

              // Create successful rebate record
              try {
                console.log(`Creating rebate record for ${player.username}...`);
                const rebateId = await createRebateRecord(
                  player,
                  categories,
                  totalCommission,
                  player.username,
                  false
                );

                console.log(
                  `✅ Rebate record created for ${player.username}: ${rebateId}`
                );

                const updateClaimedPromises = [];

                // Update claimed status for qualified records
                Object.keys(categories).forEach((categoryName) => {
                  categories[categoryName].games.forEach((game) => {
                    const playerInGame = game.playerData.find(
                      (p) => p.username === player.username
                    );
                    if (
                      playerInGame &&
                      playerInGame.turnover > 0 &&
                      playerInGame.documentIds &&
                      playerInGame.documentIds.length > 0
                    ) {
                      updateClaimedPromises.push(
                        game.model.updateMany(
                          { _id: { $in: playerInGame.documentIds } },
                          { $set: { claimed: true } }
                        )
                      );
                    }
                  });
                });

                // Also update any remaining disqualified records for this player to claimed=true
                const searchArray = [
                  player.username.toUpperCase(),
                  player.username.toUpperCase() + "2X",
                  player.username.toUpperCase() + "2x",
                  player.username.toLowerCase(),
                  player.username.toLowerCase() + "2X",
                  player.username.toLowerCase() + "2x",
                ];

                Object.keys(categories).forEach((categoryName) => {
                  categories[categoryName].games.forEach((game) => {
                    updateClaimedPromises.push(
                      game.model.updateMany(
                        {
                          username: { $in: searchArray },
                          disqualified: true,
                          claimed: false,
                        },
                        { $set: { claimed: true } }
                      )
                    );
                  });
                });

                console.log(
                  `Executing ${updateClaimedPromises.length} claimed status updates for ${player.username}...`
                );

                // Execute all claimed updates
                const claimedResults = await Promise.all(updateClaimedPromises);
                const totalUpdated = claimedResults.reduce(
                  (sum, result) => sum + (result.modifiedCount || 0),
                  0
                );

                console.log(
                  `✅ Updated claimed status for ${totalUpdated} records for ${player.username}`
                );

                return {
                  username: player.username,
                  commission: totalCommission,
                  updated: true,
                  newWalletTwo: parseFloat(updateResult.wallettwo.toString()),
                  rebateSaved: true,
                  rebateId: rebateId,
                  claimedUpdated: true,
                  claimedRecordsCount: totalUpdated,
                };
              } catch (rebateError) {
                console.error(
                  `❌ Error saving rebate data for ${player.username}:`,
                  rebateError
                );
                return {
                  username: player.username,
                  commission: totalCommission,
                  updated: true,
                  newWalletTwo: parseFloat(updateResult.wallettwo.toString()),
                  rebateSaved: false,
                  rebateError: rebateError.message,
                  claimedUpdated: false,
                };
              }
            } else {
              console.log(`❌ User not found for username: ${player.username}`);
              // Create error rebate record for user not found
              try {
                const rebateId = await createRebateRecord(
                  player,
                  categories,
                  totalCommission,
                  player.username,
                  true,
                  "User not found"
                );
                return {
                  username: player.username,
                  commission: totalCommission,
                  updated: false,
                  error: "User not found",
                  rebateSaved: true,
                  rebateId: rebateId,
                };
              } catch (rebateError) {
                return {
                  username: player.username,
                  commission: totalCommission,
                  updated: false,
                  error: "User not found",
                  rebateSaved: false,
                  rebateError: rebateError.message,
                };
              }
            }
          } else {
            console.log(
              `⏭️ Skipping ${player.username} - no commission to add`
            );
          }

          return {
            username: player.username,
            commission: 0,
            updated: false,
            reason: "No commission to add",
            rebateSaved: false,
          };
        } catch (error) {
          console.error(
            `❌ Error updating wallettwo for ${player.username}:`,
            error
          );

          // Create error rebate record for general errors
          try {
            const totalCommission = Number(
              (
                player.gameBreakdown["Live Casino"] * 0.01 +
                player.gameBreakdown["Sports"] * 0.02 +
                player.gameBreakdown["Others"] * 0.009
              ).toFixed(2)
            );

            const rebateId = await createRebateRecord(
              player,
              categories,
              totalCommission,
              player.username,
              true,
              error.message
            );

            return {
              username: player.username,
              commission: totalCommission,
              updated: false,
              error: error.message,
              rebateSaved: true,
              rebateId: rebateId,
            };
          } catch (rebateError) {
            return {
              username: player.username,
              commission: 0,
              updated: false,
              error: error.message,
              rebateSaved: false,
              rebateError: rebateError.message,
            };
          }
        }
      }
    );

    console.log("\n⏳ Waiting for all wallet updates to complete...");
    const results = await Promise.all(updatePromises);

    console.log("\n📈 Final Results Summary:");
    console.log(`Total players processed: ${results.length}`);
    console.log(
      `Successful updates: ${results.filter((r) => r.updated).length}`
    );
    console.log(
      `Failed updates: ${
        results.filter((r) => !r.updated && r.commission > 0).length
      }`
    );
    console.log(
      `No commission players: ${
        results.filter((r) => r.commission === 0).length
      }`
    );

    return res.status(200).json({
      success: true,
      summary: {
        grandTotalTurnover: Number(grandTotalTurnover.toFixed(2)),
        categories: {
          "Live Casino": {
            totalTurnover: Number(
              categories["Live Casino"].totalTurnover.toFixed(2)
            ),
            games: categories["Live Casino"].games,
          },
          Sports: {
            totalTurnover: Number(
              categories["Sports"].totalTurnover.toFixed(2)
            ),
            games: categories["Sports"].games,
          },
          Others: {
            totalTurnover: Number(
              categories["Others"].totalTurnover.toFixed(2)
            ),
            games: categories["Others"].games,
          },
        },
        allPlayersCombined: Object.values(allPlayersCombined)
          .map((player) => ({
            username: player.username,
            totalTurnover: Number(player.totalTurnover.toFixed(2)),
            gameBreakdown: {
              "Live Casino": Number(
                player.gameBreakdown["Live Casino"].toFixed(2)
              ),
              Sports: Number(player.gameBreakdown["Sports"].toFixed(2)),
              Others: Number(player.gameBreakdown["Others"].toFixed(2)),
            },
          }))
          .sort((a, b) => b.totalTurnover - a.totalTurnover),
        results: results,
        processingStats: {
          totalPlayersProcessed: results.length,
          successfulUpdates: results.filter((r) => r.updated).length,
          failedUpdates: results.filter((r) => !r.updated && r.commission > 0)
            .length,
          noCommissionPlayers: results.filter((r) => r.commission === 0).length,
        },
      },
    });
  } catch (error) {
    console.error("❌ CATEGORIZED GAME DATA: Failed to fetch report:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: {
        en: "Internal Server Error. Please contact customer support for further assistance.",
        zh: "内部服务器错误。请联系客服以获取进一步帮助。",
        ms: "Ralat dalaman pelayan. Sila hubungi sokongan pelanggan untuk bantuan lanjut.",
        zh_hk: "內部伺服器出咗問題。老闆麻煩聯絡客服，我哋會幫你跟進。",
        id: "Kesalahan server internal. Silakan hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
      },
    });
  }
});

function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

router.post(
  "/api/instantrebate/transfertomain",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      // Find the user
      const user = await User.findById(userId).select(
        "username fullname wallet wallettwo"
      );
      if (!user) {
        return res.status(200).json({
          success: false,
          message: {
            en: "User not found. Please try again or contact customer service.",
            zh: "用户未找到，请重试或联系客服。",
            ms: "Pengguna tidak ditemui, sila cuba lagi atau hubungi khidmat pelanggan.",
            zh_hk: "搵唔到用戶，麻煩再試過或者聯絡客服。",
            id: "Pengguna tidak ditemukan. Silakan coba lagi atau hubungi layanan pelanggan.",
          },
        });
      }

      const currentWallet = user.wallet;
      const currentWalletTwo = user.wallettwo;

      if (currentWalletTwo <= 0) {
        return res.status(200).json({
          success: false,
          message: {
            en: "You currently have no rebate in your rebate wallet.",
            zh: "您的返水钱包目前没有返水。",
            ms: "Anda pada masa ini tiada rebat dalam dompet rebat anda.",
            zh_hk: "您的返水錢包目前冇返水。",
            id: "Anda saat ini tidak memiliki rebate di dompet rebate Anda.",
          },
        });
      }

      if (currentWallet >= 5) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Please ensure your wallet balance is less than HKD 5 before claiming unlimited rebates.",
            zh: "请确保钱包余额少于HKD 5再领取无限返水。",
            ms: "Sila pastikan baki dompet anda kurang daripada HKD 5 sebelum menuntut rebat tanpa had.",
            zh_hk: "請確保錢包餘額少過HKD 5先領取無限返水。",
            id: "Pastikan saldo dompet Anda kurang dari HKD 5 sebelum mengklaim rebate tanpa batas.",
          },
        });
      }

      const transferAmount = roundToTwoDecimals(currentWalletTwo);
      const transactionId = uuidv4();

      const promotion = await Promotion.findById(
        "68d7389aa67c6c4021c1531b"
      ).select("maintitle maintitleEN _id");
      if (!promotion) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Internal server error. Please contact customer support.",
            zh: "内部服务器错误，请联系客服。",
            ms: "Ralat dalaman pelayan. Sila hubungi sokongan pelanggan.",
            zh_hk: "內部伺服器錯誤，請聯絡客服。",
            id: "Kesalahan server internal. Silakan hubungi dukungan pelanggan.",
          },
        });
      }

      const updatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          wallettwo: { $gte: transferAmount },
          wallet: { $lt: 5 },
        },
        {
          $inc: {
            wallettwo: -transferAmount,
            wallet: transferAmount,
          },
        },
        { new: true, projection: { wallet: 1 } }
      );

      if (!updatedUser) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Transfer failed. Please try again.",
            zh: "转账失败，请重试。",
            ms: "Pemindahan gagal, sila cuba lagi.",
            zh_hk: "老闆轉賬失敗，麻煩再試多次。",
            id: "Transfer gagal. Silakan coba lagi.",
          },
        });
      }

      await Promise.all([
        new Bonus({
          transactionId,
          userId: user._id,
          username: user.username,
          fullname: user.fullname,
          transactionType: "bonus",
          processBy: "system",
          amount: transferAmount,
          walletamount: updatedUser.wallet,
          status: "approved",
          method: "auto",
          remark: "Unlimited Rebate",
          promotionname: promotion.maintitle,
          promotionnameEN: promotion.maintitleEN,
          promotionId: promotion._id,
          processtime: "00:00:00",
        }).save(),

        new UserWalletLog({
          userId: user._id,
          transactionid: transactionId,
          transactiontime: new Date(),
          transactiontype: "Unlimited Rebate",
          amount: transferAmount,
          status: "approved",
          promotionname: promotion.maintitle,
          promotionnameEN: promotion.maintitleEN,
        }).save(),
      ]);

      return res.status(200).json({
        success: true,
        message: {
          en: "All rebate transferred to main wallet successfully",
          zh: "所有返水已成功转移到主钱包",
          ms: "Semua rebat berjaya dipindahkan ke dompet utama",
          zh_hk: "所有返水都已經成功轉到主錢包喇",
          id: "Semua rebate berhasil ditransfer ke dompet utama",
        },
      });
    } catch (error) {
      console.error("REBATE TRANSFER ERROR:", error);
      return res.status(200).json({
        success: false,
        message: {
          en: "Internal server error. Please contact customer support.",
          zh: "内部服务器错误，请联系客服。",
          ms: "Ralat dalaman pelayan. Sila hubungi sokongan pelanggan.",
          zh_hk: "內部伺服器錯誤，請聯絡客服。",
          id: "Kesalahan server internal. Silakan hubungi dukungan pelanggan.",
        },
      });
    }
  }
);

router.get(
  "/api/user/getinstantrebatedata",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(200).json({
          success: false,
          message: {
            en: "User not found",
            zh: "用户未找到",
            ms: "Pengguna tidak ditemui",
            zh_hk: "用戶未找到",
            id: "Pengguna tidak ditemukan",
          },
        });
      }

      const latestRebate = await InstantRebate.findOne({
        username: user.gameId.toUpperCase().replace(/2[xX]$/, ""),
      })
        .sort({ timeCalled: -1 }) // Latest first
        .exec();

      if (!latestRebate) {
        return res.status(200).json({
          success: true,
          message: {
            en: "No rebate records found",
            zh: "未找到返水记录",
            ms: "Tiada rekod rebat ditemui",
            zh_hk: "未找到返水記錄",
            id: "Tidak ada catatan rebate ditemukan",
          },
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          latestRebate: {
            timeCalled: latestRebate.timeCalled,
          },
        },
      });
    } catch (error) {
      console.error("Error occurred while retrieving user rebate data:", error);
      return res.status(200).json({
        success: false,
        message: {
          en: "Internal server error",
          zh: "内部服务器错误",
          ms: "Ralat dalaman pelayan",
          zh_hk: "內部伺服器錯誤",
          id: "Kesalahan server internal",
        },
      });
    }
  }
);

router.get("/admin/api/unlimitedrebate-report", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: moment(new Date(startDate)).utc().toDate(),
        $lte: moment(new Date(endDate)).utc().toDate(),
      };
    }

    const reports = await InstantRebate.find(dateFilter).sort({
      createdAt: -1,
    });

    const gameIds = [...new Set(reports.map((report) => report.username))];

    // Fetch users with matching gameIds
    const users = await User.find({ gameId: { $in: gameIds } }).select(
      "gameId username"
    );

    // Create a map for quick lookup
    const gameIdToUsernameMap = new Map();
    users.forEach((user) => {
      gameIdToUsernameMap.set(user.gameId, user.username);
    });

    // Replace gameId with username in reports
    const reportsWithUsername = reports.map((report) => {
      const reportObj = report.toObject();
      const actualUsername =
        gameIdToUsernameMap.get(report.username) || report.username;
      return {
        ...reportObj,
        username: actualUsername,
        gameId: report.username, // Keep original gameId if needed for reference
      };
    });

    return res.status(200).json({
      success: true,
      data: reportsWithUsername,
    });
  } catch (error) {
    console.error("Error fetching unlimited rebate report:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unlimited rebate report",
      error: error.message,
    });
  }
});

module.exports = router;
