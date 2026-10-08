const crypto = require("crypto");

// Maximum tolerance window (30 minutes) to prevent replay attacks (old requests re-sent by bad actors)
const TIMESTAMP_TOLERANCE_SEC = 30 * 60;

/**
 * Validates HMAC SHA-256 signatures attached to ElevenLabs webhook requests.
 * Ensures the payload has not been tampered with and was sent by ElevenLabs.
 * 
 * Signature Header format: t=timestamp,v0=hex_hmac
 * Signed string format: `${timestamp}.${rawBody}`
 * 
 * @param {string} rawBody - Raw unparsed text body of request
 * @param {string} signatureHeader - The 'ElevenLabs-Signature' HTTP header value
 * @param {string} secret - The ELEVENLABS_WEBHOOK_SECRET loaded from .env
 */
function verifyElevenLabsSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) {
    throw new Error("Missing ElevenLabs-Signature header");
  }

  // 1. Parse header segments (splits keys by comma)
  const elements = signatureHeader.split(",");
  const timestamp = elements.find((e) => e.startsWith("t="))?.slice(2); // Extracts timestamp digits
  const signatures = elements
    .filter((e) => e.startsWith("v0="))
    .map((e) => e.slice(3)); // Extracts HMAC signature hex codes

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid ElevenLabs-Signature header format");
  }

  // 2. Reject request if timestamp age exceeds our tolerance limit (prevents replay attacks)
  const timestampAge = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (timestampAge > TIMESTAMP_TOLERANCE_SEC) {
    throw new Error("ElevenLabs webhook timestamp too old");
  }

  // 3. Compute the expected cryptographic signature
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // 4. Safely verify calculated signature matches header signatures using a timing-safe compare utility
  // (Prevents hackers from guessing signatures letter-by-letter based on CPU processing response times)
  const isValid = signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });

  if (!isValid) {
    throw new Error("Invalid ElevenLabs webhook signature");
  }

  return true;
}

module.exports = { verifyElevenLabsSignature };
