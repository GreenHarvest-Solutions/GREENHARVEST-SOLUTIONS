const addressService = require("../services/addressService");

const handleError = (res, error) => {
  if (error && error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return res.status(500).json({ message: error?.message || "Internal server error" });
};

const listAddresses = async (req, res) => {
  try {
    const addresses = await addressService.listMyAddresses(req.user);
    return res.status(200).json({ addresses });
  } catch (error) {
    return handleError(res, error);
  }
};

const createAddress = async (req, res) => {
  try {
    const result = await addressService.createMyAddress({ actor: req.user, payload: req.body || {} });
    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const updateAddress = async (req, res) => {
  try {
    const address = await addressService.updateMyAddress({
      actor: req.user,
      addressId: req.params.id,
      payload: req.body || {},
    });
    return res.status(200).json({ address });
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteAddress = async (req, res) => {
  try {
    const result = await addressService.deleteMyAddress({ actor: req.user, addressId: req.params.id });
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
};
