const Customer = require("../models/Customer");
const { findCustomerById, findCustomerByPhone, normalizePhone } = require("./customerService");

const TERMINAL_STATUSES = new Set(["completed", "failed", "no_answer", "skipped"]);

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function canApplyStatus(currentStatus, nextStatus) {
  if (!nextStatus) return false;
  if (currentStatus === nextStatus) return true;
  if (TERMINAL_STATUSES.has(currentStatus) && nextStatus === "calling") return false;
  return true;
}

function mapExotelStatus(status) {
  const normalized = normalizeKey(status);

  if (normalized === "completed") return "completed";
  if (normalized === "no-answer" || normalized.includes("unanswered")) return "no_answer";
  if (normalized === "busy") return "no_answer";
  if (
    normalized === "failed" ||
    normalized.includes("cancelled") ||
    normalized.includes("no_dial")
  ) {
    return "failed";
  }

  return null;
}

function mapElevenLabsFailureReason(reason) {
  const normalized = normalizeKey(reason);
  if (normalized === "busy" || normalized === "no-answer") return "no_answer";
  if (normalized === "unknown") return "failed";
  return "failed";
}

async function findCustomerForWebhook({ customerId, callSid, phone }) {
  if (customerId) {
    const byId = await findCustomerById(customerId);
    if (byId) return byId;
  }

  if (callSid) {
    const bySid = await Customer.findOne({ exotelCallSid: callSid });
    if (bySid) return bySid;
  }

  if (phone) {
    return findCustomerByPhone(phone);
  }

  return null;
}

function extractPhoneFromElevenLabsData(data = {}) {
  const dynamicPhone = data.conversation_initiation_client_data?.dynamic_variables?.cx_number;
  if (dynamicPhone) return normalizePhone(dynamicPhone);

  const metadata = data.metadata || {};
  const candidates = [
    metadata.to_number,
    metadata.phone_number,
    metadata.external_number,
    metadata.body?.to_number,
    metadata.body?.To,
    metadata.body?.Called,
  ];

  for (const candidate of candidates) {
    if (candidate) return normalizePhone(candidate);
  }

  return null;
}

async function applyCustomerCallUpdate(customer, updates) {
  const nextStatus = updates.callStatus;
  if (nextStatus && !canApplyStatus(customer.callStatus, nextStatus)) {
    return { customer, skipped: true, reason: "status_already_terminal" };
  }

  Object.assign(customer, updates);
  await customer.save();

  return { customer, skipped: false };
}

/**
 * Exotel StatusCallback payload (form-encoded or JSON).
 */
async function handleExotelStatusCallback(payload = {}) {
  const callSid = payload.CallSid || payload.call_sid || null;
  const customField = payload.CustomField || payload.custom_field || null;
  const phone = normalizePhone(payload.To || payload.to || payload.Called);
  const mappedStatus = mapExotelStatus(payload.Status || payload.status);

  const customer = await findCustomerForWebhook({
    customerId: customField,
    callSid,
    phone,
  });

  if (!customer) {
    return {
      ok: false,
      error: "Customer not found for Exotel callback",
      callSid,
      phone,
      customField,
    };
  }

  const updates = {
    exotelCallSid: callSid || customer.exotelCallSid,
    lastCallAttemptAt: customer.lastCallAttemptAt || new Date(),
  };

  if (mappedStatus) {
    updates.callStatus = mappedStatus;
    if (mappedStatus === "completed" || mappedStatus === "failed" || mappedStatus === "no_answer") {
      updates.callCompletedAt = new Date();
    }
  }

  const recordingUrl = payload.RecordingUrl || payload.recording_url;
  if (recordingUrl) {
    updates.callRecordingUrl = recordingUrl;
  }

  const duration = Number(payload.ConversationDuration || payload.CallDuration || 0);
  if (Number.isFinite(duration) && duration > 0) {
    updates.callDurationSecs = duration;
  }

  if (mappedStatus === "failed") {
    updates.lastError = `Exotel status: ${payload.Status || payload.status}`;
  } else if (mappedStatus === "completed") {
    updates.lastError = null;
  }

  const result = await applyCustomerCallUpdate(customer, updates);

  return {
    ok: true,
    customerId: result.customer._id,
    callStatus: result.customer.callStatus,
    skipped: result.skipped,
    reason: result.reason,
  };
}

/**
 * ElevenLabs post-call / failure webhook event (parsed JSON).
 */
async function handleElevenLabsLifecycleEvent(event = {}) {
  const type = event.type;
  const data = event.data || {};

  if (type === "post_call_audio") {
    return { ok: true, ignored: true, reason: "post_call_audio_not_stored" };
  }

  const conversationId = data.conversation_id || null;
  const phone = extractPhoneFromElevenLabsData(data);

  let customer = null;
  if (conversationId) {
    customer = await Customer.findOne({ elevenLabsConversationId: conversationId });
  }
  if (!customer) {
    customer = await findCustomerForWebhook({ phone });
  }

  if (!customer) {
    return {
      ok: false,
      error: "Customer not found for ElevenLabs webhook",
      type,
      conversationId,
      phone,
    };
  }

  const updates = {
    elevenLabsConversationId: conversationId || customer.elevenLabsConversationId,
  };

  if (type === "post_call_transcription") {
    updates.callStatus = "completed";
    updates.callCompletedAt = new Date();
    updates.lastError = null;

    const duration = Number(data.metadata?.call_duration_secs || 0);
    if (Number.isFinite(duration) && duration > 0) {
      updates.callDurationSecs = duration;
    }
  } else if (type === "call_initiation_failure") {
    updates.callStatus = mapElevenLabsFailureReason(data.failure_reason);
    updates.callCompletedAt = new Date();
    updates.lastError = `ElevenLabs initiation failure: ${data.failure_reason || "unknown"}`;
  } else {
    return { ok: true, ignored: true, reason: `unhandled_event_type:${type}` };
  }

  const result = await applyCustomerCallUpdate(customer, updates);

  return {
    ok: true,
    customerId: result.customer._id,
    callStatus: result.customer.callStatus,
    type,
    skipped: result.skipped,
    reason: result.reason,
  };
}

/**
 * Store conversation id when ElevenLabs conversation starts.
 */
async function handleElevenLabsInit(customer, body = {}) {
  const conversationId =
    body.conversation_id ||
    body.conversationId ||
    body.data?.conversation_id ||
    null;

  if (!conversationId) {
    return { customer, conversationId: null };
  }

  const updates = {
    elevenLabsConversationId: conversationId,
    callStatus: "calling",
    lastCallAttemptAt: new Date(),
  };

  const result = await applyCustomerCallUpdate(customer, updates);
  return { customer: result.customer, conversationId };
}

module.exports = {
  handleExotelStatusCallback,
  handleElevenLabsLifecycleEvent,
  handleElevenLabsInit,
};
