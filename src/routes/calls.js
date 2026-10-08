const express = require("express");
const Customer = require("../models/Customer");
const { findCustomerById } = require("../services/customerService");
const { triggerOutboundCall, isConfigured } = require("../services/exotelService");

const router = express.Router();

/**
 * POST /calls/trigger
 * Body parameters: { "customerId": "<Object ID>" } OR { "toNumber": "+91..." }
 * 
 * Use case: Triggers an automated follow-up call. Supports developer simulation mode.
 */
router.post("/calls/trigger", async (req, res) => {
  try {
    // 1. Determine if we are running in simulation mode.
    // Simulates calls if SIMULATE_CALLS is true, or if Exotel credentials are missing from .env.
    const simulate = process.env.SIMULATE_CALLS !== "false" && (!isConfigured() || process.env.SIMULATE_CALLS === "true");

    // If simulation is turned off and Exotel is not configured, deny request
    if (!simulate && !isConfigured()) {
      return res.status(503).json({
        ok: false,
        code: "EXOTEL_NOT_CONFIGURED",
        message: "Exotel credentials are not set yet. This endpoint is ready for Phase 4.",
      });
    }

    const { customerId, toNumber } = req.body || {};
    let customer = null;

    // 2. Resolve customer by ID if provided
    if (customerId) {
      customer = await findCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({ ok: false, error: "Customer not found" });
      }
    }

    // Determine the phone number to dial
    const dialNumber = toNumber || customer?.cxNumber;
    if (!dialNumber) {
      return res.status(400).json({
        ok: false,
        error: "Provide customerId or toNumber",
      });
    }

    let exotelResponse;
    
    // 3. EXECUTE: Simulation vs. Live API call
    if (simulate) {
      // --- SIMULATION MODE ---
      // Generate a mock Exotel Call SID
      exotelResponse = {
        Call: {
          Sid: `mock_exotel_sid_${Math.random().toString(36).substring(7)}`,
          Status: "in-progress",
        }
      };
      console.log(`[Simulation] Call simulated for ${dialNumber}. Exotel SID: ${exotelResponse.Call.Sid}`);

      // Schedule a background timeout task (6 seconds) to mock a terminal webhook update.
      // This lets developers test the live status transition polling without configuring Exotel.
      if (customer) {
        const { handleExotelStatusCallback } = require("../services/callStatusService");
        
        setTimeout(async () => {
          try {
            console.log(`[Simulation] Simulating webhook callback for customer: ${customer.cxName}`);
            
            // Randomly pick a terminal status outcome to test different visual badge flows
            const randomStatuses = ["completed", "completed", "no_answer", "failed"];
            const selectedStatus = randomStatuses[Math.floor(Math.random() * randomStatuses.length)];

            // Call the status callback coordinator service as if an external HTTP request was received
            await handleExotelStatusCallback({
              CallSid: exotelResponse.Call.Sid,
              CustomField: customer._id.toString(), // Passes customer Object ID to resolve matching document
              To: customer.cxNumber,
              Status: selectedStatus,
              ConversationDuration: Math.floor(Math.random() * 45) + 15, // Mock 15-60 seconds call duration
              RecordingUrl: "https://api.exotel.com/v1/Accounts/mock/Recordings/mock_recording.mp3",
            });
            console.log(`[Simulation] Webhook simulation complete. Status set to: ${selectedStatus}`);
          } catch (e) {
            console.error("[Simulation] Webhook simulation failed:", e.message);
          }
        }, 6000);
      }
    } else {
      // --- LIVE MODE ---
      // Connects to the official Exotel REST endpoint
      exotelResponse = await triggerOutboundCall({
        toNumber: dialNumber,
        customerId: customer?._id?.toString(),
      });
    }

    // 4. Update customer call state in MongoDB to 'calling'
    if (customer) {
      customer.callStatus = "calling";
      customer.lastCallAttemptAt = new Date();
      customer.exotelCallSid = exotelResponse?.Call?.Sid || null;
      await customer.save();
    }

    res.json({
      ok: true,
      message: simulate ? "Simulated call triggered" : "Exotel call triggered",
      simulated: simulate,
      exotelResponse,
      customerId: customer?._id || null,
    });
  } catch (error) {
    console.error("Call trigger failed:", error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
      code: error.code || "CALL_TRIGGER_FAILED",
    });
  }
});

module.exports = router;
