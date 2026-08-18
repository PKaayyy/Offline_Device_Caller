const mongoose = require("mongoose");

/**
 * One MongoDB document = one Zoho subtask = one customer to call.
 */
const customerSchema = new mongoose.Schema(
  {
    zohoSubtaskId: { type: String, required: true, unique: true, index: true },
    zohoTaskPrefix: { type: String, default: "" },
    zohoParentTaskId: { type: String, default: "" },

    cxName: { type: String, default: "" },
    cxId: { type: String, default: "" },
    cxNumber: { type: String, default: "", index: true },
    totalUnits: { type: Number, default: 0 },
    offlineUnits: { type: Number, default: 0 },
    updatedExpiry: { type: String, default: "" },

    callStatus: {
      type: String,
      enum: ["pending", "calling", "completed", "failed", "no_answer", "skipped"],
      default: "pending",
    },
    exotelCallSid: { type: String, default: null, index: true },
    elevenLabsConversationId: { type: String, default: null, index: true },
    lastCallAttemptAt: { type: Date, default: null },
    callCompletedAt: { type: Date, default: null },
    callDurationSecs: { type: Number, default: null },
    callRecordingUrl: { type: String, default: null },
    lastError: { type: String, default: null },

    rawZohoData: { type: mongoose.Schema.Types.Mixed, default: null },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
