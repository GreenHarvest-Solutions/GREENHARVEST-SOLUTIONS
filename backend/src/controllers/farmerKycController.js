const logger = require("../utils/logger");
const kycModel = require("../models/kycModel");
const { kycUpload } = require("../config/cloudinary");

const handleControllerError = (res, context, error, meta = {}) => {
  logger.error(context, {
    message: error.message,
    code: error.code,
    stack: error.stack,
    ...meta,
  });

  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Internal server error",
  });
};

/**
 * GET /api/farmer/kyc
 * Returns farmer KYC self-service status, uploaded documents, reviews, and allowed actions.
 */
const getFarmerKycStatus = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const status = await kycModel.getFarmerKycStatus(userId);

    if (!status) {
      return res.status(404).json({ message: "Farmer profile not found" });
    }

    return res.status(200).json(status);
  } catch (error) {
    return handleControllerError(res, "Get farmer KYC status failed", error, {
      userId: req.user && (req.user.user_id || req.user.id),
    });
  }
};

/**
 * POST /api/farmer/kyc/documents
 * Supports multipart document upload or direct JSON document submission
 */
const uploadFarmerKycDocument = [
  (req, res, next) => {
    // If request is multipart/form-data, process with multer
    if (req.is("multipart/form-data")) {
      return kycUpload.single("document")(req, res, (err) => {
        if (err) {
          return res.status(400).json({ message: err.message || "File upload failed" });
        }
        return next();
      });
    }
    return next();
  },
  async (req, res) => {
    try {
      const userId = req.user.user_id || req.user.id;
      const {
        document_type = "national_id",
        document_category = "identity",
        document_url,
        public_id,
        expires_at,
        ocr_raw_text,
        extracted_data,
        id_hash,
      } = req.body;

      const finalUrl = req.file ? req.file.path : document_url;
      const finalPublicId = req.file ? req.file.filename : public_id;

      if (!finalUrl) {
        return res.status(400).json({ message: "No document file or URL provided" });
      }

      const newDoc = await kycModel.addKycDocument({
        userId,
        documentType: document_type,
        documentUrl: finalUrl,
        publicId: finalPublicId,
        documentCategory: document_category || "identity",
        ocrRawText: ocr_raw_text || null,
        extractedData: extracted_data || {},
        idHash: id_hash || null,
        expiresAt: expires_at || null,
        actorId: userId,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.status(201).json({
        message: "Document uploaded successfully",
        document: newDoc,
      });
    } catch (error) {
      return handleControllerError(res, "Upload farmer KYC document failed", error, {
        userId: req.user && (req.user.user_id || req.user.id),
      });
    }
  },
];

/**
 * DELETE /api/farmer/kyc/documents/:id
 * Removes an uploaded document by farmer
 */
const deleteFarmerKycDocument = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const documentId = parseInt(req.params.id, 10);

    const deleted = await kycModel.deleteFarmerKycDocument({
      documentId,
      userId,
      actorId: userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    if (!deleted) {
      return res.status(404).json({ message: "Document not found or does not belong to you" });
    }

    return res.status(200).json({
      message: "Document removed successfully",
      document: deleted,
    });
  } catch (error) {
    return handleControllerError(res, "Delete farmer KYC document failed", error, {
      userId: req.user && (req.user.user_id || req.user.id),
      documentId: req.params.id,
    });
  }
};

/**
 * POST /api/farmer/kyc/submit
 * Formally transitions application to 'under_review'
 */
const submitFarmerKyc = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const result = await kycModel.submitFarmerKyc(userId, {
      actorId: userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, "Submit farmer KYC application failed", error, {
      userId: req.user && (req.user.user_id || req.user.id),
    });
  }
};

module.exports = {
  getFarmerKycStatus,
  uploadFarmerKycDocument,
  deleteFarmerKycDocument,
  submitFarmerKyc,
};

