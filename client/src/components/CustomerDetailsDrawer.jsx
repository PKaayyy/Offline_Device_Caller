import { useState } from "react";
import { StatusBadge } from "./StatusBadge";

// Helper function: Displays dates nicely, returns dashes if null
function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

// Helper function: Formats raw duration seconds into minutes/seconds format
// Example: 135 -> "2m 15s"
function formatDuration(seconds) {
  if (seconds === undefined || seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/**
 * CustomerDetailsDrawer Component: Slides in from the right to inspect a customer.
 * @param {object} customer - The selected customer database document
 * @param {function} onClose - Closes the detail panel drawer
 * @param {function} onCall - Triggers call automation
 * @param {string} callingId - ID of customer currently receiving call
 */
export function CustomerDetailsDrawer({ customer, onClose, onCall, callingId }) {
  // Local state to track whether the raw Zoho JSON panel is expanded
  const [jsonExpanded, setJsonExpanded] = useState(false);

  if (!customer) return null;

  const isCalling = callingId === customer._id;
  const canCall =
    customer.cxNumber &&
    customer.callStatus !== "calling" &&
    customer.callStatus !== "completed";

  return (
    <aside className="detail-drawer" aria-label="Customer Details">
      {/* Drawer Title & Close Button */}
      <div className="drawer__header">
        <div className="drawer__title">
          <h2>{customer.cxName || "Unknown Customer"}</h2>
          <span className="muted mono">{customer.zohoTaskPrefix || customer.zohoSubtaskId}</span>
        </div>
        <button type="button" className="btn-close" onClick={onClose} aria-label="Close details">
          &times;
        </button>
      </div>

      <div className="drawer__body">
        {/* Call Action Quick Panel */}
        <div className="call-action-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>Call Automation</span>
            <StatusBadge status={customer.callStatus} />
          </div>

          <button
            type="button"
            className="btn btn--primary btn--small"
            style={{ width: "100%", marginTop: "8px" }}
            disabled={!canCall || isCalling}
            onClick={() => onCall(customer._id)}
          >
            {isCalling ? "Calling…" : "Trigger Follow-up Call"}
          </button>
        </div>

        {/* Audio Recording Player Box. Only renders if Exotel has sent back a RecordingUrl. */}
        {customer.callRecordingUrl && (
          <div className="audio-player-box">
            <label>
              <span>🔊</span> Call Recording
            </label>
            <audio controls src={customer.callRecordingUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {/* Mapped Customer support variables */}
        <div className="drawer-section">
          <h3>Customer Details</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-item__label">Customer ID</span>
              <span className="info-item__value mono">{customer.cxId || "—"}</span>
            </div>
            <div className="info-item">
              <span className="info-item__label">Contact Number</span>
              <span className="info-item__value mono">{customer.cxNumber || "—"}</span>
            </div>
            <div className="info-item">
              <span className="info-item__label">Offline Units</span>
              <span className="info-item__value">
                <span className="offline-pill" style={{ display: "inline" }}>
                  {customer.offlineUnits}/{customer.totalUnits} Units
                </span>
              </span>
            </div>
            <div className="info-item">
              <span className="info-item__label">Expiry Date</span>
              <span className="info-item__value">{customer.updatedExpiry || "—"}</span>
            </div>
          </div>
        </div>

        {/* Call timing metrics */}
        <div className="drawer-section">
          <h3>Call Diagnostics</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-item__label">Last Attempt</span>
              <span className="info-item__value">{formatDate(customer.lastCallAttemptAt)}</span>
            </div>
            <div className="info-item">
              <span className="info-item__label">Call Completed</span>
              <span className="info-item__value">{formatDate(customer.callCompletedAt)}</span>
            </div>
            <div className="info-item">
              <span className="info-item__label">Duration</span>
              <span className="info-item__value">{formatDuration(customer.callDurationSecs)}</span>
            </div>
            <div className="info-item">
              <span className="info-item__label">Synced At</span>
              <span className="info-item__value">{formatDate(customer.syncedAt)}</span>
            </div>
          </div>
        </div>

        {/* API Integration identification codes */}
        <div className="drawer-section">
          <h3>Integration SIDs</h3>
          <div className="info-grid">
            <div className="info-item" style={{ gridColumn: "span 2" }}>
              <span className="info-item__label">Exotel Call SID</span>
              <span className="info-item__value mono" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                {customer.exotelCallSid || "—"}
              </span>
            </div>
            <div className="info-item" style={{ gridColumn: "span 2" }}>
              <span className="info-item__label">ElevenLabs Conv. ID</span>
              <span className="info-item__value mono" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                {customer.elevenLabsConversationId || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Red warning diagnostic block for tracking webhook failure reasons */}
        {customer.lastError && (
          <div className="drawer-section">
            <h3>Diagnostic Error</h3>
            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                padding: "12px",
                borderRadius: "12px",
                fontSize: "0.8rem",
                color: "#fca5a5",
                fontFamily: "monospace",
                wordBreak: "break-word",
              }}
            >
              {customer.lastError}
            </div>
          </div>
        )}

        {/* Collapsible Accordion containing raw Zoho database payload */}
        <div className="accordion">
          <div
            className="accordion__summary"
            onClick={() => setJsonExpanded(!jsonExpanded)}
          >
            <span>Raw Zoho Task Payload</span>
            <span>{jsonExpanded ? "▲" : "▼"}</span>
          </div>
          {jsonExpanded && (
            <div className="accordion__content">
              {/* Renders raw formatted JSON code in green monospace typography */}
              <pre className="raw-json">
                {JSON.stringify(customer.rawZohoData || { message: "No data available" }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
