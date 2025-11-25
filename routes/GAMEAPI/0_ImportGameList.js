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
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const GameWalletLog = require("../../models/gamewalletlog.model");

const GameApolloGameModal = require("../../models/slot_apolloDatabase.model");
const GameClotPlayGameModal = require("../../models/slot_clotplayDatabase.model");
const GameCq9GameModal = require("../../models/slot_cq9Database.model");
const GameEpicWinGameModal = require("../../models/slot_epicwinDatabase.model");
const GameFachaiGameModal = require("../../models/slot_fachaiDatabase.model");
const GameFunkyGameModal = require("../../models/slot_funkyDatabase.model");
const GameHabaneroGameModal = require("../../models/slot_habaneroDatabase.model");
const GameJDBGameModal = require("../../models/slot_jdbDatabase.model");
const GameJILIGameModal = require("../../models/slot_jiliDatabase.model");
const GameJokerGameModal = require("../../models/slot_jokerDatabase.model");
const GameMicroGamingGameModal = require("../../models/slot_live_microgamingDatabase.model");
const GamePPGameModal = require("../../models/slot_live_ppDatabase.model");
const GameLive22GameModal = require("../../models/slot_live22Database.model");
const GameSpadeGamingGameModal = require("../../models/slot_spadegamingDatabase.model");
const GameBNGGameModal = require("../../models/slot_bngDatabase.model");
const GamePegasusGameModal = require("../../models/slot_pegasusDatabase.model");
const GameKingMakerGameModal = require("../../models/slot_kingmakerDatabase.model");
const GameUUSLOTGameModal = require("../../models/slot_uuslotDatabase.model");
const GamePGSlotGameModal = require("../../models/slot_pgslotDatabase.model");
const GameRedTigerGameModal = require("../../models/slot_redtigerDatabase.model");
const GameNetentGameModal = require("../../models/slot_netentDatabase.model");

const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const multer = require("multer");

require("dotenv").config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function normalizeGameType(typeFromExcel) {
  if (!typeFromExcel) return null;

  const type = typeFromExcel.toLowerCase();
  if (type.includes("slot")) return "Slot";
  if (type.includes("fish")) return "Fishing";
  if (type.includes("table")) return "Table";
  if (type.includes("arcade")) return "Arcade";
  if (type.includes("other")) return "Other";
  if (type.includes("poker")) return "Poker";
  return null; // Not recognized
}

function parseRTP(rtpRaw) {
  if (typeof rtpRaw === "number") {
    return (rtpRaw * 100).toFixed(2) + "%";
  }

  if (typeof rtpRaw === "string") {
    const trimmed = rtpRaw.trim();
    if (trimmed.endsWith("%")) {
      return trimmed;
    } else if (!isNaN(trimmed)) {
      return parseFloat(trimmed).toFixed(2) + "%";
    }
  }

  return null;
}

router.post("/api/playtech/import-games", async (req, res) => {
  try {
    const importFilePath = path.join(__dirname, "../../public/netent.json");

    // Check if file exists
    if (!fs.existsSync(importFilePath)) {
      return res.status(404).json({
        success: false,
        message: "Import file not found.",
      });
    }

    // Read and parse the JSON file
    const fileData = fs.readFileSync(importFilePath, "utf8");
    const gameList = JSON.parse(fileData);

    if (!gameList || !Array.isArray(gameList) || gameList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Import file is empty or invalid.",
      });
    }

    // Insert into MongoDB
    await GameNetentGameModal.insertMany(gameList);

    return res.status(200).json({
      success: true,
      message: `${gameList.length} game records imported successfully.`,
    });
  } catch (error) {
    console.error("Error importing Playtech game data:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to import game data.",
      error: error.message,
    });
  }
});

