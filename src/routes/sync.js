const express = require("express");
const { syncCustomersFromZoho } = require("../services/customerService");

const router = express.Router();

/**
 * POST /sync
 * Pull latest customers from Zoho Projects and save to MongoDB.
 */
router.post("/sync", async (_req, res) => {
  try {
    const result = await syncCustomersFromZoho();
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
    res.status(500).json({
      ok: false,
      error: error.message,
      code: error.code || "SYNC_FAILED",
    });
  }
});

module.exports = router;
