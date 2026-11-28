const branchService = require("../services/branchService");
const branchModel = require("../models/branchModel");
const logger = require("../utils/logger");

const handleError = (res, error, context) => {
  if (error && error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(context, { message: error?.message, stack: error?.stack });
  return res.status(500).json({ message: error?.message || "Internal server error" });
};

const getMyBusiness = async (req, res) => {
  try {
    const data = await branchService.getMyBusinessAndBranches(req.user);
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error, "getMyBusiness failed");
  }
};

const updateMyBusiness = async (req, res) => {
  try {
    const business = await branchService.updateMyBusiness({ actor: req.user, payload: req.body });
    return res.status(200).json({ business });
  } catch (error) {
    return handleError(res, error, "updateMyBusiness failed");
  }
};

const createBranch = async (req, res) => {
  try {
    const branch = await branchService.createFarmerBranch({ actor: req.user, payload: req.body });
    return res.status(201).json({ branch });
  } catch (error) {
    return handleError(res, error, "createBranch failed");
  }
};

const getBranchDetails = async (req, res) => {
  try {
    const { branch } = await branchService.assertBranchAccess({
      actor: req.user,
      branchId: req.params.id,
      requiredPermission: null,
    });
    const [staff, serviceAreas, verificationHistory, auditLogs] = await Promise.all([
      branchModel.listBranchStaff(branch.id),
      branchModel.listBranchServiceAreas(branch.id),
      branchModel.getBranchVerificationHistory(branch.id),
      branchModel.getBranchAuditLogs(branch.id, 30),
    ]);
    return res.status(200).json({
      branch,
      staff,
      service_areas: serviceAreas,
      verification_history: verificationHistory,
      audit_logs: auditLogs,
    });
  } catch (error) {
    return handleError(res, error, "getBranchDetails failed");
  }
};

const updateBranch = async (req, res) => {
  try {
    const branch = await branchService.updateFarmerBranch({
      actor: req.user,
      branchId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ branch });
  } catch (error) {
    return handleError(res, error, "updateBranch failed");
  }
};

const submitBranchVerification = async (req, res) => {
  try {
    const branch = await branchService.submitBranchForVerification({
      actor: req.user,
      branchId: req.params.id,
      notes: req.body?.notes || null,
    });
    return res.status(200).json({ branch });
  } catch (error) {
    return handleError(res, error, "submitBranchVerification failed");
  }
};

const updateBranchOperationalStatus = async (req, res) => {
  try {
    const result = await branchService.handleBranchOperationalClosure({
      actor: req.user,
      branchId: req.params.id,
      operationalStatus: req.body?.operational_status,
      closureReason: req.body?.closure_reason || "",
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, "updateBranchOperationalStatus failed");
  }
};

const listStaff = async (req, res) => {
  try {
    await branchService.assertBranchAccess({ actor: req.user, branchId: req.params.id, requiredPermission: null });
    const staff = await branchModel.listBranchStaff(Number(req.params.id));
    return res.status(200).json({ staff });
  } catch (error) {
    return handleError(res, error, "listStaff failed");
  }
};

const assignStaff = async (req, res) => {
  try {
    const staff = await branchService.assignBranchStaff({
      actor: req.user,
      branchId: req.params.id,
      payload: req.body,
    });
    return res.status(201).json({ staff });
  } catch (error) {
    return handleError(res, error, "assignStaff failed");
  }
};

const removeStaff = async (req, res) => {
  try {
    const removed = await branchService.removeBranchStaffMember({
      actor: req.user,
      branchId: req.params.id,
      staffId: req.params.staffId,
    });
    return res.status(200).json({ removed });
  } catch (error) {
    return handleError(res, error, "removeStaff failed");
  }
};

const listServiceAreas = async (req, res) => {
  try {
    const areas = await branchModel.listBranchServiceAreas(Number(req.params.id));
    return res.status(200).json({ service_areas: areas });
  } catch (error) {
    return handleError(res, error, "listServiceAreas failed");
  }
};

const upsertServiceArea = async (req, res) => {
  try {
    await branchService.assertBranchAccess({
      actor: req.user,
      branchId: req.params.id,
      requiredPermission: "manage_branch_settings",
    });
    const area = await branchModel.upsertBranchServiceArea({
      branch_id: Number(req.params.id),
      ...req.body,
    });
    return res.status(200).json({ service_area: area });
  } catch (error) {
    return handleError(res, error, "upsertServiceArea failed");
  }
};

// Admin endpoints
const adminListBranches = async (req, res) => {
  try {
    const data = await branchModel.listBranchesAdmin({
      verification_status: req.query.verification_status,
      operational_status: req.query.operational_status,
      search: req.query.search,
      page: req.query.page || 1,
      limit: req.query.limit || 25,
    });
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error, "adminListBranches failed");
  }
};

const adminVerifyBranch = async (req, res) => {
  try {
    const result = await branchService.reviewBranchVerificationAdmin({
      actor: req.user,
      branchId: req.params.id,
      nextStatus: req.body?.verification_status || req.body?.status,
      decisionNotes: req.body?.decision_notes || req.body?.notes || "",
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, "adminVerifyBranch failed");
  }
};

const listDeliveryZones = async (req, res) => {
  try {
    const zones = await branchModel.listDeliveryZones({
      includeInactive: req.query.include_inactive === "true",
    });
    return res.status(200).json({ zones });
  } catch (error) {
    return handleError(res, error, "listDeliveryZones failed");
  }
};

const upsertDeliveryZone = async (req, res) => {
  try {
    const zone = await branchModel.upsertDeliveryZone(req.body);
    return res.status(200).json({ zone });
  } catch (error) {
    return handleError(res, error, "upsertDeliveryZone failed");
  }
};

module.exports = {
  adminListBranches,
  adminVerifyBranch,
  assignStaff,
  createBranch,
  getBranchDetails,
  getMyBusiness,
  listDeliveryZones,
  listServiceAreas,
  listStaff,
  removeStaff,
  submitBranchVerification,
  updateBranch,
  updateBranchOperationalStatus,
  updateMyBusiness,
  upsertDeliveryZone,
  upsertServiceArea,
};
