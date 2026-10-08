const mongoose = require("mongoose");

/**
 * Customer Schema: Defines how a customer record is stored in MongoDB.
 * One MongoDB document = one Zoho subtask = one customer to call.
 */
const customerSchema = new mongoose.Schema(
  {
    // Unique identifier of the subtask in Zoho Projects. Serves as our primary upsert key.
    zohoSubtaskId: { type: String, required: true, unique: true, index: true },
    
    // Optional prefixes and parent ID trackers for tasks
    zohoTaskPrefix: { type: String, default: "" },
    zohoParentTaskId: { type: String, default: "" },

    // Mapped customer details parsed from the task description
    cxName: { type: String, default: "" },
    cxId: { type: String, default: "" },
    cxNumber: { type: String, default: "", index: true }, // Index added for rapid phone-based webhook lookups
    totalUnits: { type: Number, default: 0 },
    offlineUnits: { type: Number, default: 0 },
    updatedExpiry: { type: String, default: "" },

    // Status tracking state machine variables
    callStatus: {
      type: String,
      enum: ["pending", "calling", "completed", "failed", "no_answer", "skipped"],
      default: "pending",
    },
    
    // Integration tracking keys
    exotelCallSid: { type: String, default: null, index: true }, // Exotel's unique call tracking ID
    elevenLabsConversationId: { type: String, default: null, index: true }, // ElevenLabs conversational session ID
    
    // Telemetry timestamps
    lastCallAttemptAt: { type: Date, default: null },
    callCompletedAt: { type: Date, default: null },
    callDurationSecs: { type: Number, default: null }, // Call duration in seconds
    callRecordingUrl: { type: String, default: null }, // Exotel MP3 recording link
    
    // Diagnostic error trace box (logs API failures)
    lastError: { type: String, default: null },

    // Stores the entire raw JSON object returned by Zoho for manual debugging
    rawZohoData: { type: mongoose.Schema.Types.Mixed, default: null },
    
    // Tracking timestamp for when the record was last pulled from Zoho
    syncedAt: { type: Date, default: Date.now },
  },
  // Automatically creates 'createdAt' and 'updatedAt' timestamp fields in the database document
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
