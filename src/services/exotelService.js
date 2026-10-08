const axios = require("axios");

/**
 * Validates that all necessary Exotel configuration variables are present in the .env file.
 */
function isConfigured() {
  return Boolean(
    process.env.EXOTEL_API_KEY &&
      process.env.EXOTEL_API_TOKEN &&
      process.env.EXOTEL_ACCOUNT_SID &&
      process.env.EXOTEL_CALLER_ID
  );
}

/**
 * Derives the URL where Exotel should send call events when a call completes.
 * Fallbacks to localhost port 3001 if no custom callback URL is specified in .env.
 */
function getStatusCallbackUrl() {
  if (process.env.EXOTEL_STATUS_CALLBACK_URL) {
    return process.env.EXOTEL_STATUS_CALLBACK_URL;
  }

  const port = process.env.PORT || 3001;
  const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
  return `${appBaseUrl.replace(/\/$/, "")}/webhooks/exotel/status`;
}

/**
 * Initiates an outbound phone call via Exotel's API.
 * Uses HTTP Basic Authentication to verify the API request with Exotel.
 * Registers a StatusCallback URL to receive terminal events (call outcomes).
 * 
 * @param {string} toNumber - The customer's destination phone number to dial
 * @param {string} customerId - The unique database ID of the customer (passed as CustomField)
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
  
  // Exotel's official REST endpoint for placing connection calls
  const url = `https://${subdomain}/v1/Accounts/${accountSid}/Calls/connect.json`;
  const statusCallback = getStatusCallbackUrl();

  // Placing API call via URL-encoded form POST parameters
  const response = await axios.post(
    url,
    new URLSearchParams({
      From: callerId,               // The virtual number that dials out
      To: toNumber,                 // The customer receiving the call
      CallerId: callerId,           // Number shown on the customer's caller ID display
      CustomField: customerId || "",// Custom metadata payload (allows us to associate webhook results back to our customer document)
      StatusCallback: statusCallback, // The webhook endpoint where Exotel will send results
      StatusCallbackEvents: "terminal", // Tells Exotel to send updates ONLY when the call ends (terminal state)
    }).toString(),
    {
      // Basic Authentication header configuration (apiKey is username, apiToken is password)
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