router.post("/api/importGameList/168168", async (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      "../../public/Game_Import_Template.xlsx"
    );
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const games = [];

    for (const row of rows) {
      const normalizedType = normalizeGameType(row["Game Type"]);
      if (!normalizedType) {
        console.log("Skipping invalid game type:", row["Game Type"]);
        continue;
      }

      const rtpValue = parseRTP(
        row["RTP "] || row["RTP\n"] || row["RTP \n返還率"]
      );

      const parseHotStatus = (hotValue) => {
        if (typeof hotValue === "boolean") {
          return hotValue;
        }

        if (typeof hotValue === "string") {
          const normalizedValue = hotValue.trim().toLowerCase();
          return (
            normalizedValue === "true" ||
            normalizedValue === "1" ||
            normalizedValue === "yes"
          );
        }

        if (typeof hotValue === "number") {
          return hotValue === 1;
        }

        return false; // Default to false if undefined or unrecognized
      };

      // const hotStatus = parseHotStatus(row["Hot"]);

      games.push({
        gameNameEN: row["Game Name"],
        gameNameCN: row["Simplified Chinese"],
        // gameNameHK: row["Traditional Chinese"],
        // gameNameMS: row["Indonesia"],
        // gameNameMS: row["Malay"],
        gameID: row["Game Code"],
        gameType: normalizedType,
        rtpRate: rtpValue,
        maintenance: true,
        // hot: hotStatus,
      });
    }

    if (games.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid games to import." });
    }

    await GamePPGameModal.insertMany(games);
    res.status(200).json({
      success: true,
      imported: games.length,
      message: "CQ9 games imported successfully",
    });
  } catch (error) {
    console.error("Import CQ9 Games Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error importing CQ9 games" });
  }
});

router.post("/api/updateCQ9TraditionalChinese", async (req, res) => {
  try {
    // Read the Excel file
    const filePath = path.join(
      __dirname,
      "../../public/Game_Import_Template.xlsx"
    );

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log(`Processing ${rows.length} rows from Excel file`);

    let updated = 0;
    let notFound = 0;
    let errors = [];

    // Process each row from Excel
    for (const row of rows) {
      try {
        const gameCode = row["Game Code"];
        const traditionalChinese = row["Traditional Chinese"];

        // Skip rows without Game Code or Traditional Chinese
        if (!gameCode || !traditionalChinese) {
          console.log(
            `Skipping row - missing Game Code or Traditional Chinese:`,
            {
              gameCode,
              traditionalChinese,
            }
          );
          continue;
        }

        // Find and update the game in CQ9 database by gameID (Game Code)
        const updateResult = await GameCq9GameModal.findOneAndUpdate(
          { gameID: gameCode }, // Match by Game Code
          {
            $set: {
              GameNameHK: traditionalChinese, // Update Traditional Chinese name
            },
          },
          { new: true } // Return updated document
        );

        if (updateResult) {
          updated++;
          console.log(`✅ Updated ${gameCode}: ${traditionalChinese}`);
        } else {
          notFound++;
          console.log(`❌ Game not found: ${gameCode}`);
        }
      } catch (rowError) {
        errors.push(
          `Error processing Game Code ${row["Game Code"]}: ${rowError.message}`
        );
        console.error(`Error processing row:`, rowError.message);
      }
    }

    // Return summary
    return res.status(200).json({
      success: true,
      message: `Traditional Chinese names update completed`,
      summary: {
        totalProcessed: rows.length,
        updated: updated,
        notFound: notFound,
        errors: errors.length,
      },
      details: {
        updatedGames: updated,
        gamesNotFound: notFound,
        errorMessages: errors.slice(0, 10), // Show first 10 errors only
      },
    });
  } catch (error) {
    console.error("Update Traditional Chinese Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update Traditional Chinese names",
      error: error.message,
    });
  }
});

// router.post("/api/importImgUrl/168168", async (req, res) => {
//   try {
//     const bucket = "allgameassets";
//     const basePathEN = "habanero/en/";
//     const basePathCN = "habanero/zh/";

//     // Get all games from the database
//     const allGames = await GameHabaneroGameModal.find(
//       {
//         $or: [
//           { imageUrlEN: { $exists: false } },
//           { imageUrlEN: "" },
//           { imageUrlCN: { $exists: false } },
//           { imageUrlCN: "" },
//         ],
//       },
//       { gameID: 1 }
//     );

