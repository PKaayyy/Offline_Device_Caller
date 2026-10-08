const axios = require("axios");

// In-memory cache variables for the access token to avoid unnecessary network calls
let cachedAccessToken = null;
let tokenExpiresAt = 0; // Timestamp of when the current token becomes invalid

/**
 * Validates that all necessary Zoho Project credentials are configured in the .env file.
 * Throws a ZOHO_NOT_CONFIGURED error if any key is missing.
 */
function assertZohoCredentials() {
  const missing = [];

  if (!process.env.ZOHO_CLIENT_ID) missing.push("ZOHO_CLIENT_ID");
  if (!process.env.ZOHO_CLIENT_SECRET) missing.push("ZOHO_CLIENT_SECRET");
  if (!process.env.ZOHO_REFRESH_TOKEN) missing.push("ZOHO_REFRESH_TOKEN");
  if (!process.env.ZOHO_PORTAL_ID) missing.push("ZOHO_PORTAL_ID");

  if (missing.length > 0) {
    const error = new Error(
      `Zoho is not configured. Add these to your .env file: ${missing.join(", ")}`
    );
    error.code = "ZOHO_NOT_CONFIGURED";
    throw error;
  }
}

/**
 * Retrieves a valid Zoho Project access token.
 * Exchanges a long-lived refresh token for a short-lived access token,
 * caching the token in memory until it expires (typically 1 hour).
 */
async function getAccessToken() {
  // 1. Confirm credentials exist
  assertZohoCredentials();

  // 2. If we have a cached token and it has more than 1 minute remaining, reuse it
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  // 3. Otherwise, contact Zoho Accounts OAuth to refresh the token
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in";
  const tokenUrl = `${accountsUrl}/oauth/v2/token`;

  const response = await axios.post(
    tokenUrl,
    new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token",
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  // 4. Validate that Zoho returned an access token
  if (!response.data.access_token) {
    throw new Error(
      `Zoho token refresh failed: ${JSON.stringify(response.data)}`
    );
  }

  // 5. Update cached token value and calculate expiry time (e.g. now + 3600 seconds)
  cachedAccessToken = response.data.access_token;
  const expiresInSec = Number(response.data.expires_in_sec || 3600);
  tokenExpiresAt = now + expiresInSec * 1000;

  return cachedAccessToken;
}

/**
 * Formats the access token into the standard HTTP Authorization header required by Zoho.
 * @param {string} accessToken - Raw OAuth access token
 */
function zohoHeaders(accessToken) {
  return { Authorization: `Zoho-oauthtoken ${accessToken}` };
}

module.exports = {
  assertZohoCredentials,
  getAccessToken,
  zohoHeaders,
};
