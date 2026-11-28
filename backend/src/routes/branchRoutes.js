const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const branchController = require("../controllers/branchController");

const router = express.Router();

// Public delivery zones discovery (for buyer checkout / address serviceability)
router.get("/zones", branchController.listDeliveryZones);

router.use(authMiddleware);

// Admin delivery zones & branch vetting
router.get("/admin/all", requireRole("admin"), branchController.adminListBranches);
router.patch("/admin/:id/verify", requireRole("admin"), branchController.adminVerifyBranch);
router.post("/zones", requireRole("admin"), branchController.upsertDeliveryZone);
router.put("/zones", requireRole("admin"), branchController.upsertDeliveryZone);

// Farmer Business & Branch Management (owners, staff, admins)
router.get("/business/me", branchController.getMyBusiness);
router.put("/business/me", requireRole("farmer", "admin"), branchController.updateMyBusiness);

router.get("/my", branchController.getMyBusiness);
router.post("/", requireRole("farmer", "admin"), branchController.createBranch);
router.get("/:id", branchController.getBranchDetails);
router.put("/:id", branchController.updateBranch);
router.post("/:id/submit-verification", branchController.submitBranchVerification);
router.patch("/:id/operational-status", branchController.updateBranchOperationalStatus);

// Branch Staff & Scoped Permissions
router.get("/:id/staff", branchController.listStaff);
router.post("/:id/staff", branchController.assignStaff);
router.delete("/:id/staff/:staffId", branchController.removeStaff);

// Branch Service Areas
router.get("/:id/service-areas", branchController.listServiceAreas);
router.put("/:id/service-areas", branchController.upsertServiceArea);

module.exports = router;
