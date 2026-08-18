const express = require("express");
const { findCustomerByPhone } = require("../services/customerService");
const {
  handleExotelStatusCallback,
  handleElevenLabsLifecycleEvent,
  handleElevenLabsInit,
} = require("../services/callStatusService");
const { verifyElevenLabsSignature } = require("../utils/elevenLabsWebhook");

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

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

function parseElevenLabsEvent(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON body for ElevenLabs webhook");
  }
}

function verifyElevenLabsWebhookIfConfigured(rawBody, signatureHeader) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return;

  verifyElevenLabsSignature(rawBody, signatureHeader, secret);
}

/**
 * POST /webhooks/exotel/status
 * Exotel StatusCallback when a call reaches a terminal state.
 */
router.post("/webhooks/exotel/status", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("Exotel status webhook:", JSON.stringify(payload));

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
 * ElevenLabs conversation initiation — return dynamic variables for the agent.
 */
router.post("/webhooks/elevenlabs/init", async (req, res) => {
  try {
    console.log("ElevenLabs init webhook received:", JSON.stringify(req.body, null, 2));

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

    await handleElevenLabsInit(customer, req.body);

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
 * ElevenLabs post-call transcription / initiation-failure events.
 * Configure this URL in ElevenLabs agent post-call webhook settings.
 */
router.post(
  "/webhooks/elevenlabs/post-call",
  express.text({ type: "application/json" }),
  async (req, res) => {
    try {
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const signature = req.headers["elevenlabs-signature"];

      verifyElevenLabsWebhookIfConfigured(rawBody, signature);

      const event = parseElevenLabsEvent(rawBody);
      console.log("ElevenLabs post-call webhook:", event.type);

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
