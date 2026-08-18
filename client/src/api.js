const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || data.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getHealth() {
  return request("/health");
}

export function getCustomers() {
  return request("/customers");
}

export function syncFromZoho() {
  return request("/sync", { method: "POST" });
}

export function triggerCall(customerId) {
  return request("/calls/trigger", {
    method: "POST",
    body: JSON.stringify({ customerId }),
  });
}

export { API_BASE };