//     if (!allGames.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No games found in database to sync",
//       });
//     }

//     // Get all objects from S3 for both EN and CN paths using AWS SDK v3
//     const [enObjectsResult, cnObjectsResult] = await Promise.all([
//       s3Client.send(
//         new ListObjectsV2Command({
//           Bucket: bucket,
//           Prefix: basePathEN,
//         })
//       ),
//       s3Client.send(
//         new ListObjectsV2Command({
//           Bucket: bucket,
//           Prefix: basePathCN,
//         })
//       ),
//     ]);

//     // Extract just the filenames and create lookup maps
//     const enImageMap = {};
//     const cnImageMap = {};

//     // Process EN images
//     enObjectsResult.Contents.forEach((object) => {
//       const filename = object.Key.split("/").pop(); // Get filename without path
//       const gameId = filename.split("_")[0]; // Extract gameId part

//       if (gameId) {
//         enImageMap[
//           gameId
//         ] = `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${object.Key}`;
//       }
//     });

//     // Process CN images
//     cnObjectsResult.Contents.forEach((object) => {
//       const filename = object.Key.split("/").pop(); // Get filename without path
//       const gameId = filename.split("_")[0]; // Extract gameId part

//       if (gameId) {
//         cnImageMap[
//           gameId
//         ] = `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${object.Key}`;
//       }
//     });

//     // Update each game document with the corresponding image URLs
//     const updatePromises = allGames.map(async (game) => {
//       const gameId = game.gameID;
//       const updates = {};

//       if (enImageMap[gameId]) {
//         updates.imageUrlEN = enImageMap[gameId];
//       }

//       if (cnImageMap[gameId]) {
//         updates.imageUrlCN = cnImageMap[gameId];
//       }

//       // Only update if we found at least one matching image
//       if (Object.keys(updates).length > 0) {
//         return GameHabaneroGameModal.findByIdAndUpdate(
//           game._id,
//           { $set: updates },
//           { new: true }
//         );
//       }
//       return null;
//     });

//     // Execute all updates
//     const results = await Promise.all(updatePromises);

//     // Count successful updates (non-null results)
//     const updatedCount = results.filter((result) => result !== null).length;

//     return res.status(200).json({
//       success: true,
//       message: `Successfully synced images for ${updatedCount} games`,
//       totalGames: allGames.length,
//       updatedGames: updatedCount,
//     });
//   } catch (error) {
//     console.error("Error syncing Kiss918 game images:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to sync game images",
//       error: error.message,
//     });
//   }
// });

