// Load environmental variables defined in your root .env file
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

// Import database connection configuration
const { connectDatabase } = require("./config/db");
// Import manual/automated synchronization service from customerService
const { syncCustomersFromZoho } = require("./services/customerService");

// Import endpoint route maps
const healthRoutes = require("./routes/health");
const syncRoutes = require("./routes/sync");
const customerRoutes = require("./routes/customers");
const callRoutes = require("./routes/calls");
const webhookRoutes = require("./routes/webhooks");

// Determine connection port and application base URL targets
const PORT = Number(process.env.PORT || 3001);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const ZOHO_SYNC_CRON = process.env.ZOHO_SYNC_CRON || "0 */3 * * *"; // Cron formula (runs sync every 3 hours by default)

// Derive Exotel callback callback URL address
const EXOTEL_STATUS_CALLBACK_URL =
  process.env.EXOTEL_STATUS_CALLBACK_URL ||
  `${APP_BASE_URL.replace(/\/$/, "")}/webhooks/exotel/status`;
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");

/**
 * Custom CORS Options Builder:
 * Restricts browser API access to trusted origins. Same-origin requests (e.g. server-to-server)
 * are allowed by default, while external browsers are validated against our allowedOrigins list.
 */
function buildCorsOptions(req, callback) {
  const allowedOrigins = new Set([
    FRONTEND_URL ? FRONTEND_URL.replace(/\/$/, "") : "",
    APP_BASE_URL ? APP_BASE_URL.replace(/\/$/, "") : "",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);

  const origin = req.header("Origin");
  const host = req.header("Host");

  let isSameOrigin = false;
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        isSameOrigin = true;
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  }

  // Allow access if origin is safe, same-origin, or listed on allowedOrigins
  if (!origin || isSameOrigin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}

/**
 * Static file server. Used to host client assets (Vite index.html bundle) directly
 * from backend in production builds. (Disabled by default during dev).
 */
function mountFrontend(app) {
  if (!fs.existsSync(CLIENT_DIST)) {
    console.log("Frontend build not found — run npm run build to serve UI from backend");
    return;
  }

  app.use(express.static(CLIENT_DIST));

  app.get("*", (req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });

  console.log(`Serving frontend from ${CLIENT_DIST}`);
}

/**
 * SERVER STARTER:
 * 1. Resolves MongoDB database connections.
 * 2. Initializes Express application.
 * 3. Mounts global JSON middlewares and CORS configurations.
 * 4. Binds health checks, API endpoints, and webhook routing tables.
 * 5. Launches background scheduler (cron job) to run automated Zoho Sync pull cycles.
 */
async function startServer() {
  try {
    await connectDatabase();
  } catch (error) {
    console.error("==================================================");
    console.error("Database connection failed during startup:", error.message);
    console.error("The server will start, but database queries will fail. Make sure MongoDB is running and whitelisted.");
    console.error("==================================================");
  }

  const app = express();
  
  // Apply CORS validation
  app.use(cors(buildCorsOptions));
  
  // Set JSON parser middleware with a 1 Megabyte payload limit threshold
  app.use(express.json({ limit: "1mb" }));
  
  // Bind endpoint routing tables
  app.use(healthRoutes);
  app.use(syncRoutes);
  app.use(customerRoutes);
  app.use(callRoutes);
  app.use(webhookRoutes);

  // Global Error Handler middleware: catches unhandled route errors or CORS rejections
  app.use((err, _req, res, _next) => {
    if (err.message?.startsWith("CORS blocked")) {
      return res.status(403).json({ ok: false, error: err.message });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  // Start HTTP Listener
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Frontend dev URL (CORS allowed): ${FRONTEND_URL}`);
    console.log("Try GET /health first, then POST /sync after Zoho .env is filled");
    console.log(`Exotel status callback URL: ${EXOTEL_STATUS_CALLBACK_URL}`);
    console.log(`ElevenLabs post-call webhook URL: ${APP_BASE_URL}/webhooks/elevenlabs/post-call`);
  });

  // Validate the Cron syntax defined in .env config
  if (!cron.validate(ZOHO_SYNC_CRON)) {
    throw new Error(`Invalid ZOHO_SYNC_CRON expression: ${ZOHO_SYNC_CRON}`);
  }

  // Initialize automated background sync scheduler
  cron.schedule(ZOHO_SYNC_CRON, async () => {
    console.log("Running scheduled Zoho sync...");
    try {
      const result = await syncCustomersFromZoho();
      console.log(`Scheduled sync complete: ${result.totalSaved} customers saved`);
    } catch (error) {
      console.error("Scheduled sync failed:", error.message);
    }
  });
  console.log(`Zoho auto-sync scheduled: ${ZOHO_SYNC_CRON}`);
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
