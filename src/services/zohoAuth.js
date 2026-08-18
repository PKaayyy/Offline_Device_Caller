const axios = require("axios");

let cachedAccessToken = null;
let tokenExpiresAt = 0;

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
 * OAuth: exchange a long-lived refresh token for a short-lived access token.
 */
async function getAccessToken() {
  assertZohoCredentials();

  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

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

  if (!response.data.access_token) {
    throw new Error(
      `Zoho token refresh failed: ${JSON.stringify(response.data)}`
    );
  }

  cachedAccessToken = response.data.access_token;
  const expiresInSec = Number(response.data.expires_in_sec || 3600);
  tokenExpiresAt = now + expiresInSec * 1000;

  return cachedAccessToken;
}

function zohoHeaders(accessToken) {
  return { Authorization: `Zoho-oauthtoken ${accessToken}` };
}

module.exports = {
  assertZohoCredentials,
  getAccessToken,
  zohoHeaders,
};
