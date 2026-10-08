// Import React core hooks:
// - useState: lets us store state variables (data that changes and triggers screen updates)
// - useEffect: runs background logic/automation when components load or dependencies update
// - useCallback: remembers functions between screen renders so we don't recreate them needlessly
import { useCallback, useEffect, useState } from "react";
// Import our API calls wrapper from api.js
import { getCustomers, getHealth, syncFromZoho, triggerCall } from "./api";
// Import our layout and widget React components
import { Header } from "./components/Header";
import { SummaryCards } from "./components/SummaryCards";
import { CustomerTable } from "./components/CustomerTable";
import { CustomerDetailsDrawer } from "./components/CustomerDetailsDrawer";

export default function App() {
  // --- STATE VARIABLES ---
  // Stores the backend health check status (e.g. { ok: true, timestamp: "..." })
  const [health, setHealth] = useState(null);
  // Stores the list of customer objects fetched from MongoDB
  const [customers, setCustomers] = useState([]);
  // Stores the currently active status filter (defaults to "all")
  const [filter, setFilter] = useState("all");
  // Stores what the user has typed into the search bar
  const [search, setSearch] = useState("");
  // Tracks whether we are currently loading the initial customer data list
  const [loading, setLoading] = useState(true);
  // Tracks whether the system is actively syncing data from Zoho in the background
  const [syncing, setSyncing] = useState(false);
  // Holds the customer ID that is currently receiving an active phone call
  const [callingId, setCallingId] = useState(null);
  // Holds notification alerts (e.g., { text: "Call triggered", type: "success" })
  const [message, setMessage] = useState(null);
  // Stores the customer object that the user has selected for inspection in the drawer
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  /**
   * Helper function to show a flash message/alert banner at the top of the dashboard.
   * Auto-erases the banner after 5 seconds using a timeout.
   */
  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    window.clearTimeout(showMessage._timer);
    showMessage._timer = window.setTimeout(() => setMessage(null), 5000);
  };

  /**
   * Loads both API health and customer database arrays concurrently.
   * @param {boolean} silent - If true, fetches updates without turning on the full screen loader
   */
  const loadData = useCallback(async (silent = false) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    try {
      // Execute both server calls in parallel to speed up load time
      const [healthRes, customersRes] = await Promise.all([
        getHealth(),
        getCustomers(),
      ]);
      setHealth(healthRes);
      setCustomers(customersRes.customers || []);
    } catch (error) {
      setHealth({ ok: false }); // Mark backend as offline if fetch throws
      showMessage(error.message, "error");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  /**
   * AUTOMATION: Initial load.
   * Triggers the loadData function once when the website is first loaded in the browser.
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * AUTOMATION: Live call polling scheduler.
   * If any customer has a status of "calling", we query the backend list every 3 seconds.
   * This updates the row status and recordings instantly when webhooks write to the database.
   */
  useEffect(() => {
    const hasCallingCustomer = customers.some(
      (customer) => customer.callStatus === "calling"
    );
    if (hasCallingCustomer) {
      const interval = setInterval(() => {
        loadData(true); // Refreshes data silently without screen flashing
      }, 3000);
      return () => clearInterval(interval); // Clean up the interval when no calls are active
    }
  }, [customers, loadData]);

  /**
   * Action handler: Manually trigger a Zoho sync pull request.
   */
  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncFromZoho();
      showMessage(
        `Synced ${result.totalSaved} customers from Zoho (${result.project?.name || "project"})`,
        "success"
      );
      await loadData(); // Reload table after syncing
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSyncing(false);
    }
  }

  /**
   * Action handler: Trigger an outbound phone call through Exotel/ElevenLabs.
   */
  async function handleCall(customerId) {
    setCallingId(customerId);
    try {
      await triggerCall(customerId);
      showMessage("Call triggered via Exotel", "success");
      await loadData(); // Reload to show new status instantly
    } catch (error) {
      if (error.code === "EXOTEL_NOT_CONFIGURED") {
        showMessage("Exotel is not configured — add EXOTEL_* vars to .env", "error");
      } else {
        showMessage(error.message, "error");
      }
    } finally {
      setCallingId(null);
    }
  }

  /**
   * CRITICAL UI SYNC:
   * Finds the updated database record of our selected customer inside our customer list.
   * This ensures the details drawer values (recording audio, status, duration) stay updated 
   * in real-time as background polling fetches status updates.
   */
  const activeCustomer = selectedCustomer
    ? customers.find((c) => c._id === selectedCustomer._id) || selectedCustomer
    : null;

  return (
    <div className="app">
      {/* Top navigation branding and API health status banner */}
      <Header health={health} loading={loading} />

      {/* Alert banner display area */}
      {message && (
        <div className={`alert alert--${message.type}`} role="status">
          {message.text}
        </div>
      )}

      {/* Sync and Refresh Action Buttons */}
      <section className="actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleSync}
          disabled={syncing || loading}
        >
          {syncing ? "Syncing from Zoho…" : "Sync from Zoho"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => loadData(false)}
          disabled={loading}
        >
          Refresh
        </button>
      </section>

      {/* Dashboard workspace grid */}
      {loading ? (
        <div className="loading-state">Loading dashboard…</div>
      ) : (
        // Split view container: Left side contains widgets + customer table, Right side contains detail drawer
        <div className="layout-container">
          <div className="main-content">
            {/* Top statistic aggregate count widgets */}
            <SummaryCards customers={customers} />
            
            {/* Core spreadsheet search and list grid */}
            <CustomerTable
              customers={customers}
              filter={filter}
              search={search}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onCall={handleCall}
              callingId={callingId}
              selectedCustomerId={activeCustomer?._id}
              onSelectCustomer={setSelectedCustomer}
            />
          </div>
          
          {/* If a customer is selected, open the sliding side detail/diagnostics inspector drawer */}
          {activeCustomer && (
            <CustomerDetailsDrawer
              customer={activeCustomer}
              onClose={() => setSelectedCustomer(null)}
              onCall={handleCall}
              callingId={callingId}
            />
          )}
        </div>
      )}
    </div>
  );
}
