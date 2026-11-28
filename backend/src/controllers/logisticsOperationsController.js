const logisticsOps = require("../services/logisticsOperationsService");
const branchAllocationService = require("../services/branchAllocationService");
const deliveryPricingService = require("../services/deliveryPricingService");

const handleError = (res, error) => {
  if (error && error.statusCode) {
    return res.status(error.statusCode).json({
      message: error.message,
      ...(error.requires_split_approval ? { requires_split_approval: true, proposed_packages: error.proposed_packages, total_split_shipping_fee: error.total_split_shipping_fee } : {}),
      ...(error.requires_buyer_approval ? { requires_buyer_approval: true, fee_delta: error.fee_delta, new_shipping_fee: error.new_shipping_fee } : {}),
    });
  }
  return res.status(500).json({ message: error?.message || "Internal server error" });
};

const createQuote = async (req, res) => {
  try {
    const result = await logisticsOps.createDeliveryQuote({ buyer_id: req.user.id, payload: req.body || {} });
    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

const changeSuborderAddress = async (req, res) => {
  try {
    const result = await branchAllocationService.handlePostCheckoutAddressChange({
      actor: req.user,
      orderId: req.params.orderId,
      suborderId: req.params.suborderId,
      newAddress: req.body,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

const reallocateBranch = async (req, res) => {
  try {
    const result = await branchAllocationService.reallocateSuborderBranch({
      actor: req.user,
      suborderId: req.params.suborderId,
      targetBranchId: req.body?.target_branch_id,
      approveFeeDelta: Boolean(req.body?.approve_fee_delta),
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

const respondException = async (req, res) => {
  try {
    const ex = await logisticsOps.respondToDeliveryException({
      actor: req.user,
      exceptionId: req.params.id,
      decision: req.body?.decision,
      resolutionNotes: req.body?.notes || "",
    });
    return res.status(200).json({ exception: ex });
  } catch (err) {
    return handleError(res, err);
  }
};

const listTimeSlots = async (req, res) => {
  try {
    const slots = await logisticsOps.listTimeSlots(req.query || {});
    return res.status(200).json({ slots });
  } catch (err) {
    return handleError(res, err);
  }
};

const createTimeSlot = async (req, res) => {
  try {
    const slot = await logisticsOps.createTimeSlot({ actor: req.user, payload: req.body || {} });
    return res.status(201).json({ slot });
  } catch (err) {
    return handleError(res, err);
  }
};

const proposeSubstitution = async (req, res) => {
  try {
    const substitution = await logisticsOps.proposeSubstitution({
      actor: req.user,
      suborderId: req.params.suborderId,
      payload: req.body || {},
    });
    return res.status(201).json({ substitution });
  } catch (err) {
    return handleError(res, err);
  }
};

const listMySubstitutions = async (req, res) => {
  try {
    const substitutions = await logisticsOps.listBuyerSubstitutions({ buyerId: req.user.id });
    return res.status(200).json({ substitutions });
  } catch (err) {
    return handleError(res, err);
  }
};

const respondSubstitution = async (req, res) => {
  try {
    const result = await logisticsOps.respondToSubstitution({
      actor: req.user,
      substitutionId: req.params.id,
      decision: req.body?.decision,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

const scanSla = async (req, res) => {
  try {
    const result = await logisticsOps.scanSlaViolations();
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

const listExceptions = async (req, res) => {
  try {
    const exceptions = await logisticsOps.listExceptionsAdmin({ status: req.query?.status });
    return res.status(200).json({ exceptions });
  } catch (err) {
    return handleError(res, err);
  }
};

const getCommunications = async (req, res) => {
  try {
    const messages = await logisticsOps.listOrderCommunications({
      actor: req.user,
      orderId: req.params.orderId,
      suborderId: req.query?.suborder_id || null,
    });
    return res.status(200).json({ messages });
  } catch (err) {
    return handleError(res, err);
  }
};

const postCommunication = async (req, res) => {
  try {
    const msg = await logisticsOps.postOrderCommunication({
      actor: req.user,
      orderId: req.params.orderId,
      suborderId: req.body?.suborder_id || null,
      channel: req.body?.channel || "buyer_farmer",
      message: req.body?.message,
      disputeId: req.body?.dispute_id || null,
    });
    return res.status(201).json({ message: msg });
  } catch (err) {
    return handleError(res, err);
  }
};

const listPricingRules = async (_req, res) => {
  try {
    const rules = await deliveryPricingService.listPricingRulesAdmin();
    return res.status(200).json({ rules });
  } catch (err) {
    return handleError(res, err);
  }
};

const createPricingRule = async (req, res) => {
  try {
    const rule = await deliveryPricingService.createPricingRuleVersion({
      actorId: req.user.id,
      payload: req.body || {},
    });
    return res.status(201).json({ rule });
  } catch (err) {
    return handleError(res, err);
  }
};

const getFinancialReconciliation = async (req, res) => {
  try {
    const farmerId = req.user.role === "farmer" ? req.user.id : (req.query?.farmer_id || null);
    const data = await logisticsOps.getBranchFinancialReconciliation({ farmerId });
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

const getAllocationStrategy = async (_req, res) => {
  try {
    const strategy = await logisticsOps.getAllocationStrategySetting();
    return res.status(200).json(strategy);
  } catch (err) {
    return handleError(res, err);
  }
};

const setAllocationStrategy = async (req, res) => {
  try {
    const strategy = await logisticsOps.updateAllocationStrategySetting({
      actorId: req.user.id,
      strategy: req.body?.strategy,
    });
    return res.status(200).json(strategy);
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = {
  changeSuborderAddress,
  createPricingRule,
  createQuote,
  createTimeSlot,
  getAllocationStrategy,
  getCommunications,
  getFinancialReconciliation,
  listExceptions,
  listMySubstitutions,
  listPricingRules,
  listTimeSlots,
  postCommunication,
  proposeSubstitution,
  reallocateBranch,
  respondException,
  respondSubstitution,
  scanSla,
  setAllocationStrategy,
};
