const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  getMe,
  updateMe,
  listUsers,
  getFarmerProfile,
  getFarmerProfileProgress,
  updateFarmerProfileExtended,
} = require("../controllers/userController");

const router = express.Router();

// Specific farmer endpoints (defined before /farmer/:id to avoid parameter capture)
router.get("/farmer/profile-progress", authMiddleware, roleMiddleware("farmer"), getFarmerProfileProgress);
router.put("/farmer/profile-extended", authMiddleware, roleMiddleware("farmer"), updateFarmerProfileExtended);

// Public route for viewing farmer profile by ID
router.get("/farmer/:id", getFarmerProfile);

// Protected routes
router.use(authMiddleware);

router.get("/me", getMe);
router.put("/me", updateMe);
router.get("/", roleMiddleware("admin"), listUsers);

module.exports = router;
