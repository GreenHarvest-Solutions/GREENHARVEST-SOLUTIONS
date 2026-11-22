const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  uploadProductImage,
  uploadProductImages,
  deleteProductImage,
} = require('../controllers/uploadController');

const router = express.Router();

// Only authenticated farmers or admins can upload product images
router.post('/product-images', authMiddleware, requireRole('farmer', 'admin'), uploadProductImages);
router.post('/product-image', authMiddleware, requireRole('farmer', 'admin'), uploadProductImage);
router.delete('/product-image', authMiddleware, requireRole('farmer', 'admin'), deleteProductImage);

module.exports = router;
