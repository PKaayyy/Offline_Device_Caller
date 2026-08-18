import { StatusBadge } from "./StatusBadge";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function CustomerTable({
  customers,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onCall,
  callingId,
}) {
  const filters = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "calling", label: "Calling" },
    { id: "completed", label: "Completed" },
    { id: "failed", label: "Failed" },
    { id: "no_answer", label: "No answer" },
  ];

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = customers.filter((customer) => {
    const matchesFilter = filter === "all" || customer.callStatus === filter;
    const haystack = [
      customer.cxName,
      customer.cxNumber,
      customer.cxId,
      customer.zohoTaskPrefix,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
    return matchesFilter && matchesSearch;
  });

  return (
    <section className="panel">
      <div className="panel__toolbar">
        <div className="filters">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`filter-btn ${filter === item.id ? "filter-btn--active" : ""}`}
              onClick={() => onFilterChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          type="search"
          placeholder="Search name, phone, ID…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Devices</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>Last attempt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-row">
                  No customers match your filters. Try syncing from Zoho.
                </td>
              </tr>
            ) : (
              filtered.map((customer) => {
                const isCalling = callingId === customer._id;
                const canCall =
                  customer.cxNumber &&
                  customer.callStatus !== "calling" &&
                  customer.callStatus !== "completed";

                return (
                  <tr key={customer._id}>
                    <td>
                      <div className="customer-cell">
                        <strong>{customer.cxName || "Unknown"}</strong>
                        <span className="muted mono">
                          {customer.zohoTaskPrefix || customer.zohoSubtaskId}
                        </span>
                      </div>
                    </td>
                    <td className="mono">{customer.cxNumber || "—"}</td>
                    <td>
                      <span className="offline-pill">
                        {customer.offlineUnits}/{customer.totalUnits} offline
                      </span>
                    </td>
                    <td>{customer.updatedExpiry || "—"}</td>
                    <td><StatusBadge status={customer.callStatus} /></td>
                    <td className="muted">{formatDate(customer.lastCallAttemptAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--small"
                        disabled={!canCall || isCalling}
                        onClick={() => onCall(customer._id)}
                      >
                        {isCalling ? "Calling…" : "Call"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <footer className="panel__footer">
        Showing {filtered.length} of {customers.length} customers
      </footer>
    </section>
  );
}
