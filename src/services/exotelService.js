const axios = require("axios");

function isConfigured() {
  return Boolean(
    process.env.EXOTEL_API_KEY &&
      process.env.EXOTEL_API_TOKEN &&
      process.env.EXOTEL_ACCOUNT_SID &&
      process.env.EXOTEL_CALLER_ID
  );
}

function getStatusCallbackUrl() {
  if (process.env.EXOTEL_STATUS_CALLBACK_URL) {
    return process.env.EXOTEL_STATUS_CALLBACK_URL;
  }

  const port = process.env.PORT || 3001;
  const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
  return `${appBaseUrl.replace(/\/$/, "")}/webhooks/exotel/status`;
}

/**
 * Trigger an Exotel outbound call and register a StatusCallback for lifecycle updates.
 */
async function triggerOutboundCall({ toNumber, customerId }) {
  if (!isConfigured()) {
    const error = new Error(
      "Exotel is not configured yet. Add EXOTEL_* values to .env (Phase 4)."
    );
    error.code = "EXOTEL_NOT_CONFIGURED";
    throw error;
  }

  const subdomain = process.env.EXOTEL_SUBDOMAIN || "api.exotel.com";
  const accountSid = process.env.EXOTEL_ACCOUNT_SID;
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  const callerId = process.env.EXOTEL_CALLER_ID;
  const url = `https://${subdomain}/v1/Accounts/${accountSid}/Calls/connect.json`;
  const statusCallback = getStatusCallbackUrl();

  const response = await axios.post(
    url,
    new URLSearchParams({
      From: callerId,
      To: toNumber,
      CallerId: callerId,
      CustomField: customerId || "",
      StatusCallback: statusCallback,
      StatusCallbackEvents: "terminal",
    }).toString(),
    {
      auth: { username: apiKey, password: apiToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  return response.data;
}

module.exports = {
  isConfigured,
  getStatusCallbackUrl,
  triggerOutboundCall,
};
