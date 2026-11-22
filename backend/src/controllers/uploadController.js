// Backend: dedicated upload endpoint for Cloudinary & Local Storage Fallback
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { cloudinary, upload, isCloudinaryConfigured } = require('../config/cloudinary');
const { pool } = require('../config/db');

/**
 * POST /api/upload/product-image
 * Multer middleware handles upload to Cloudinary (or local disk fallback).
 * Returns { url, public_id } on success.
 */
const uploadProductImage = [
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const imageUrl = req.file.path && req.file.path.startsWith('http')
        ? req.file.path
        : `${baseUrl}/uploads/${req.file.filename}`;

      return res.status(200).json({
        url: imageUrl,
        public_id: req.file.filename,
      });
    } catch (error) {
      logger.error('Image upload failed', { message: error.message });
      return res.status(500).json({ message: 'Image upload failed' });
    }
  },
];

/**
 * POST /api/upload/product-images
 * Multer middleware handles multi-image upload to Cloudinary or disk (up to 5 images).
 * Returns { images: [{ url, public_id }], urls: string[] } on success.
 */
const uploadProductImages = [
  upload.array('images', 5),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No image files provided' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const uploaded = req.files.map((file) => {
        const url = file.path && file.path.startsWith('http')
          ? file.path
          : `${baseUrl}/uploads/${file.filename}`;
        return {
          url,
          public_id: file.filename,
        };
      });

      return res.status(200).json({
        images: uploaded,
        urls: uploaded.map((u) => u.url),
      });
    } catch (error) {
      logger.error('Multi-image upload failed', { message: error.message });
      return res.status(500).json({ message: 'Image upload failed' });
    }
  },
];

/**
 * DELETE /api/upload/product-image
 * Deletes an image from Cloudinary or local disk by public_id.
 */
const ALLOWED_UPLOAD_PREFIX = 'greenharvest/products/';

const deleteProductImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({ message: 'public_id is required' });
    }

    // Path traversal rejection
    if (public_id.includes('..') || public_id.includes('\0') || public_id.includes('/') || public_id.includes('\\')) {
      if (!public_id.startsWith(ALLOWED_UPLOAD_PREFIX)) {
        return res.status(400).json({ message: 'Invalid public_id' });
      }
    }

    // Local disk deletion fallback
    if (!isCloudinaryConfigured || public_id.startsWith('crop_')) {
      const localFilePath = path.join(__dirname, '../../public/uploads', path.basename(public_id));
      if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch {
          // Non-blocking
        }
      }
      return res.status(200).json({ message: 'Image deleted successfully' });
    }

    if (!public_id.startsWith(ALLOWED_UPLOAD_PREFIX)) {
      return res.status(403).json({ message: 'Cannot delete images outside your upload folder' });
    }

    // Authorization: ensure farmer only deletes their own images
    if (req.user?.role !== 'admin') {
      const userFolderPrefix = `${ALLOWED_UPLOAD_PREFIX}${req.user?.id}/`;
      const isUserFolder = public_id.startsWith(userFolderPrefix);

      if (!isUserFolder) {
        // If image is in the legacy common folder, check if it belongs to another farmer's product
        const ownerCheck = await pool.query(
          `
            SELECT p.farmer_id
            FROM products p
            WHERE p.image_url LIKE $1
            LIMIT 1
          `,
          [`%${public_id}%`]
        );

        if (ownerCheck.rows.length > 0 && Number(ownerCheck.rows[0].farmer_id) !== Number(req.user?.id)) {
          return res.status(403).json({ message: "You are not authorized to delete another user's image" });
        }
      }
    }

    await cloudinary.uploader.destroy(public_id);
    return res.status(200).json({ message: 'Image deleted successfully' });
  } catch (error) {
    logger.error('Image delete failed', { message: error.message });
    return res.status(500).json({ message: 'Image delete failed' });
  }
};

module.exports = { uploadProductImage, uploadProductImages, deleteProductImage };
