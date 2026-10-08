const express = require("express");
const { syncCustomersFromZoho } = require("../services/customerService");

const router = express.Router();

/**
 * POST /sync
 * Manual trigger endpoint:
 * Downloads the latest offline-device support tasks from Zoho Projects,
 * parses customer details, and upserts them in MongoDB.
 */
router.post("/sync", async (_req, res) => {
  try {
    // 1. Run the sync service orchestration
    const result = await syncCustomersFromZoho();
    
    // 2. Return success results containing sync statistics
    res.json({
      ok: true,
      message: "Zoho sync completed",
      project: result.project,
      parentTask: result.parentTask,
      totalFetched: result.totalFetched,
      totalSaved: result.totalSaved,
    });
  } catch (error) {
    console.error("Zoho sync failed:", error.message);
    
    // 3. Return structured error response if sync fails (e.g. invalid Zoho API keys)
    res.status(500).json({
      ok: false,
      error: error.message,
      code: error.code || "SYNC_FAILED",
    });
  }
});

module.exports = router;
