const express = require("express");

// Create an Express router block to handle path bindings
const router = express.Router();

/**
 * GET /health
 * Simple diagnostic endpoint used by the frontend client to verify
 * that the API server is online and responding.
 */
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "offline-devices-caller",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
