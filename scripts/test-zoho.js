/**
 * Phase 2 test script — no MongoDB required.
 * Run: npm run test:zoho
 */
require("dotenv").config();

const { fetchOfflineDeviceCustomers } = require("../src/services/zohoService");

async function main() {
  console.log("Fetching customers from Zoho Projects...\n");

  const result = await fetchOfflineDeviceCustomers();

  console.log(`Project: ${result.project.name} (${result.project.id})`);
  console.log(
    `Parent task: ${result.parentTask.name} (${result.parentTask.id})`
  );
  console.log(`Subtasks found: ${result.customers.length}\n`);

  result.customers.slice(0, 10).forEach((customer, index) => {
    console.log(
      `${index + 1}. ${customer.zohoTaskPrefix || customer.zohoSubtaskId} | ` +
        `${customer.cxName} | ${customer.cxNumber} | ` +
        `offline ${customer.offlineUnits}/${customer.totalUnits} | ` +
        `expiry ${customer.updatedExpiry}`
    );
  });

  if (result.customers.length > 10) {
    console.log(`\n... and ${result.customers.length - 10} more`);
  }
}

main().catch((error) => {
  console.error("\nZoho test failed:", error.message);
  process.exit(1);
});
