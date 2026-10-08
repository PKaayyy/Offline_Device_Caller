// Define the base URL of the backend API server.
// It checks if Vite has loaded an environment variable 'VITE_API_URL'. If not, it defaults to localhost port 3001.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Generic helper function to handle API requests using the web browser's fetch API.
 * @param {string} path - The relative URL path of the API endpoint (e.g. "/customers")
 * @param {object} options - Fetch options such as headers, HTTP method (GET, POST), and body
 * @returns {Promise<any>} The parsed JSON data returned by the server
 */
async function request(path, options = {}) {
  // Combine the API base URL with the requested path, and set JSON request headers by default
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Extract the JSON data from the response stream. Catch empty responses as an empty object.
  const data = await response.json().catch(() => ({}));

  // If the HTTP response status code indicates an error (outside the 200-299 range)
  if (!response.ok) {
    // Determine the error message (prioritize backend error fields, fallback to generic HTTP status code)
    const message = data.error || data.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.code = data.code; // Attach custom system codes (e.g., EXOTEL_NOT_CONFIGURED)
    error.status = response.status;
    throw error; // Propagate the error so the calling component can catch it and display an alert
  }

  return data;
}

/**
 * Use case: Retrieve backend service status during dashboard initialization.
 * Endpoint: GET /health
 */
export function getHealth() {
  return request("/health");
}

/**
 * Use case: Get list of customers from MongoDB to populate the main dashboard spreadsheet.
 * Endpoint: GET /customers
 */
export function getCustomers() {
  return request("/customers");
}

/**
 * Use case: Manually trigger a pull request to sync offline support tasks from Zoho Projects to MongoDB.
 * Endpoint: POST /sync
 */
export function syncFromZoho() {
  return request("/sync", { method: "POST" });
}

/**
 * Use case: Trigger an automated customer call through Exotel/ElevenLabs.
 * Endpoint: POST /calls/trigger
 * @param {string} customerId - The unique database ID of the target customer
 */
export function triggerCall(customerId) {
  return request("/calls/trigger", {
    method: "POST",
    body: JSON.stringify({ customerId }),
  });
}

export { API_BASE };
