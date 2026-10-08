import { StatusBadge } from "./StatusBadge";

// Helper function to convert raw system ISO dates (e.g. 2026-08-25T06:23:10.000Z)
// into localized date strings (e.g. 8/25/2026, 11:53:10 AM)
function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/**
 * CustomerTable Component: Displays the spreadsheet interface of customer records.
 * @param {Array} customers - Customer array from database
 * @param {string} filter - Active status category filter
 * @param {string} search - Search box query text string
 * @param {function} onFilterChange - Triggers when changing category tabs
 * @param {function} onSearchChange - Triggers when typing in search box
 * @param {function} onCall - Triggers Exotel phone calls
 * @param {string} callingId - ID of customer currently receiving call
 * @param {string} selectedCustomerId - ID of customer currently highlighted
 * @param {function} onSelectCustomer - Triggers details drawer selections
 */
export function CustomerTable({
  customers,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onCall,
  callingId,
  selectedCustomerId,
  onSelectCustomer,
}) {
  // Categories for the filter tabs
  const filters = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "calling", label: "Calling" },
    { id: "completed", label: "Completed" },
    { id: "failed", label: "Failed" },
    { id: "no_answer", label: "No answer" },
  ];

  // 1. Convert query text to lowercase to perform a case-insensitive search
  const normalizedSearch = search.trim().toLowerCase();
  
  // 2. Filter the database array before drawing rows
  const filtered = customers.filter((customer) => {
    // Check if the customer matches the status selected on the tabs
    const matchesFilter = filter === "all" || customer.callStatus === filter;
    
    // Combine support parameters into a single searchable search text
    const haystack = [
      customer.cxName,
      customer.cxNumber,
      customer.cxId,
      customer.zohoTaskPrefix,
    ]
      .join(" ")
      .toLowerCase();
      
    // Check if the search term matches any characters in our parameters
    const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
    
    return matchesFilter && matchesSearch;
  });

  return (
    <section className="panel">
      {/* Search Bar & Category Filters Toolbar */}
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

      {/* Spreadsheet List Wrap */}
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
              // Empty rows state
              <tr>
                <td colSpan={7} className="empty-row">
                  No customers match your filters. Try syncing from Zoho.
                </td>
              </tr>
            ) : (
              // Render filtered rows
              filtered.map((customer) => {
                const isCalling = callingId === customer._id;
                const isSelected = selectedCustomerId === customer._id;
                
                // Allow triggering calls if the number is valid and the customer
                // is not currently in call or successfully resolved already
                const canCall =
                  customer.cxNumber &&
                  customer.callStatus !== "calling" &&
                  customer.callStatus !== "completed";

                return (
                  <tr
                    key={customer._id}
                    // Highlight the row if selected, handled in CSS via row--selected
                    className={isSelected ? "row--selected" : ""}
                    onClick={() => onSelectCustomer(customer)}
                  >
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
                        onClick={(e) => {
                          // Prevent row selection click when user selects the action button
                          e.stopPropagation();
                          onCall(customer._id);
                        }}
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
