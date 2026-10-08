// Define a lookup table to translate raw database status codes
// into clean, user-friendly labels.
const STATUS_LABELS = {
  pending: "Pending",
  calling: "Calling",
  completed: "Completed",
  failed: "Failed",
  no_answer: "No answer",
  skipped: "Skipped",
};

/**
 * StatusBadge Component: Displays a styled colored pill representing call status.
 * @param {string} status - Raw status string (e.g. "no_answer")
 */
export function StatusBadge({ status }) {
  return (
    // Maps the class selector (.badge--status) dynamically to match styling rules in index.css
    <span className={`badge badge--${status || "pending"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
