const logger = require("../utils/logger");
const kycModel = require("../models/kycModel");
const { kycUpload } = require("../config/cloudinary");
const intelligenceService = require("../services/intelligenceService");
const riskAdminModel = require("../models/riskAdminModel");

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

      // 1. Process Document Intelligence & OCR Extraction
      let finalOcrText = ocr_raw_text || null;
      let finalExtracted = extracted_data ? (typeof extracted_data === "string" ? JSON.parse(extracted_data) : extracted_data) : {};
      let finalIdHash = id_hash || null;
      let ocrConfidence = null;

      try {
        const intel = intelligenceService.processKycDocumentOcr({
          filePath: req.file ? req.file.path : null,
          rawText: ocr_raw_text || null,
          documentType: document_type,
        });

        if (intel && (intel.raw_text || intel.id_hash || intel.confidence_score > 0)) {
          finalOcrText = intel.raw_text || finalOcrText;
          finalExtracted = { ...finalExtracted, ...intel.extracted_fields };
          finalIdHash = intel.id_hash || finalIdHash;
          ocrConfidence = intel.confidence_score || null;
        }
      } catch (ocrErr) {
        logger.warn("Automated OCR extraction error", { message: ocrErr.message });
      }

      // 2. Check for Duplicate Identities (Fayda / Kebele / Name)
      try {
        const dupCheck = await intelligenceService.checkIdentityDuplicates({
          farmerId: userId,
          idNumber: finalExtracted?.id_number,
          idHash: finalIdHash,
          name: finalExtracted?.full_name,
          region: finalExtracted?.region,
          woreda: finalExtracted?.woreda,
          kebele: finalExtracted?.kebele,
        });

        if (dupCheck.is_duplicate) {
          logger.warn("Duplicate farmer identity detected", {
            farmerId: userId,
            matchCount: dupCheck.match_count,
            highestRisk: dupCheck.highest_risk,
          });

          await riskAdminModel.createRiskFlag({
            entity_type: "farmer",
            entity_id: userId,
            flag_type: "duplicate_identity",
            severity: "critical",
            flag_reason: `Duplicate farmer registration detected: matches farmer #${dupCheck.matches[0].farmer_id} (${dupCheck.matches[0].match_type})`,
            evidence: {
              matches: dupCheck.matches,
              highest_risk: dupCheck.highest_risk,
            },
            confidence_score: dupCheck.matches[0].similarity || 90.0,
          });
        }
      } catch (dupErr) {
        logger.warn("Duplicate identity check error", { message: dupErr.message });
      }

      const newDoc = await kycModel.addKycDocument({
        userId,
        documentType: document_type,
        documentUrl: finalUrl,
        publicId: finalPublicId,
        documentCategory: document_category || "identity",
        ocrRawText: finalOcrText,
        extractedData: finalExtracted,
        idHash: finalIdHash,
        ocrConfidence,
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

