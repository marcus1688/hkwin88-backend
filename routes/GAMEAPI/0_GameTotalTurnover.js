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
const SlotPGSoftModal = require("../../models/slot_pgsoft.model");
const liveSexybcrtModal = require("../../models/live_sexybcrt.model");
require("dotenv").config();

const getGameDataSummary = async (
  model,
  username,
  start,
  end,
  aggregationPipeline
) => {
  try {
    const upperUsername = username.toUpperCase();
    const lowerUsername = username.toLowerCase();

    const searchArray = [
      upperUsername,
      upperUsername + "2X",
      upperUsername + "2x",
      lowerUsername,
      lowerUsername + "2X",
      lowerUsername + "2x",
    ];

    const results = await model.aggregate([
      {
        $match: {
          username: {
            $in: searchArray,
          },
          createdAt: { $gte: start, $lte: end },
          ...aggregationPipeline.$match,
        },
      },
      {
        $group: aggregationPipeline.$group,
      },
    ]);

    return results.length > 0 ? results[0] : { turnover: 0, winLoss: 0 };
  } catch (error) {
    console.error(
      `Error aggregating data for model ${model.modelName}:`,
      error
    );
    return { turnover: 0, winLoss: 0 };
  }
};

router.get("/api/all/dailygamedata", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const { startDate } = req.query;
    const endDate = moment().format("YYYY-MM-DD HH:mm:ss");
    // const startDate = moment.utc().startOf("days");
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: {
          en: "Start date and end date are required",
          zh: "开始日期和结束日期是必填项",
          ms: "Tarikh mula dan tarikh akhir diperlukan",
          zh_hk: "開始日期和結束日期是必填項",
          id: "Tanggal mulai dan tanggal akhir diperlukan",
        },
      });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({
        success: false,
        message: {
          en: "User not found. Please try again or contact customer service for assistance.",
          zh: "用户未找到，请重试或联系客服以获取帮助。",
          ms: "Pengguna tidak ditemui, sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "用戶未找到，請重試或聯絡客服以獲取幫助。",
          id: "Pengguna tidak ditemukan. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const username = user.username;

    const start = moment(new Date(startDate)).utc().toDate();
    const end = moment(new Date(endDate)).utc().toDate();

    const aggregations = {
      pp: {
        $match: {
          refunded: false,
          ended: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      wmcasino: {
        $match: {
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      microgaming: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      wecasino: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      apollo: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      yeebet: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      cq9: {
        $match: {
          cancel: { $ne: true },
          refund: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      fachai: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      funky: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      habanero: {
        $match: {
          refund: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      jdb: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      jili: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      joker: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: {
            $sum: {
              $cond: {
                if: { $eq: ["$gametype", "FISH"] },
                then: { $ifNull: ["$fishTurnover", 0] },
                else: { $ifNull: ["$betamount", 0] },
              },
            },
          },
          winLoss: {
            $sum: {
              $cond: {
                if: { $eq: ["$gametype", "FISH"] },
                then: { $ifNull: ["$fishWinLoss", 0] },
                else: {
                  $subtract: [
                    { $ifNull: ["$settleamount", 0] },
                    { $ifNull: ["$betamount", 0] },
                  ],
                },
              },
            },
          },
        },
      },
      live22: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      spadegaming: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      cmd368: {
        $match: {
          cancel: { $ne: true },
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      wssport: {
        $match: {},
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $add: [
                {
                  $subtract: [
                    { $ifNull: ["$settleamount", 0] },
                    { $ifNull: ["$betamount", 0] },
                  ],
                },
                { $multiply: [{ $ifNull: ["$rollbackamount", 0] }, -1] },
                { $ifNull: ["$cancelamount", 0] },
              ],
            },
          },
        },
      },
      afb1188: {
        $match: {
          cancelroute: { $ne: true },
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $multiply: [{ $ifNull: ["$lastWinlose", 0] }, -1],
            },
          },
        },
      },
      iagaming: {
        $match: {
          cancel: { $ne: true },
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      tfgaming: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
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
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      clotplay: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      epicwin: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      vgqipai: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$withdrawamount", 0] },
                { $ifNull: ["$depositamount", 0] },
              ],
            },
          },
        },
      },
      afblive: {
        $match: {
          cancel: { $ne: true },
          tip: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      evolution: {
        $match: {
          settle: true,
          cancel: { $ne: true },
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      bng: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      kagaming: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      pegasus: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      uuslot: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      kingmaker: {
        $match: {},
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      gsc: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
      pgsoft: {
        $match: {
          cancel: { $ne: true },
          settle: true,
        },
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
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
        $group: {
          _id: null,
          turnover: { $sum: { $ifNull: ["$betamount", 0] } },
          winLoss: {
            $sum: {
              $subtract: [
                { $ifNull: ["$settleamount", 0] },
                { $ifNull: ["$betamount", 0] },
              ],
            },
          },
        },
      },
    };

    // Create an array of promises for all aggregations to match player-report
    const promiseResults = await Promise.allSettled([
      getGameDataSummary(
        SlotLivePPModal,
        user.gameId,
        start,
        end,
        aggregations.pp
      ),
      getGameDataSummary(
        liveWMCasinoModal,
        user.gameId,
        start,
        end,
        aggregations.wmcasino
      ),
      getGameDataSummary(
        SlotLiveMicroGamingModal,
        user.gameId,
        start,
        end,
        aggregations.microgaming
      ),
      getGameDataSummary(
        LiveWeCasinoModal,
        user.gameId,
        start,
        end,
        aggregations.wecasino
      ),
      getGameDataSummary(
        SlotApolloModal,
        user.gameId,
        start,
        end,
        aggregations.apollo
      ),
      getGameDataSummary(
        LiveYeebetModal,
        user.gameId,
        start,
        end,
        aggregations.yeebet
      ),
      getGameDataSummary(
        SlotCQ9Modal,
        user.gameId,
        start,
        end,
        aggregations.cq9
      ),
      getGameDataSummary(
        SlotFachaiModal,
        user.gameId,
        start,
        end,
        aggregations.fachai
      ),
      getGameDataSummary(
        SlotFunkyModal,
        user.gameId,
        start,
        end,
        aggregations.funky
      ),
      getGameDataSummary(
        SlotHabaneroModal,
        user.gameId,
        start,
        end,
        aggregations.habanero
      ),
      getGameDataSummary(
        SlotJDBModal,
        user.gameId,
        start,
        end,
        aggregations.jdb
      ),
      getGameDataSummary(
        SlotJiliModal,
        user.gameId,
        start,
        end,
        aggregations.jili
      ),
      getGameDataSummary(
        SlotJokerModal,
        user.gameId,
        start,
        end,
        aggregations.joker
      ),
      getGameDataSummary(
        SlotLive22Modal,
        user.gameId,
        start,
        end,
        aggregations.live22
      ),
      getGameDataSummary(
        SlotSpadeGamingModal,
        user.gameId,
        start,
        end,
        aggregations.spadegaming
      ),
      getGameDataSummary(
        SportCMDModal,
        user.gameId,
        start,
        end,
        aggregations.cmd368
      ),
      getGameDataSummary(
        SportsWsSportModal,
        user.gameId,
        start,
        end,
        aggregations.wssport
      ),
      getGameDataSummary(
        SportAFB1188Modal,
        user.gameId,
        start,
        end,
        aggregations.afb1188
      ),
      getGameDataSummary(
        ESportIAGamingModal,
        user.gameId,
        start,
        end,
        aggregations.iagaming
      ),
      getGameDataSummary(
        EsportTfGamingModal,
        user.gameId,
        start,
        end,
        aggregations.tfgaming
      ),
      getGameDataSummary(
        otherHorsebookModal,
        user.gameId,
        start,
        end,
        aggregations.horsebook
      ),
      getGameDataSummary(
        SlotClotplayModal,
        user.gameId,
        start,
        end,
        aggregations.clotplay
      ),
      getGameDataSummary(
        SlotEpicWinModal,
        user.gameId,
        start,
        end,
        aggregations.epicwin
      ),
      getGameDataSummary(
        OtherVGModal,
        user.gameId,
        start,
        end,
        aggregations.vgqipai
      ),
      getGameDataSummary(
        LiveAFBModal,
        user.gameId,
        start,
        end,
        aggregations.afblive
      ),
      getGameDataSummary(
        LiveEvolutionModal,
        user.gameId,
        start,
        end,
        aggregations.evolution
      ),
      getGameDataSummary(
        SlotBNGModal,
        user.gameId,
        start,
        end,
        aggregations.bng
      ),
      getGameDataSummary(
        SlotKaGamingModal,
        user.gameId,
        start,
        end,
        aggregations.kagaming
      ),
      getGameDataSummary(
        SlotPegasusModal,
        user.gameId,
        start,
        end,
        aggregations.pegasus
      ),
      getGameDataSummary(
        SlotUUSlotModal,
        user.gameId,
        start,
        end,
        aggregations.uuslot
      ),
      getGameDataSummary(
        SlotKingMakerModal,
        user.gameId,
        start,
        end,
        aggregations.kingmaker
      ),
      getGameDataSummary(
        SlotLiveGSCModal,
        user.gameId,
        start,
        end,
        aggregations.gsc
      ),
      getGameDataSummary(
        SlotPGSoftModal,
        user.gameId,
        start,
        end,
        aggregations.pgsoft
      ),
      getGameDataSummary(
        liveSexybcrtModal,
        user.gameId,
        start,
        end,
        aggregations.sexybcrt
      ),
    ]);

    const failedPromises = promiseResults
      .map((result, index) => ({ index, result }))
      .filter(({ result }) => result.status === "rejected");

    if (failedPromises.length > 0) {
      console.warn(
        "Some aggregations failed:",
        failedPromises.map(({ index, result }) => ({
          index,
          reason: result.reason?.message,
        }))
      );
    }

    // Create a result map from the resolved promises
    const results = {
      pp:
        promiseResults[0].status === "fulfilled"
          ? promiseResults[0].value
          : { turnover: 0, winLoss: 0 },
      wmcasino:
        promiseResults[1].status === "fulfilled"
          ? promiseResults[1].value
          : { turnover: 0, winLoss: 0 },
      microgaming:
        promiseResults[2].status === "fulfilled"
          ? promiseResults[2].value
          : { turnover: 0, winLoss: 0 },
      wecasino:
        promiseResults[3].status === "fulfilled"
          ? promiseResults[3].value
          : { turnover: 0, winLoss: 0 },
      apollo:
        promiseResults[4].status === "fulfilled"
          ? promiseResults[4].value
          : { turnover: 0, winLoss: 0 },
      yeebet:
        promiseResults[5].status === "fulfilled"
          ? promiseResults[5].value
          : { turnover: 0, winLoss: 0 },
      cq9:
        promiseResults[6].status === "fulfilled"
          ? promiseResults[6].value
          : { turnover: 0, winLoss: 0 },
      fachai:
        promiseResults[7].status === "fulfilled"
          ? promiseResults[7].value
          : { turnover: 0, winLoss: 0 },
      funky:
        promiseResults[8].status === "fulfilled"
          ? promiseResults[8].value
          : { turnover: 0, winLoss: 0 },
      habanero:
        promiseResults[9].status === "fulfilled"
          ? promiseResults[9].value
          : { turnover: 0, winLoss: 0 },
      jdb:
        promiseResults[10].status === "fulfilled"
          ? promiseResults[10].value
          : { turnover: 0, winLoss: 0 },
      jili:
        promiseResults[11].status === "fulfilled"
          ? promiseResults[11].value
          : { turnover: 0, winLoss: 0 },
      joker:
        promiseResults[12].status === "fulfilled"
          ? promiseResults[12].value
          : { turnover: 0, winLoss: 0 },
      live22:
        promiseResults[13].status === "fulfilled"
          ? promiseResults[13].value
          : { turnover: 0, winLoss: 0 },
      spadegaming:
        promiseResults[14].status === "fulfilled"
          ? promiseResults[14].value
          : { turnover: 0, winLoss: 0 },
      cmd368:
        promiseResults[15].status === "fulfilled"
          ? promiseResults[15].value
          : { turnover: 0, winLoss: 0 },
      wssport:
        promiseResults[16].status === "fulfilled"
          ? promiseResults[16].value
          : { turnover: 0, winLoss: 0 },
      afb1188:
        promiseResults[17].status === "fulfilled"
          ? promiseResults[17].value
          : { turnover: 0, winLoss: 0 },
      iagaming:
        promiseResults[18].status === "fulfilled"
          ? promiseResults[18].value
          : { turnover: 0, winLoss: 0 },
      tfgaming:
        promiseResults[19].status === "fulfilled"
          ? promiseResults[19].value
          : { turnover: 0, winLoss: 0 },
      horsebook:
        promiseResults[20].status === "fulfilled"
          ? promiseResults[20].value
          : { turnover: 0, winLoss: 0 },
      clotplay:
        promiseResults[21].status === "fulfilled"
          ? promiseResults[21].value
          : { turnover: 0, winLoss: 0 },
      epicwin:
        promiseResults[22].status === "fulfilled"
          ? promiseResults[22].value
          : { turnover: 0, winLoss: 0 },
      vgqipai:
        promiseResults[23].status === "fulfilled"
          ? promiseResults[23].value
          : { turnover: 0, winLoss: 0 },
      afblive:
        promiseResults[24].status === "fulfilled"
          ? promiseResults[24].value
          : { turnover: 0, winLoss: 0 },
      evolution:
        promiseResults[25].status === "fulfilled"
          ? promiseResults[25].value
          : { turnover: 0, winLoss: 0 },
      bng:
        promiseResults[26].status === "fulfilled"
          ? promiseResults[26].value
          : { turnover: 0, winLoss: 0 },
      kagaming:
        promiseResults[27].status === "fulfilled"
          ? promiseResults[27].value
          : { turnover: 0, winLoss: 0 },
      pegasus:
        promiseResults[28].status === "fulfilled"
          ? promiseResults[28].value
          : { turnover: 0, winLoss: 0 },
      uuslot:
        promiseResults[29].status === "fulfilled"
          ? promiseResults[29].value
          : { turnover: 0, winLoss: 0 },
      kingmaker:
        promiseResults[30].status === "fulfilled"
          ? promiseResults[30].value
          : { turnover: 0, winLoss: 0 },
      gsc:
        promiseResults[31].status === "fulfilled"
          ? promiseResults[31].value
          : { turnover: 0, winLoss: 0 },
      pgsoft:
        promiseResults[32].status === "fulfilled"
          ? promiseResults[32].value
          : { turnover: 0, winLoss: 0 },
      sexybcrt:
        promiseResults[33].status === "fulfilled"
          ? promiseResults[33].value
          : { turnover: 0, winLoss: 0 },
    };

    // Calculate total turnover and win loss
    const totalTurnover = Object.values(results).reduce(
      (sum, current) => sum + (current.turnover || 0),
      0
    );

    const totalWinLoss = Object.values(results).reduce(
      (sum, current) => sum + (current.winLoss || 0),
      0
    );

    const executionTime = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      summary: {
        username,
        totalTurnover: Number(totalTurnover.toFixed(2)),
        totalWinLoss: Number(totalWinLoss.toFixed(2)),
        executionTime, // Include in development, remove in production
      },
    });
  } catch (error) {
    console.error("ALL GAME DATA: Failed to fetch report:", error);
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

router.post("/api/games/active-games", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    let user = await User.findById(userId, { username: 1, gameId: 1 }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: {
          en: "User not found. Please try again or contact customer service for assistance.",
          zh: "用户未找到，请重试或联系客服以获取帮助。",
          ms: "Pengguna tidak ditemui, sila cuba lagi atau hubungi khidmat pelanggan untuk bantuan.",
          zh_hk: "搵唔到用戶，麻煩再試多次或者聯絡客服幫手。",
          id: "Pengguna tidak ditemukan. Silakan coba lagi atau hubungi layanan pelanggan untuk bantuan.",
        },
      });
    }

    const seenGameNames = new Set();
    const uniqueActiveGames = [];

    const queryModel = async (model, conditions, gameName) => {
      try {
        // Early return if we've already seen this game
        if (seenGameNames.has(gameName)) {
          return [];
        }

        const games = await model
          .find({
            username: {
              $in: [user.gameId, user.gameId + "2x", user.gameId + "2X"],
            },
            ...conditions,
          })
          .select("_id betId uniqueId tranId createdAt gameRoundCode")
          .sort({ createdAt: -1 }) // Sort at DB level
          .limit(1) // Only get the most recent game per provider
          .lean(); // Use lean() for faster queries

        if (games.length > 0) {
          seenGameNames.add(gameName);
          return [
            {
              gameName,
              betId:
                games[0].betId ||
                games[0].gameRoundCode ||
                games[0].tranId ||
                games[0].uniqueId,
              username: user.username,
              createdAt: games[0].createdAt,
            },
          ];
        }
        return [];
      } catch (error) {
        console.error(`Error querying ${gameName}:`, error);
        return [];
      }
    };

    // Execute queries with early termination potential
    const gameQueries = await Promise.allSettled([
      queryModel(
        SlotLivePPModal,
        {
          $or: [{ ended: false }, { ended: { $exists: false } }],
          refunded: false,
          gameType: "Slot",
        },
        "Pragmatic Play"
      ),
      queryModel(
        SlotLiveMicroGamingModal,
        {
          $or: [{ completed: false }, { completed: { $exists: false } }],
          cancel: { $ne: true },
          gameType: "SLOT",
        },
        "Micro Gaming"
      ),
      queryModel(
        SlotApolloModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Apollo"
      ),
      queryModel(
        SlotCQ9Modal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
          refund: { $ne: true },
          gametype: "SLOT",
        },
        "CQ9"
      ),
      queryModel(
        SlotFachaiModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Fachai"
      ),
      queryModel(
        SlotFunkyModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Funky"
      ),
      queryModel(
        SlotHabaneroModal,
        {
          $or: [
            {
              $and: [
                { $or: [{ settle: false }, { settle: { $exists: false } }] },
                {
                  $or: [
                    { freeSpinOngoing: { $exists: false } },
                    { freeSpinOngoing: false },
                  ],
                },
              ],
            },
            { freeSpinOngoing: true },
          ],
          refund: { $ne: true },
        },
        "Habanero"
      ),
      queryModel(
        SlotJDBModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
          gametype: "SLOT",
        },
        "JDB"
      ),
      queryModel(
        SlotJiliModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
          gametype: "SLOT",
        },
        "Jili"
      ),
      queryModel(
        SlotJokerModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          withdraw: { $ne: true },
          deposit: { $ne: true },
          cancel: { $ne: true },
        },
        "Joker"
      ),
      queryModel(
        SlotLive22Modal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Live22"
      ),
      queryModel(
        SlotSpadeGamingModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Spade Gaming"
      ),
      queryModel(
        SlotClotplayModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Clotplay"
      ),
      queryModel(
        SlotEpicWinModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "EpicWin"
      ),
      queryModel(
        SlotBNGModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "BNG"
      ),
      queryModel(
        SlotKaGamingModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Ka Gaming"
      ),
      queryModel(
        SlotPegasusModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "Pegasus"
      ),
      queryModel(
        SlotUUSlotModal,
        {
          $or: [{ settle: false }, { settle: { $exists: false } }],
          cancel: { $ne: true },
        },
        "UU Slot"
      ),
    ]);

    // Process results - much faster since we're only getting 1 game per provider
    gameQueries.forEach((result) => {
      if (
        result.status === "fulfilled" &&
        result.value &&
        result.value.length > 0
      ) {
        uniqueActiveGames.push(...result.value);
      } else if (result.status === "rejected") {
        console.error("Query failed:", result.reason);
      }
    });

    // Sort the final unique results
    uniqueActiveGames.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.status(200).json({
      success: true,
      totalActiveGames: uniqueActiveGames.length,

      activeGames: uniqueActiveGames,
      message: {
        en: "Active games retrieved successfully.",
        zh: "成功检索活跃游戏。",
        ms: "Permainan aktif berjaya diperoleh.",
        zh_hk: "成功搵到活躍遊戲喇。",
        id: "Permainan aktif berhasil diambil.",
      },
    });
  } catch (error) {
    console.error("Error finding active games for user:", error);
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

router.post(
  "/admin/api/games/active-gamesdetail/:userId",
  authenticateAdminToken,
  async (req, res) => {
    const startTime = Date.now();
    try {
      const userId = req.params.userId;
      let user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: {
            en: "User not found",
            zh: "找不到用户",
            ms: "Pengguna tidak dijumpai",
          },
        });
      }

      const activeGames = [];

      const queryModel = async (model, conditions, gameName) => {
        try {
          const games = await model
            .find({
              username: {
                $in: [user.gameId, user.gameId + "2x", user.gameId + "2X"],
              },
              ...conditions,
            })
            .select(
              "_id username betamount betAmount betId uniqueId tranId createdAt gameRoundCode"
            );

          return games.map((game) => ({
            gameName,
            betId:
              game.betId || game.gameRoundCode || game.tranId || game.uniqueId,
            username: user.username,
            createdAt: game.createdAt,
          }));
        } catch (error) {
          console.error(`Error querying ${gameName}:`, error);
          return [];
        }
      };

      // Execute all queries in parallel (same as above)
      const gameQueries = await Promise.allSettled([
        queryModel(
          SlotLivePPModal,
          {
            $or: [{ ended: false }, { ended: { $exists: false } }],
            refunded: false,
            gameType: "Slot",
          },
          "Pragmatic Play"
        ),
        queryModel(
          SlotLiveMicroGamingModal,
          {
            $or: [{ completed: false }, { completed: { $exists: false } }],
            cancel: { $ne: true },
            gameType: "SLOT",
          },
          "Micro Gaming"
        ),
        queryModel(
          SlotApolloModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Apollo"
        ),
        queryModel(
          SlotCQ9Modal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
            refund: { $ne: true },
            gametype: "SLOT",
          },
          "CQ9"
        ),
        queryModel(
          SlotFachaiModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Fachai"
        ),
        queryModel(
          SlotFunkyModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Funky"
        ),
        queryModel(
          SlotHabaneroModal,
          {
            $or: [
              {
                $and: [
                  { $or: [{ settle: false }, { settle: { $exists: false } }] },
                  {
                    $or: [
                      { freeSpinOngoing: { $exists: false } },
                      { freeSpinOngoing: false },
                    ],
                  },
                ],
              },
              { freeSpinOngoing: true },
            ],
            refund: { $ne: true },
          },
          "Habanero"
        ),
        queryModel(
          SlotJDBModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
            gametype: "SLOT",
          },
          "JDB"
        ),
        queryModel(
          SlotJiliModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
            gametype: "SLOT",
          },
          "Jili"
        ),
        queryModel(
          SlotJokerModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            withdraw: { $ne: true },
            deposit: { $ne: true },
            cancel: { $ne: true },
          },
          "Joker"
        ),
        queryModel(
          SlotLive22Modal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Live22"
        ),
        queryModel(
          SlotSpadeGamingModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Spade Gaming"
        ),
        queryModel(
          SlotClotplayModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Clotplay"
        ),
        queryModel(
          SlotEpicWinModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "EpicWin"
        ),
        queryModel(
          SlotBNGModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "BNG"
        ),
        queryModel(
          SlotKaGamingModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Ka Gaming"
        ),
        queryModel(
          SlotPegasusModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "Pegasus"
        ),
        queryModel(
          SlotUUSlotModal,
          {
            $or: [{ settle: false }, { settle: { $exists: false } }],
            cancel: { $ne: true },
          },
          "UU Slot"
        ),
      ]);

      // Process results and combine all active games
      gameQueries.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          activeGames.push(...result.value);
        } else if (result.status === "rejected") {
          console.error("Query failed:", result.reason);
        }
      });

      // Sort by creation date (newest first)
      activeGames.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const uniqueActiveGames = [];
      const seenGameNames = new Set();

      activeGames.forEach((game) => {
        if (!seenGameNames.has(game.gameName)) {
          seenGameNames.add(game.gameName);
          uniqueActiveGames.push(game);
        }
      });

      const executionTime = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        totalActiveGames: activeGames.length,
        executionTime,
        activeGames: uniqueActiveGames,
        message: {
          en: "Active games retrieved successfully.",
          zh: "成功检索活跃游戏。",
          ms: "Permainan aktif berjaya diperoleh.",
          zh_hk: "成功檢索活躍遊戲。",
          id: "Permainan aktif berhasil diambil.",
        },
      });
    } catch (error) {
      console.error("Error finding active games for user:", error);
      return res.status(500).json({
        success: false,
        message: {
          en: "Internal Server Error. Please contact IT support for further assistance.",
          zh: "内部服务器错误。请联系IT客服以获取进一步帮助。",
          ms: "Ralat Pelayan Dalaman. Sila hubungi sokongan IT untuk bantuan lanjut.",
          zh_hk: "內部伺服器錯誤。請聯絡IT客服以獲取進一步幫助。",
          id: "Kesalahan Server Internal. Silakan hubungi dukungan IT untuk bantuan lebih lanjut.",
        },
      });
    }
  }
);

