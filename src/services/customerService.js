const Customer = require("../models/Customer");
const { fetchOfflineDeviceCustomers } = require("./zohoService");

function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "");
}

async function upsertCustomer(customerData) {
  return Customer.findOneAndUpdate(
    { zohoSubtaskId: customerData.zohoSubtaskId },
    { ...customerData, syncedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

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

async function listCustomers(filter = {}) {
  return Customer.find(filter).sort({ updatedAt: -1 });
}

async function findCustomerByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  return Customer.findOne({
    $or: [{ cxNumber: normalized }, { cxNumber: phone }],
  });
}

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
