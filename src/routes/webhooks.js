const express = require("express");
const { findCustomerByPhone } = require("../services/customerService");
const {
  handleExotelStatusCallback,
  handleElevenLabsLifecycleEvent,
  handleElevenLabsInit,
} = require("../services/callStatusService");
const { verifyElevenLabsSignature } = require("../utils/elevenLabsWebhook");

const router = express.Router();

// Enable URL-encoded parameter parsing (required to process form payloads sent by Exotel)
router.use(express.urlencoded({ extended: true }));

/**
 * Utility: Scans a webhook request envelope to find a valid phone number candidate.
 * Different APIs name phone fields differently, so this helper standardizes lookup keys.
 */
function extractPhoneFromWebhook(body) {
  return (
    body?.to_number ||
    body?.called_number ||
    body?.phone_number ||
    body?.caller_id ||
    body?.from_number ||
    body?.custom_parameters?.phone_number ||
    null
  );
}

/**
 * Formats database customer fields into key-value context variables for ElevenLabs.
 * ElevenLabs conversational AI agents inject these parameters dynamically into their
 * system instructions (e.g. "Hello {cx_name}, you have {offline_units} units offline...").
 */
function buildDynamicVariables(customer) {
  return {
    cx_name: customer.cxName,
    cx_id: customer.cxId,
    cx_number: customer.cxNumber,
    total_units: String(customer.totalUnits),
    offline_units: String(customer.offlineUnits),
    updated_expiry: customer.updatedExpiry,
    zoho_task_prefix: customer.zohoTaskPrefix,
  };
}

/**
 * Parses raw request body streams as JSON.
 */
function parseElevenLabsEvent(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON body for ElevenLabs webhook");
  }
}

/**
 * Validates HMAC SHA-256 signatures if an ELEVENLABS_WEBHOOK_SECRET is defined in .env.
 */
function verifyElevenLabsWebhookIfConfigured(rawBody, signatureHeader) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return; // Skip validation if secret is not set (e.g. during development testing)

  verifyElevenLabsSignature(rawBody, signatureHeader, secret);
}

/**
 * POST /webhooks/exotel/status
 * Triggered by Exotel when a call enters a terminal state (Completed, No Answer, Failed).
 */
router.post("/webhooks/exotel/status", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("Exotel status webhook:", JSON.stringify(payload));

    // Update database call logs and duration parameters
    const result = await handleExotelStatusCallback(payload);
    if (!result.ok) {
      console.warn("Exotel status webhook: customer not matched", result);
    }

    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("Exotel status webhook failed:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /webhooks/elevenlabs/init
 * Triggered by ElevenLabs during conversation initiation.
 * ElevenLabs requests customer context details. We find the customer by phone 
 * and return dynamic variables containing their device support counts.
 */
router.post("/webhooks/elevenlabs/init", async (req, res) => {
  try {
    console.log("ElevenLabs init webhook received:", JSON.stringify(req.body, null, 2));

    // Resolve the caller phone number
    const phone = extractPhoneFromWebhook(req.body);
    const customer = phone ? await findCustomerByPhone(phone) : null;

    if (!customer) {
      return res.status(404).json({
        ok: false,
        error: "Customer not found for this call",
        hint: "Sync from Zoho first and ensure cx_number matches the dialed number",
        receivedPhone: phone,
      });
    }

    // Connect the call state to this active conversation ID
    await handleElevenLabsInit(customer, req.body);

    // Build the dynamic parameters response payload required by ElevenLabs
    const payload = {
      type: "conversation_initiation_client_data",
      dynamic_variables: buildDynamicVariables(customer),
    };

    res.json(payload);
  } catch (error) {
    console.error("ElevenLabs init webhook failed:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /webhooks/elevenlabs/post-call
 * Triggered by ElevenLabs when a call terminates.
 * Delivers transcription results, duration parameters, and failure diagnostics.
 */
router.post(
  "/webhooks/elevenlabs/post-call",
  // Capture raw text string to enable valid cryptographic signature validations
  express.text({ type: "application/json" }),
  async (req, res) => {
    try {
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const signature = req.headers["elevenlabs-signature"];

      // Verify request signature to secure endpoint
      verifyElevenLabsWebhookIfConfigured(rawBody, signature);

      const event = parseElevenLabsEvent(rawBody);
      console.log("ElevenLabs post-call webhook:", event.type);

      // Process event (updates transcripts / completes call status)
      const result = await handleElevenLabsLifecycleEvent(event);
      if (!result.ok) {
        console.warn("ElevenLabs post-call webhook: customer not matched", result);
      }

      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      const status = error.message.includes("signature") ? 401 : 500;
      console.error("ElevenLabs post-call webhook failed:", error.message);
      res.status(status).json({ ok: false, error: error.message });
    }
  }
);

module.exports = router;
