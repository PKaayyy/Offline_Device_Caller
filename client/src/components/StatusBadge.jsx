const STATUS_LABELS = {
  pending: "Pending",
  calling: "Calling",
  completed: "Completed",
  failed: "Failed",
  no_answer: "No answer",
  skipped: "Skipped",
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge--${status || "pending"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