router.post("/api/importImgUrl/pragmaticplay", async (req, res) => {
  try {
    const bucket = "allgameslist";
    const basePathEN = "pragmaticplay/en/";
    const basePathZH = "pragmaticplay/zh/";

    // Get all games from the database that need image URLs
    const allGames = await GamePPGameModal.find(
      {
        $or: [
          { imageUrlEN: { $exists: false } },
          { imageUrlEN: "" },
          { imageUrlEN: null },
          { imageUrlCN: { $exists: false } },
          { imageUrlCN: "" },
          { imageUrlCN: null },
        ],
      },
      { gameID: 1, gameNameEN: 1 }
    );

    if (!allGames.length) {
      return res.status(404).json({
        success: false,
        message: "No games found in database to sync",
      });
    }

    // Helper function to normalize text for comparison
    function normalizeText(text) {
      if (!text) return "";
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") // Remove all special characters, spaces, etc.
        .trim();
    }

    // Helper function to extract game name from S3 filename
    function extractGameNameFromS3Filename(filename) {
      // Decode URL encoding first (e.g., Lucky+Dog -> Lucky Dog)
      const decodedFilename = decodeURIComponent(filename);

      // Remove file extension first
      const nameWithoutExt = decodedFilename.replace(
        /\.(png|jpg|jpeg|gif|webp)$/i,
        ""
      );

      // Take anything before _500x500 or similar patterns
      const cleanedName = nameWithoutExt.split(/_\d+x\d+/)[0];

      // Normalize and return
      return normalizeText(cleanedName);
    }

    // Helper function to find exact match for a game name
    function findExactMatch(gameNameEN, imageFilenames, imageMap) {
      const normalizedGameName = normalizeText(gameNameEN);

      for (const filename of imageFilenames) {
        const extractedGameName = extractGameNameFromS3Filename(filename);

        if (extractedGameName === normalizedGameName) {
          return {
            match: filename,
            extractedName: extractedGameName,
            originalGameName: gameNameEN,
            imageUrl: imageMap[filename],
          };
        }
      }

      return null;
    }

    // Get all objects from S3 for EN path
    const enObjectsResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: basePathEN,
      })
    );

    // Get all objects from S3 for ZH/CN path
    const zhObjectsResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: basePathZH,
      })
    );

    // Extract filenames and create URL map for EN
    const enImageNames = [];
    const enImageMap = {};

    if (enObjectsResult.Contents) {
      enObjectsResult.Contents.forEach((object) => {
        const filename = object.Key.split("/").pop();
        if (filename && filename !== basePathEN.split("/").pop()) {
          enImageNames.push(filename);
          enImageMap[
            filename
          ] = `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${object.Key}`;
        }
      });
    }

    // Extract filenames and create URL map for ZH/CN
    const zhImageNames = [];
    const zhImageMap = {};

    if (zhObjectsResult.Contents) {
      zhObjectsResult.Contents.forEach((object) => {
        const filename = object.Key.split("/").pop();
        if (filename && filename !== basePathZH.split("/").pop()) {
          zhImageNames.push(filename);
          zhImageMap[
            filename
          ] = `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${object.Key}`;
        }
      });
    }

    console.log(`Found ${enImageNames.length} EN images in S3`);
    console.log(`Found ${zhImageNames.length} ZH/CN images in S3`);

    // Update each game document with the corresponding image URLs
    let updatedENCount = 0;
    let updatedCNCount = 0;
    let updatedBothCount = 0;
    const matchingResults = [];
    const noMatchResults = [];

    const updatePromises = allGames.map(async (game) => {
      // Find EN image match
      const enMatch = findExactMatch(game.gameNameEN, enImageNames, enImageMap);

      // Find ZH/CN image match
      const zhMatch = findExactMatch(game.gameNameEN, zhImageNames, zhImageMap);

      const updateFields = {};

      if (enMatch) {
        updateFields.imageUrlEN = enMatch.imageUrl;
        updatedENCount++;
      }

      if (zhMatch) {
        updateFields.imageUrlCN = zhMatch.imageUrl;
        updatedCNCount++;
      }

      if (Object.keys(updateFields).length > 0) {
        // Update the game with the matched image URLs
        await GamePPGameModal.findByIdAndUpdate(
          game._id,
          { $set: updateFields },
          { new: true }
        );

        if (enMatch && zhMatch) {
          updatedBothCount++;
        }

        matchingResults.push({
          gameID: game.gameID,
          gameNameEN: game.gameNameEN,
          matchedImageEN: enMatch ? enMatch.match : null,
          matchedImageCN: zhMatch ? zhMatch.match : null,
          extractedName: enMatch
            ? enMatch.extractedName
            : zhMatch
            ? zhMatch.extractedName
            : null,
          imageUrlEN: enMatch ? enMatch.imageUrl : null,
          imageUrlCN: zhMatch ? zhMatch.imageUrl : null,
        });

        console.log(
          `Match: GameName "${game.gameNameEN}" -> EN: "${
            enMatch ? enMatch.match : "N/A"
          }" | CN: "${zhMatch ? zhMatch.match : "N/A"}"`
        );
      } else {
        noMatchResults.push({
          gameID: game.gameID,
          gameNameEN: game.gameNameEN,
          normalizedName: normalizeText(game.gameNameEN),
        });

        console.log(
          `No Match: GameName "${game.gameNameEN}" (Normalized: ${normalizeText(
            game.gameNameEN
          )}) - no matching image found`
        );
      }
    });

    // Execute all updates
    await Promise.all(updatePromises);

    // Log examples of available S3 images for debugging
    console.log("\n=== S3 EN IMAGE EXAMPLES ===");
    enImageNames.slice(0, 10).forEach((filename) => {
      console.log(
        `S3 File: "${filename}" -> Extracted: "${extractGameNameFromS3Filename(
          filename
        )}"`
      );
    });

    console.log("\n=== S3 ZH/CN IMAGE EXAMPLES ===");
    zhImageNames.slice(0, 10).forEach((filename) => {
      console.log(
        `S3 File: "${filename}" -> Extracted: "${extractGameNameFromS3Filename(
          filename
        )}"`
      );
    });

    // Log some examples of games that didn't match
    console.log("\n=== NO MATCH EXAMPLES ===");
    noMatchResults.slice(0, 10).forEach((result) => {
      console.log(
        `Game: "${result.gameNameEN}" -> Normalized: "${result.normalizedName}"`
      );
    });

    console.log("\n=== MATCHING SUMMARY ===");
    console.log(`Total Games: ${allGames.length}`);
    console.log(`Updated EN Images: ${updatedENCount}`);
    console.log(`Updated CN Images: ${updatedCNCount}`);
    console.log(`Updated Both Images: ${updatedBothCount}`);
    console.log(`No Match Games: ${noMatchResults.length}`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced images for Pragmatic Play games`,
      totalGames: allGames.length,
      updatedENImages: updatedENCount,
      updatedCNImages: updatedCNCount,
      updatedBothImages: updatedBothCount,
      noMatchGames: noMatchResults.length,
      enImagesFoundInS3: enImageNames.length,
      zhImagesFoundInS3: zhImageNames.length,
      matchingExamples: matchingResults.slice(0, 10),
      noMatchExamples: noMatchResults.slice(0, 10),
      s3ImageExamples: {
        en: enImageNames.slice(0, 5).map((filename) => ({
          filename,
          extractedName: extractGameNameFromS3Filename(filename),
          fullUrl: enImageMap[filename],
        })),
        zh: zhImageNames.slice(0, 5).map((filename) => ({
          filename,
          extractedName: extractGameNameFromS3Filename(filename),
          fullUrl: zhImageMap[filename],
        })),
      },
    });
  } catch (error) {
    console.error("Error syncing Pragmatic Play game images:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to sync game images",
      error: error.message,
    });
  }
});

// Add this route to your existing file

router.post("/api/cleanupGameImages/168168", async (req, res) => {
  try {
    // Base directory containing game folders (update this path to match your structure)
    const baseDirectory = path.join(__dirname, "../../public/games");

    let totalGameFolders = 0;
    let totalFilesScanned = 0;
    let filesDeleted = 0;
    let filesKept = 0;
    let errors = [];

    // Check if base directory exists
    if (!fs.existsSync(baseDirectory)) {
      return res.status(404).json({
        success: false,
        message: `Base directory not found: ${baseDirectory}`,
      });
    }

    // Get all game folders
    const gameFolders = fs
      .readdirSync(baseDirectory, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    totalGameFolders = gameFolders.length;

    // Process each game folder
    for (const gameFolder of gameFolders) {
      const gamePath = path.join(baseDirectory, gameFolder);

      // Read all files in the game folder
      const files = fs.readdirSync(gamePath);
      totalFilesScanned += files.length;

      // Process each file
      for (const file of files) {
        // Only process image files
        if (
          file.endsWith(".png") ||
          file.endsWith(".jpg") ||
          file.endsWith(".jpeg")
        ) {
          const filePath = path.join(gamePath, file);

          // Keep files ending with en_square.png or cn_square.png
          if (
            file.endsWith("en_square.png") ||
            file.endsWith("cn_square.png")
          ) {
            filesKept++;
          } else {
            try {
              // Delete other image files
              fs.unlinkSync(filePath);
              filesDeleted++;
            } catch (err) {
              console.error(`Error deleting file ${filePath}:`, err);
              errors.push({ file: filePath, error: err.message });
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Game images cleanup completed successfully",
      details: {
        totalGameFolders,
        totalFilesScanned,
        filesKept,
        filesDeleted,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("Error cleaning up game images:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to clean up game images",
      error: error.message,
    });
  }
});

router.post("/api/separateLanguageImages/168168", async (req, res) => {
  try {
    // Source directory containing all images
    const sourceDirectory = path.join(__dirname, "../../public/hi");

    // Destination directories
    const enDestDirectory = path.join(__dirname, "../../public/images/en");
    const zhDestDirectory = path.join(__dirname, "../../public/images/zh");

    // Create destination directories if they don't exist
    if (!fs.existsSync(enDestDirectory)) {
      fs.mkdirSync(enDestDirectory, { recursive: true });
    }

    if (!fs.existsSync(zhDestDirectory)) {
      fs.mkdirSync(zhDestDirectory, { recursive: true });
    }

    // Statistics for reporting
    let totalFilesProcessed = 0;
    let enFilesCount = 0;
    let zhFilesCount = 0;
    let errors = [];

    // Check if source directory exists
    if (!fs.existsSync(sourceDirectory)) {
      return res.status(404).json({
        success: false,
        message: `Source directory not found: ${sourceDirectory}`,
      });
    }

    // Get all files in the source directory
    const files = fs.readdirSync(sourceDirectory);

    // Process each file
    for (const file of files) {
      // Skip directories
      const filePath = path.join(sourceDirectory, file);
      if (fs.statSync(filePath).isDirectory()) {
        continue;
      }

      // Process only image files
      if (
        file.endsWith(".png") ||
        file.endsWith(".jpg") ||
        file.endsWith(".jpeg")
      ) {
        totalFilesProcessed++;

        try {
          if (file.includes("cn")) {
            // Chinese image
            const destPath = path.join(zhDestDirectory, file);
            fs.copyFileSync(filePath, destPath);
            fs.unlinkSync(filePath); // Remove from source
            zhFilesCount++;
          } else if (file.includes("en")) {
            // English image
            const destPath = path.join(enDestDirectory, file);
            fs.copyFileSync(filePath, destPath);
            fs.unlinkSync(filePath); // Remove from source
            enFilesCount++;
          } else {
            // Skip files without 'en' or 'cn' in name
            console.log(`Skipping non-language image file: ${file}`);
            continue;
          }
        } catch (err) {
          console.error(`Error processing file ${file}:`, err);
          errors.push({ file, error: err.message });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Images separated successfully",
      details: {
        totalFilesProcessed,
        enFilesCount,
        zhFilesCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("Error separating language images:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to separate language images",
      error: error.message,
    });
  }
});

router.post("/api/jili/updateMalayName", async (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      "../../public/Game_Import_Template.xlsx"
    );
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ success: false, message: "Excel file not found." });
    }

    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let updatedCount = 0;

    for (const row of rows) {
      const gameName = String(row["Game Name"] || "").trim();
      const malayName = String(row["Malay Name"] || "").trim();

      if (!gameName || !malayName) continue;

      const updated = await GameJILIGameModal.findOneAndUpdate(
        { gameNameEN: gameName },
        { $set: { gameNameMS: malayName } }
      );

      if (updated) updatedCount++;
    }

    res.status(200).json({
      success: true,
      updated: updatedCount,
      message: `${updatedCount} gameNameMS fields updated successfully.`,
    });
  } catch (error) {
    console.error("Error updating Malay Names:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to update database." });
  }
});

router.post("/api/jili/getgamelistMissing", async (req, res) => {
  try {
    // Fetch all games from the database (or add filters as needed)
    const missingImageGames = await GamePPGameModal.find({
      $or: [
        { imageUrlEN: { $exists: false } },
        { imageUrlEN: "" },
        { imageUrlCN: { $exists: false } },
        { imageUrlCN: "" },
      ],
    });
    console.log(missingImageGames.length);
    return res.status(200).json({
      success: true,
      gamelist: missingImageGames,
    });
  } catch (error) {
    console.log("CQ9 error fetching game list:", error.message);
    return res.status(200).json({
      success: false,
      message: {
        en: "CQ9: Unable to retrieve game lists. Please contact customer service for assistance.",
        zh: "CQ9: 无法获取游戏列表，请联系客服以获取帮助。",
        ms: "CQ9: Tidak dapat mendapatkan senarai permainan. Sila hubungi khidmat pelanggan untuk bantuan.",
      },
    });
  }
});

router.get("/admin/api/exporttojson", async (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    // Fetch all games from the database
    const games = await GameNetentGameModal.find({}).lean();

    if (!games || games.length === 0) {
      return res.status(200).json({
        success: false,
        message: {
          en: "No games found to export.",
          zh: "没有找到要导出的游戏。",
          ms: "Tiada permainan ditemui untuk dieksport.",
        },
      });
    }

    // Create the JSON data
    const exportData = {
      exportDate: new Date().toISOString(),
      totalGames: games.length,
      games: games,
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `pp.json`;
    const filepath = path.join(__dirname, "../../exports", filename);

    // Ensure exports directory exists
    const exportsDir = path.dirname(filepath);
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

    console.log(`GamePP data exported to: ${filepath}`);

    return res.status(200).json({
      success: true,
      message: {
        en: "Games exported successfully.",
        zh: "游戏导出成功。",
        ms: "Permainan berjaya dieksport.",
      },
      data: {
        filename: filename,
        totalGames: games.length,
        exportPath: filepath,
      },
    });
  } catch (error) {
    console.error("Error exporting GamePP data:", error.message);
    return res.status(500).json({
      success: false,
      message: {
        en: "Failed to export games. Please try again.",
        zh: "导出游戏失败，请重试。",
        ms: "Gagal mengeksport permainan. Sila cuba lagi.",
      },
      error: error.message,
    });
  }
});

router.post("/admin/api/importfromjson", async (req, res) => {
  try {
    // Path to your JSON file - update this path
    const jsonFilePath = path.join(__dirname, "../../data/habanero_games.json");

    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
      return res.status(400).json({
        success: false,
        message:
          "JSON file not found. Please place the file at: " + jsonFilePath,
      });
    }

    // Read and parse JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

    // Extract games array from your JSON structure
    const gamesArray = jsonData.games || [];

    if (gamesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No games data found in JSON file",
      });
    }

    console.log(`Found ${gamesArray.length} games in JSON file`);

    // Insert games using upsert to avoid duplicates
    const insertResults = {
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const gameData of gamesArray) {
      try {
        // Skip if missing required fields
        if (!gameData.gameID || !gameData.gameNameEN) {
          insertResults.errors.push(
            `Game missing required fields: ${gameData.gameID || "Unknown"}`
          );
          continue;
        }

        const result = await GameHabaneroGameModal.findOneAndUpdate(
          { gameID: gameData.gameID }, // Find by gameID
          {
            $set: {
              gameNameEN: gameData.gameNameEN,
              gameNameCN: gameData.gameNameCN || "",
              imageUrlEN: gameData.imageUrlEN || "",
              imageUrlCN: gameData.imageUrlCN || "",
              gameType: gameData.gameType || "Slot",
              rtpRate: gameData.rtpRate || "",
              hot: gameData.hot || false,
              gameID: gameData.gameID,
            },
          },
          {
            upsert: true,
            new: true,
            lean: true,
            setDefaultsOnInsert: true,
          }
        );

        // Check if it was created or updated by comparing timestamps
        const now = new Date();
        const createdAt = new Date(result.createdAt);
        const timeDiff = Math.abs(now - createdAt);

        // If created within last 1000ms, consider it as newly created
        if (timeDiff < 1000) {
          insertResults.created++;
        } else {
          insertResults.updated++;
        }
      } catch (error) {
        insertResults.errors.push(
          `GameID ${gameData.gameID}: ${error.message}`
        );
      }
    }

    res.json({
      success: true,
      message: "Games import completed successfully",
      results: {
        totalInFile: jsonData.totalGames,
        totalProcessed: gamesArray.length,
        created: insertResults.created,
        updated: insertResults.updated,
        errors: insertResults.errors,
      },
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import games",
      error: error.message,
    });
  }
});

router.get("/api/playtech/export-games", async (req, res) => {
  try {
    const allGames = await GameSpadeGamingGameModal.find().lean(); // lean() for plain JS objects

    if (!allGames || allGames.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No game data found to export.",
      });
    }

    // Create a temporary file
    const exportFilePath = path.join(
      __dirname,
      "../../exports/spadegaming.json"
    );

    // Ensure export directory exists
    const exportDir = path.dirname(exportFilePath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    fs.writeFileSync(exportFilePath, JSON.stringify(allGames, null, 2), "utf8");

    // Send file for download
    res.download(exportFilePath, "playtech_games_export.json", (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(500).json({
          success: false,
          message: "Failed to export file.",
        });
      } else {
        console.log("Playtech game data exported successfully.");
      }
    });
  } catch (error) {
    console.error("Error exporting Playtech game data:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to export game data.",
      error: error.message,
    });
  }
});

router.post("/admin/api/replace-s3-with-cloudfront", async (req, res) => {
  try {
    const CLOUDFRONT_BASE_URL = "https://d2bdzvbz2cmjb8.cloudfront.net";
    const S3_PREFIX = "https://allgameslist.s3.ap-southeast-1.amazonaws.com";

    const modelsToUpdate = [
      // GameApolloGameModal,
      // GameClotPlayGameModal,
      // GameCq9GameModal,
      // GameEpicWinGameModal,
      // GameFachaiGameModal,
      // GameFunkyGameModal,
      // GameHabaneroGameModal,
      // GameJDBGameModal,
      // GameJILIGameModal,
      // GameJokerGameModal,
      // GameMicroGamingGameModal,
      GamePPGameModal,
      // GameLive22GameModal,
      // GameSpadeGamingGameModal,
      // GameBNGGameModal,
      // GameKingMakerGameModal,
      // GamePGSlotGameModal,
      // GameRedTigerGameModal,
      // GameNetentGameModal,
    ];

    let totalUpdated = 0;
    let updatedDocs = [];
    let nonS3Urls = [];

    for (const Model of modelsToUpdate) {
      const records = await Model.find();

      for (const record of records) {
        let changed = false;

        const fields = ["imageUrlEN", "imageUrlCN", "imageUrlID", "imageUrlHK"];

        for (const field of fields) {
          const currentUrl = record[field];
          if (currentUrl && currentUrl.startsWith(S3_PREFIX)) {
            record[field] = currentUrl.replace(S3_PREFIX, CLOUDFRONT_BASE_URL);
            changed = true;
          } else if (
            currentUrl &&
            !currentUrl.startsWith(CLOUDFRONT_BASE_URL)
          ) {
            // Not using S3 or CloudFront — log it
            nonS3Urls.push({
              id: record._id,
              gameID: record.gameID,
              field: field,
              currentUrl,
            });
          }
        }

        if (changed) {
          await record.save();
          totalUpdated++;
          updatedDocs.push({
            id: record._id,
            gameID: record.gameID,
            imageUrlEN: record.imageUrlEN,
            imageUrlCN: record.imageUrlCN,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${totalUpdated} game documents.`,
      updatedSample: updatedDocs.slice(0, 10),
      nonS3UrlsSample: nonS3Urls, // show sample of entries not using S3 or CloudFront
      nonS3UrlsTotal: nonS3Urls.length,
    });
  } catch (error) {
    console.error("Error replacing S3 URLs with CloudFront:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update image URLs",
      error: error.message,
    });
  }
});

module.exports = router;
