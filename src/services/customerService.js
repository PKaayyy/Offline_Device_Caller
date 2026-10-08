const Customer = require("../models/Customer");
const { fetchOfflineDeviceCustomers } = require("./zohoService");

/**
 * Normalizes phone numbers by stripping out spaces, dashes, or brackets.
 * This simplifies phone-based matches when webhooks arrive from external servers.
 */
function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "");
}

/**
 * Inserts a customer into the database, or updates their record if they exist.
 * Uses 'findOneAndUpdate' with 'upsert: true' to perform this "Update-or-Insert" operation
 * matching the unique 'zohoSubtaskId'.
 */
async function upsertCustomer(customerData) {
  return Customer.findOneAndUpdate(
    { zohoSubtaskId: customerData.zohoSubtaskId },
    { ...customerData, syncedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * High-level orchestration for Zoho synchronization:
 * 1. Pulls open customer tasks from Zoho Projects API.
 * 2. Iterates over the tasks and saves/updates them in MongoDB using upserts.
 * 3. Returns counts of items fetched and items saved.
 */
async function syncCustomersFromZoho() {
  const { project, parentTask, customers } = await fetchOfflineDeviceCustomers();

  const saved = [];
  for (const customer of customers) {
    saved.push(await upsertCustomer(customer));
  }

  return {
    project,
    parentTask,
    totalFetched: customers.length,
    totalSaved: saved.length,
    customers: saved,
  };
}

/**
 * Queries MongoDB to list all customer records, sorted by when they were last updated.
 */
async function listCustomers(filter = {}) {
  return Customer.find(filter).sort({ updatedAt: -1 });
}

/**
 * Finds a customer document by their phone number.
 * Performs a search matching either the normalized digits or the raw digits.
 */
async function findCustomerByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  return Customer.findOne({
    $or: [{ cxNumber: normalized }, { cxNumber: phone }],
  });
}

/**
 * Finds a customer document by their unique MongoDB Object ID.
 */
async function findCustomerById(id) {
  return Customer.findById(id);
}

module.exports = {
  syncCustomersFromZoho,
  listCustomers,
  findCustomerByPhone,
  findCustomerById,
  normalizePhone,
};
