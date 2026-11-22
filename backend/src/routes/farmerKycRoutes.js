const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  getFarmerKycStatus,
  uploadFarmerKycDocument,
  deleteFarmerKycDocument,
  submitFarmerKyc,
} = require("../controllers/farmerKycController");

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("farmer"));

router.get("/", getFarmerKycStatus);
router.post("/documents", uploadFarmerKycDocument);
router.delete("/documents/:id", deleteFarmerKycDocument);
router.post("/submit", submitFarmerKyc);

module.exports = router;

