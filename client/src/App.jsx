import { useCallback, useEffect, useState } from "react";
import { getCustomers, getHealth, syncFromZoho, triggerCall } from "./api";
import { Header } from "./components/Header";
import { SummaryCards } from "./components/SummaryCards";
import { CustomerTable } from "./components/CustomerTable";

export default function App() {
  const [health, setHealth] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [callingId, setCallingId] = useState(null);
  const [message, setMessage] = useState(null);

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    window.clearTimeout(showMessage._timer);
    showMessage._timer = window.setTimeout(() => setMessage(null), 5000);
  };

  const loadData = useCallback(async (silent = false) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    try {
      const [healthRes, customersRes] = await Promise.all([
        getHealth(),
        getCustomers(),
      ]);
      setHealth(healthRes);
      setCustomers(customersRes.customers || []);
    } catch (error) {
      setHealth({ ok: false });
      showMessage(error.message, "error");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling effect: auto-refresh data when a call is active
  useEffect(() => {
    const hasCallingCustomer = customers.some(
      (customer) => customer.callStatus === "calling"
    );
    if (hasCallingCustomer) {
      const interval = setInterval(() => {
        loadData(true); // silent refresh
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [customers, loadData]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncFromZoho();
      showMessage(
        `Synced ${result.totalSaved} customers from Zoho (${result.project?.name || "project"})`,
        "success"
      );
      await loadData();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCall(customerId) {
    setCallingId(customerId);
    try {
      await triggerCall(customerId);
      showMessage("Call triggered via Exotel", "success");
      await loadData();
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

  return (
    <div className="app">
      <Header health={health} loading={loading} />

      {message && (
        <div className={`alert alert--${message.type}`} role="status">
          {message.text}
        </div>
      )}

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

      {loading ? (
        <div className="loading-state">Loading dashboard…</div>
      ) : (
        <>
          <SummaryCards customers={customers} />
          <CustomerTable
            customers={customers}
            filter={filter}
            search={search}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            onCall={handleCall}
            callingId={callingId}
          />
        </>
      )}
    </div>
  );
}
