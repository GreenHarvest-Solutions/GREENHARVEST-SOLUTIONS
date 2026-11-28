const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const ctrl = require("../controllers/logisticsOperationsController");

const router = express.Router();

router.use(authMiddleware);

// Quotations & Post-Checkout Reallocation / Address Change
router.post("/quotes", requireRole("buyer", "admin"), ctrl.createQuote);
router.post("/orders/:orderId/suborders/:suborderId/change-address", ctrl.changeSuborderAddress);
router.post("/suborders/:suborderId/reallocate-branch", requireRole("farmer", "admin"), ctrl.reallocateBranch);
router.post("/exceptions/:id/respond", ctrl.respondException);

// Delivery Time Slots
router.get("/time-slots", ctrl.listTimeSlots);
router.post("/time-slots", requireRole("farmer", "admin"), ctrl.createTimeSlot);

// Product Substitutions
router.post("/suborders/:suborderId/substitutions", requireRole("farmer", "admin"), ctrl.proposeSubstitution);
router.post("/substitutions/:id/respond", requireRole("buyer", "admin"), ctrl.respondSubstitution);

// Scoped Operational Communications
router.get("/orders/:orderId/messages", ctrl.getCommunications);
router.post("/orders/:orderId/messages", ctrl.postCommunication);

// Financial Reconciliation (Farmer branch summary or Admin platform reconciliation)
router.get("/financial-reconciliation", requireRole("farmer", "admin"), ctrl.getFinancialReconciliation);

// Admin Pricing Rules, Exceptions, SLA Monitor & Allocation Strategy
router.get("/admin/pricing-rules", requireRole("admin"), ctrl.listPricingRules);
router.post("/admin/pricing-rules", requireRole("admin"), ctrl.createPricingRule);
router.get("/admin/allocation-strategy", requireRole("admin"), ctrl.getAllocationStrategy);
router.put("/admin/allocation-strategy", requireRole("admin"), ctrl.setAllocationStrategy);
router.get("/admin/exceptions", requireRole("admin"), ctrl.listExceptions);
router.post("/admin/sla/scan", requireRole("admin"), ctrl.scanSla);

module.exports = router;
