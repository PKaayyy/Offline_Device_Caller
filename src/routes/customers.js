const express = require("express");
const { listCustomers, findCustomerById } = require("../services/customerService");

const router = express.Router();

/**
 * GET /customers
 * Use case: Used by React app to load the main spreadsheet grid.
 * Returns the array of all customer documents, sorted by update date.
 */
router.get("/customers", async (_req, res) => {
  try {
    const customers = await listCustomers();
    res.json({ ok: true, count: customers.length, customers });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /customers/:id
 * Use case: Fetch the detailed parameters of a single customer by their Object ID.
 * Returns 404 error if ID is invalid or customer was deleted.
 */
router.get("/customers/:id", async (req, res) => {
  try {
    const customer = await findCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ ok: false, error: "Customer not found" });
    }
    res.json({ ok: true, customer });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
