const logger = require("../utils/logger");
const inventoryService = require("../services/inventoryService");

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

const updateInventory = async (req, res) => {
  try {
    const inventory = await inventoryService.updateInventory({
      actor: req.user,
      payload: req.body || {},
    });

    return res.status(200).json({
      message: "Inventory updated successfully",
      inventory,
    });
  } catch (error) {
    return handleControllerError(res, "Update inventory failed", error, {
      userId: req.user && req.user.id,
      body: req.body,
    });
  }
};

const getInventoryByProduct = async (req, res) => {
  try {
    const inventory = await inventoryService.getInventoryByProductId(req.params.productId, req.user);
    return res.status(200).json({ inventory });
  } catch (error) {
    return handleControllerError(res, "Get inventory failed", error, {
      userId: req.user && req.user.id,
      productId: req.params.productId,
    });
  }
};

const getBranchInventory = async (req, res) => {
  try {
    const data = await inventoryService.getBranchInventory({
      actor: req.user,
      branchId: req.params.branchId,
    });
    return res.status(200).json(data);
  } catch (error) {
    return handleControllerError(res, "Get branch inventory failed", error);
  }
};

const upsertBranchInventory = async (req, res) => {
  try {
    const item = await inventoryService.upsertBranchProductStock({
      actor: req.user,
      branchId: req.params.branchId,
      payload: req.body || {},
    });
    return res.status(200).json({ item });
  } catch (error) {
    return handleControllerError(res, "Upsert branch inventory failed", error);
  }
};

const adjustBranchInventory = async (req, res) => {
  try {
    const item = await inventoryService.adjustBranchInventoryBucket({
      actor: req.user,
      branchId: req.params.branchId,
      payload: req.body || {},
    });
    return res.status(200).json({ item });
  } catch (error) {
    return handleControllerError(res, "Adjust branch inventory failed", error);
  }
};

const getBranchMovements = async (req, res) => {
  try {
    const data = await inventoryService.getBranchMovements({
      actor: req.user,
      branchId: req.params.branchId,
      productId: req.query.product_id || null,
    });
    return res.status(200).json(data);
  } catch (error) {
    return handleControllerError(res, "Get branch movements failed", error);
  }
};

const listTransfers = async (req, res) => {
  try {
    const data = await inventoryService.listFarmerTransfers(req.user);
    return res.status(200).json(data);
  } catch (error) {
    return handleControllerError(res, "List transfers failed", error);
  }
};

const createTransfer = async (req, res) => {
  try {
    const transfer = await inventoryService.createInventoryTransfer({
      actor: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ transfer });
  } catch (error) {
    return handleControllerError(res, "Create transfer failed", error);
  }
};

const transitionTransfer = async (req, res) => {
  try {
    const transfer = await inventoryService.transitionInventoryTransfer({
      actor: req.user,
      transferId: req.params.transferId,
      action: req.body?.action,
      payload: req.body || {},
    });
    return res.status(200).json({ transfer });
  } catch (error) {
    return handleControllerError(res, "Transition transfer failed", error);
  }
};

module.exports = {
  adjustBranchInventory,
  createTransfer,
  getBranchInventory,
  getBranchMovements,
  getInventoryByProduct,
  listTransfers,
  transitionTransfer,
  updateInventory,
  upsertBranchInventory,
};
