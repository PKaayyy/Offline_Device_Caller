import { API_BASE } from "../api";

export function Header({ health, loading }) {
  const isHealthy = health?.ok;

  return (
    <header className="header">
      <div className="header__brand">
        <div className="header__logo">OD</div>
        <div>
          <h1>Offline Devices Caller</h1>
          <p>Zoho sync · Exotel calls · ElevenLabs agent</p>
        </div>
      </div>
      <div className="header__meta">
        <span className={`health-dot ${isHealthy ? "health-dot--ok" : "health-dot--bad"}`} />
        <span className="health-text">
          {loading ? "Checking API…" : isHealthy ? "API online" : "API unreachable"}
        </span>
        <code className="api-url">{API_BASE}</code>
      </div>
    </header>
  );
}
