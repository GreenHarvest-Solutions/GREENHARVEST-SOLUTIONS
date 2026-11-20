// Backend: dedicated upload endpoint for Cloudinary
const logger = require('../utils/logger');
const { cloudinary, upload } = require('../config/cloudinary');
const { pool } = require('../config/db');

/**
 * POST /api/upload/product-image
 * Multer middleware handles the multipart upload to Cloudinary.
 * Returns { url, public_id } on success.
 */
const uploadProductImage = [
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      // multer-storage-cloudinary already uploaded the file; the URL is in req.file.path
      return res.status(200).json({
        url: req.file.path,
        public_id: req.file.filename,
      });
    } catch (error) {
      logger.error('Image upload failed', { message: error.message });
      return res.status(500).json({ message: 'Image upload failed' });
    }
  },
];

/**
 * DELETE /api/upload/product-image
 * Deletes an image from Cloudinary by public_id.
 */
const ALLOWED_UPLOAD_PREFIX = 'greenharvest/products/';

const deleteProductImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({ message: 'public_id is required' });
    }

    // Path traversal rejection
    if (public_id.includes('..') || public_id.includes('\0')) {
      return res.status(400).json({ message: 'Invalid public_id' });
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

module.exports = { uploadProductImage, deleteProductImage };