router.post(
  "/admin/api/games/manual-status-update",
  authenticateAdminToken,
  async (req, res) => {
    try {
      const { gameName, betId, action, reason = "Manual update" } = req.body;

      const admin = await adminUser.findById(req.user.userId);

      if (!gameName || !betId || !action) {
        return res.status(200).json({
          success: false,
          message: {
            en: "gameName, betId, and action are required fields",
            zh: "gameName、betId 和 action 是必填字段",
            ms: "gameName, betId, dan action adalah medan yang diperlukan",
            zh_hk: "gameName、betId 和 action 是必填字段",
            id: "gameName, betId, dan action adalah field yang wajib diisi",
          },
        });
      }

      if (!["settle", "cancel"].includes(action)) {
        return res.status(200).json({
          success: false,
          message: {
            en: "action must be either 'settle' or 'cancel'",
            zh: "action 必须是 'settle' 或 'cancel'",
            ms: "action mesti sama ada 'settle' atau 'cancel'",
            zh_hk: "action 必須是 'settle' 或 'cancel'",
            id: "action harus 'settle' atau 'cancel'",
          },
        });
      }
      // Define provider models mapping
      const providerModels = {
        "Pragmatic Play": SlotLivePPModal,
        "Micro Gaming": SlotLiveMicroGamingModal,
        Apollo: SlotApolloModal,
        CQ9: SlotCQ9Modal,
        Fachai: SlotFachaiModal,
        Funky: SlotFunkyModal,
        Habanero: SlotHabaneroModal,
        JDB: SlotJDBModal,
        Jili: SlotJiliModal,
        Joker: SlotJokerModal,
        Live22: SlotLive22Modal,
        "Spade Gaming": SlotSpadeGamingModal,
        Clotplay: SlotClotplayModal,
        EpicWin: SlotEpicWinModal,
        BNG: SlotBNGModal,
        Kagaming: SlotKaGamingModal,
        Pegasus: SlotPegasusModal,
        "UU Slot": SlotUUSlotModal,
        KingMaker: SlotKingMakerModal,
      };

      const Model = providerModels[gameName];
      if (!Model) {
        return res.status(200).json({
          success: false,
          message: {
            en: `Invalid game provider: ${gameName}`,
            zh: `无效的游戏提供商: ${gameName}`,
            ms: `Pembekal permainan tidak sah: ${gameName}`,
            zh_hk: `無效的遊戲提供商: ${gameName}`,
            id: `Penyedia permainan tidak valid: ${gameName}`,
          },
        });
      }

      // Find the game record using various possible ID fields
      const gameRecords = await Model.find({
        $or: [
          { betId: betId },
          { uniqueId: betId },
          { tranId: betId },
          { gameRoundCode: betId },
        ],
      }).lean();

      if (!gameRecords || gameRecords.length === 0) {
        return res.status(200).json({
          success: false,
          message: {
            en: `No game records found for betId: ${betId}`,
            zh: `未找到投注ID为 ${betId} 的游戏记录`,
            ms: `Rekod permainan tidak ditemui untuk betId: ${betId}`,
            zh_hk: `未找到投注ID為 ${betId} 的遊戲記錄`,
            id: `Catatan permainan tidak ditemukan untuk betId: ${betId}`,
          },
        });
      }

      const recordsToUpdate = [];
      const alreadyProcessedRecords = [];

      for (const gameRecord of gameRecords) {
        let isAlreadySettled = false;
        let isAlreadyCanceled = false;

        switch (gameName) {
          case "Pragmatic Play":
            isAlreadySettled = gameRecord.ended === true;
            isAlreadyCanceled = gameRecord.refunded === true;
            break;
          case "Micro Gaming":
            isAlreadySettled = gameRecord.completed === true;
            isAlreadyCanceled = gameRecord.cancel === true;
            break;
          case "Habanero":
            isAlreadySettled =
              gameRecord.settle === true && gameRecord.freeSpinOngoing !== true;
            isAlreadyCanceled = gameRecord.refund === true;
            break;
          case "CQ9":
            isAlreadySettled = gameRecord.settle === true;
            isAlreadyCanceled = gameRecord.refund === true;
            break;
          case "Apollo":
          case "Fachai":
          case "Funky":
          case "JDB":
          case "Jili":
          case "Joker":
          case "Live22":
          case "Spade Gaming":
          case "Clotplay":
          case "EpicWin":
          case "BNG":
          case "Kagaming":
          case "Pegasus":
          case "UUSlot":
          case "KingMaker":
          default:
            isAlreadySettled = gameRecord.settle === true;
            isAlreadyCanceled = gameRecord.cancel === true;
            break;
        }

        // Check if this record needs updating
        if (action === "settle" && !isAlreadySettled) {
          recordsToUpdate.push(gameRecord);
        } else if (action === "cancel" && !isAlreadyCanceled) {
          recordsToUpdate.push(gameRecord);
        } else {
          alreadyProcessedRecords.push(gameRecord);
        }
      }

      // If no records need updating, return appropriate message
      if (recordsToUpdate.length === 0) {
        return res.status(200).json({
          success: false,
          message: {
            en: `All ${gameRecords.length} records are already ${action}${
              action === "settle" ? "d" : "ed"
            }`,
            zh: `所有 ${gameRecords.length} 条记录已经${
              action === "settle" ? "结算" : "取消"
            }`,
            ms: `Semua ${gameRecords.length} rekod sudah ${
              action === "settle" ? "diselesaikan" : "dibatalkan"
            }`,
            zh_hk: `所有 ${gameRecords.length} 條記錄已經${
              action === "settle" ? "結算" : "取消"
            }`,
            id: `Semua ${gameRecords.length} catatan sudah ${
              action === "settle" ? "diselesaikan" : "dibatalkan"
            }`,
          },
        });
      }

      // Determine update data based on action and game provider
      let updateData = {};

      if (action === "settle") {
        switch (gameName) {
          case "Pragmatic Play":
            updateData = { ended: true };
            break;
          case "Micro Gaming":
            updateData = { completed: true };
            break;
          case "Habanero":
            updateData = { settle: true, freeSpinOngoing: false };
            break;
          case "CQ9":
            updateData = { settle: true };
            break;
          default:
            updateData = { settle: true };
        }
      } else if (action === "cancel") {
        switch (gameName) {
          case "Pragmatic Play":
            updateData = { refunded: true, ended: true };
            break;
          case "Micro Gaming":
            updateData = { cancel: true };
            break;
          case "Habanero":
            updateData = { refund: true };
            break;
          case "CQ9":
            updateData = { refund: true };
            break;
          case "KingMaker":
            updateData = { settle: true };
            break;
          default:
            updateData = { cancel: true };
        }
      }

      let clientIp = req.headers["x-forwarded-for"] || req.ip;
      clientIp = clientIp.split(",")[0].trim();

      // Get the IDs of records to update
      const recordIdsToUpdate = recordsToUpdate.map((record) => record._id);

      // Update ALL matching records in a single operation
      const [updateResult] = await Promise.all([
        Model.updateMany(
          { _id: { $in: recordIdsToUpdate } },
          {
            $set: {
              ...updateData,
              manualUpdate: true,
              manualUpdateReason: reason,
            },
          }
        ),

        adminLog.create({
          username: admin.username,
          fullname: admin.fullname,
          ip: clientIp,
          remark: `Manual Update on BetID "${betId}" With Action "${action}" - Updated ${
            recordsToUpdate.length
          } records, ${
            alreadyProcessedRecords.length
          } already processed. Users: ${[
            ...new Set(recordsToUpdate.map((r) => r.username)),
          ].join(", ")}`,
        }),
      ]);

      if (!updateResult || updateResult.modifiedCount === 0) {
        return res.status(200).json({
          success: false,
          message: {
            en: "Failed to update game records",
            zh: "更新游戏记录失败",
            ms: "Gagal mengemas kini rekod permainan",
            zh_hk: "更新遊戲記錄失敗",
            id: "Gagal memperbarui catatan permainan",
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: {
          en: `Successfully ${action}d ${updateResult.modifiedCount} game records for ${gameName}. ${alreadyProcessedRecords.length} records were already processed.`,
          zh: `成功为 ${gameName} ${action === "settle" ? "结算" : "取消"} ${
            updateResult.modifiedCount
          } 条游戏记录。${alreadyProcessedRecords.length} 条记录已经处理过。`,
          ms: `Berjaya ${
            action === "settle" ? "menyelesaikan" : "membatalkan"
          } ${updateResult.modifiedCount} rekod permainan untuk ${gameName}. ${
            alreadyProcessedRecords.length
          } rekod sudah diproses.`,
          zh_hk: `成功為 ${gameName} ${action === "settle" ? "結算" : "取消"} ${
            updateResult.modifiedCount
          } 條遊戲記錄。${alreadyProcessedRecords.length} 條記錄已經處理過。`,
          id: `Berhasil ${
            action === "settle" ? "menyelesaikan" : "membatalkan"
          } ${
            updateResult.modifiedCount
          } catatan permainan untuk ${gameName}. ${
            alreadyProcessedRecords.length
          } catatan sudah diproses.`,
        },
        details: {
          totalRecordsFound: gameRecords.length,
          recordsUpdated: updateResult.modifiedCount,
          recordsAlreadyProcessed: alreadyProcessedRecords.length,
          affectedUsers: [...new Set(recordsToUpdate.map((r) => r.username))],
        },
      });
    } catch (error) {
      console.error("Manual game status update error:", error);
      return res.status(200).json({
        success: false,
        message: {
          en: "Internal server error while updating game status",
          zh: "更新游戏状态时发生内部服务器错误",
          ms: "Ralat pelayan dalaman semasa mengemas kini status permainan",
          zh_hk: "更新遊戲狀態時發生內部伺服器錯誤",
          id: "Kesalahan server internal saat memperbarui status permainan",
        },
      });
    }
  }
);

// router.post("/api/games/active-gamessss", async (req, res) => {
//   try {
//     const seenGameNames = new Set();
//     const uniqueActiveGames = [];
//     const queryModel = async (model, conditions, gameName) => {
//       try {
//         // Early return if we've already seen this game
//         if (seenGameNames.has(gameName)) {
//           return [];
//         }

//         const games = await model
//           .find(conditions) // No username filter - gets all users
//           .select(
//             "_id betId uniqueId tranId createdAt gameRoundCode username betamount"
//           )
//           .sort({ createdAt: -1 }) // Sort at DB level
//           .limit(100) // Increased limit since we're getting all users
//           .lean(); // Use lean() for faster queries

//         if (games.length > 0) {
//           seenGameNames.add(gameName);
//           return games.map((game) => ({
//             gameName,
//             betId:
//               game.betId || game.gameRoundCode || game.tranId || game.uniqueId,
//             username: game.username,
//             betamount: game.betamount,
//             createdAt: game.createdAt,
//           }));
//         }
//         return [];
//       } catch (error) {
//         console.error(`Error querying ${gameName}:`, error);
//         return [];
//       }
//     };

//     // Execute queries for all game providers
//     const gameQueries = await Promise.allSettled([
//       // queryModel(
//       //   SlotLivePPModal,
//       //   {
//       //     $or: [{ ended: false }, { ended: { $exists: false } }],
//       //     refunded: false,
//       //     gameType: "Slot",
//       //   },
//       //   "Pragmatic Play"
//       // ),
//       // queryModel(
//       //   SlotLiveMicroGamingModal,
//       //   {
//       //     $or: [{ completed: false }, { completed: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //     gameType: "SLOT",
//       //   },
//       //   "Micro Gaming"
//       // ),
//       // queryModel(
//       //   SlotApolloModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "Apollo"
//       // ),
//       // queryModel(
//       //   SlotCQ9Modal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //     refund: { $ne: true },
//       //     gametype: "SLOT",
//       //   },
//       //   "CQ9"
//       // ),
//       // queryModel(
//       //   SlotFachaiModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "Fachai"
//       // ),
//       // queryModel(
//       //   SlotFunkyModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "Funky"
//       // ),
//       // queryModel(
//       //   SlotHabaneroModal,
//       //   {
//       //     $or: [
//       //       {
//       //         $and: [
//       //           { $or: [{ settle: false }, { settle: { $exists: false } }] },
//       //           {
//       //             $or: [
//       //               { freeSpinOngoing: { $exists: false } },
//       //               { freeSpinOngoing: false },
//       //             ],
//       //           },
//       //         ],
//       //       },
//       //       { freeSpinOngoing: true },
//       //     ],
//       //     refund: { $ne: true },
//       //   },
//       //   "Habanero"
//       // ),
//       // queryModel(
//       //   SlotJDBModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //     gametype: "SLOT",
//       //   },
//       //   "JDB"
//       // ),
//       // queryModel(
//       //   SlotJiliModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //     gametype: "SLOT",
//       //   },
//       //   "Jili"
//       // ),
//       queryModel(
//         SlotJokerModal,
//         {
//           $or: [{ settle: false }, { settle: { $exists: false } }],
//           withdraw: { $ne: true },
//           deposit: { $ne: true },
//           cancel: { $ne: true },
//         },
//         "Joker"
//       ),
//       // queryModel(
//       //   SlotLive22Modal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "Live22"
//       // ),
//       // queryModel(
//       //   SlotSpadeGamingModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "Spade Gaming"
//       // ),
//       // queryModel(
//       //   SlotClotplayModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "Clotplay"
//       // ),
//       // queryModel(
//       //   SlotEpicWinModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "EpicWin"
//       // ),
//       // queryModel(
//       //   SlotBNGModal,
//       //   {
//       //     $or: [{ settle: false }, { settle: { $exists: false } }],
//       //     cancel: { $ne: true },
//       //   },
//       //   "BNG"
//       // ),
//     ]);

//     // Process results
//     gameQueries.forEach((result) => {
//       if (
//         result.status === "fulfilled" &&
//         result.value &&
//         result.value.length > 0
//       ) {
//         uniqueActiveGames.push(...result.value);
//       } else if (result.status === "rejected") {
//         console.error("Query failed:", result.reason);
//       }
//     });

//     // Sort the final unique results
//     uniqueActiveGames.sort(
//       (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//     );

//     return res.status(200).json({
//       success: true,
//       totalActiveGames: uniqueActiveGames.length,
//       activeGames: uniqueActiveGames,
//       message: {
//         en: "All active games across all users retrieved successfully.",
//         zh: "成功检索所有用户的活跃游戏。",
//         ms: "Permainan aktif semua pengguna berjaya diperoleh.",
//         zh_hk: "成功搵到所有用戶嘅活躍遊戲喇。",
//         id: "Permainan aktif semua pengguna berhasil diambil.",
//       },
//     });
//   } catch (error) {
//     console.error("Error finding active games for all users:", error);
//     return res.status(500).json({
//       success: false,
//       message: {
//         en: "Internal Server Error. Please contact customer support for further assistance.",
//         zh: "内部服务器错误。请联系客服以获取进一步帮助。",
//         ms: "Ralat dalaman pelayan. Sila hubungi sokongan pelanggan untuk bantuan lanjut.",
//         zh_hk: "內部伺服器出咗問題。老闆麻煩聯絡客服，我哋會幫你跟進。",
//         id: "Kesalahan server internal. Silakan hubungi dukungan pelanggan untuk bantuan lebih lanjut.",
//       },
//     });
//   }
// });
module.exports = router;
