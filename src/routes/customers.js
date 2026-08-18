const express = require("express");
const { listCustomers, findCustomerById } = require("../services/customerService");

const router = express.Router();

router.get("/customers", async (_req, res) => {
  try {
    const customers = await listCustomers();
    res.json({ ok: true, count: customers.length, customers });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

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
