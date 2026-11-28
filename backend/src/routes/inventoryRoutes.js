const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  adjustBranchInventory,
  createTransfer,
  getBranchInventory,
  getBranchMovements,
  getInventoryByProduct,
  listTransfers,
  transitionTransfer,
  updateInventory,
  upsertBranchInventory,
} = require("../controllers/inventoryController");

const router = express.Router();

router.use(authMiddleware);

router.put("/update", roleMiddleware("admin", "farmer", "fieldAgent"), updateInventory);

// Inter-branch controlled stock transfers
router.get("/transfers", listTransfers);
router.post("/transfers", createTransfer);
router.post("/transfers/:transferId/action", transitionTransfer);

// Branch-scoped inventory & ledger movements
router.get("/branches/:branchId", getBranchInventory);
router.put("/branches/:branchId", upsertBranchInventory);
router.post("/branches/:branchId/adjust", adjustBranchInventory);
router.get("/branches/:branchId/movements", getBranchMovements);

// Product aggregate + branch breakdown
router.get("/:productId", getInventoryByProduct);

module.exports = router;
