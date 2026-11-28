const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const addressController = require("../controllers/addressController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", addressController.listAddresses);
router.post("/", addressController.createAddress);
router.put("/:id", addressController.updateAddress);
router.delete("/:id", addressController.deleteAddress);

module.exports = router;
