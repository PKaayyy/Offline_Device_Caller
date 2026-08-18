const express = require("express");
const Customer = require("../models/Customer");
const { findCustomerById } = require("../services/customerService");
const { triggerOutboundCall, isConfigured } = require("../services/exotelService");

const router = express.Router();

/**
 * POST /calls/trigger
 * Body: { "customerId": "<mongo id>" } OR { "toNumber": "+91..." }
 *
 * Phase 4: starts an Exotel outbound call for one customer.
 */
router.post("/calls/trigger", async (req, res) => {
  try {
    const simulate = process.env.SIMULATE_CALLS !== "false" && (!isConfigured() || process.env.SIMULATE_CALLS === "true");

    if (!simulate && !isConfigured()) {
      return res.status(503).json({
        ok: false,
        code: "EXOTEL_NOT_CONFIGURED",
        message: "Exotel credentials are not set yet. This endpoint is ready for Phase 4.",
      });
    }

    const { customerId, toNumber } = req.body || {};
    let customer = null;

    if (customerId) {
      customer = await findCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({ ok: false, error: "Customer not found" });
      }
    }

    const dialNumber = toNumber || customer?.cxNumber;
    if (!dialNumber) {
      return res.status(400).json({
        ok: false,
        error: "Provide customerId or toNumber",
      });
    }

    let exotelResponse;
    if (simulate) {
      exotelResponse = {
        Call: {
          Sid: `mock_exotel_sid_${Math.random().toString(36).substring(7)}`,
          Status: "in-progress",
        }
      };
      console.log(`[Simulation] Call simulated for ${dialNumber}. Exotel SID: ${exotelResponse.Call.Sid}`);

      // Schedule a background timeout to simulate call completion via status callback
      if (customer) {
        const { handleExotelStatusCallback } = require("../services/callStatusService");
        setTimeout(async () => {
          try {
            console.log(`[Simulation] Simulating webhook callback for customer: ${customer.cxName}`);
            const randomStatuses = ["completed", "completed", "no_answer", "failed"];
            const selectedStatus = randomStatuses[Math.floor(Math.random() * randomStatuses.length)];

            await handleExotelStatusCallback({
              CallSid: exotelResponse.Call.Sid,
              CustomField: customer._id.toString(),
              To: customer.cxNumber,
              Status: selectedStatus,
              ConversationDuration: Math.floor(Math.random() * 45) + 15,
              RecordingUrl: "https://api.exotel.com/v1/Accounts/mock/Recordings/mock_recording.mp3",
            });
            console.log(`[Simulation] Webhook simulation complete. Status set to: ${selectedStatus}`);
          } catch (e) {
            console.error("[Simulation] Webhook simulation failed:", e.message);
          }
        }, 6000);
      }
    } else {
      exotelResponse = await triggerOutboundCall({
        toNumber: dialNumber,
        customerId: customer?._id?.toString(),
      });
    }

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
