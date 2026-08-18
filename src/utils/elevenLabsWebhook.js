const crypto = require("crypto");

const TIMESTAMP_TOLERANCE_SEC = 30 * 60;

/**
 * Verify ElevenLabs-Signature header (format: t=timestamp,v0=hex_hmac).
 * Signed payload: `${timestamp}.${rawBody}`
 */
function verifyElevenLabsSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) {
    throw new Error("Missing ElevenLabs-Signature header");
  }

  const elements = signatureHeader.split(",");
  const timestamp = elements.find((e) => e.startsWith("t="))?.slice(2);
  const signatures = elements
    .filter((e) => e.startsWith("v0="))
    .map((e) => e.slice(3));

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid ElevenLabs-Signature header format");
  }

  const timestampAge = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (timestampAge > TIMESTAMP_TOLERANCE_SEC) {
    throw new Error("ElevenLabs webhook timestamp too old");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

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
