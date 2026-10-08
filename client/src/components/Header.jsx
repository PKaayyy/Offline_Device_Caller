// Import our API endpoint URL to display in the header meta diagnostics area
import { API_BASE } from "../api";

/**
 * Header Component: Renders the premium top branding bar and live API status monitor.
 * @param {object} health - Status response object from GET /health
 * @param {boolean} loading - Connection check loader state flag
 */
export function Header({ health, loading }) {
  // If health has "ok: true", it means our MongoDB and Node server are fully connected
  const isHealthy = health?.ok;

  return (
    <header className="header">
      {/* Branding Logo & Project Subtitles */}
      <div className="header__brand">
        {/* Neon Gradient Square Logo (styled in CSS via linear-gradient) */}
        <div className="header__logo">OD</div>
        <div>
          <h1>Offline Devices Caller</h1>
          <p>Zoho sync · Exotel calls · ElevenLabs agent</p>
        </div>
      </div>
      
      {/* API Health Monitor Metadata Widget */}
      <div className="header__meta">
        {/* Floating pill capsule containing status light and status text */}
        <div className="health-status">
          {/* Neon pulsing green dot if healthy, static red dot if backend goes offline */}
          <span className={`health-dot ${isHealthy ? "health-dot--ok" : "health-dot--bad"}`} />
          <span className="health-text">
            {loading ? "Checking API…" : isHealthy ? "API online" : "API unreachable"}
          </span>
        </div>
        {/* Diagnostic display of our current API target address */}
        <code className="api-url">{API_BASE}</code>
      </div>
    </header>
  );
}
