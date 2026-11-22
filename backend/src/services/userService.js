const userModel = require("../models/userModel");
const { normalizeRole } = require("../utils/roles");

const createServiceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getMe = async (userId) => {
  const user = await userModel.findUserById(userId);

  if (!user) {
    throw createServiceError("User not found", 404);
  }

  return {
    ...user,
    role: normalizeRole(user.role_name || user.role),
  };
};

const getFarmerPublicProfile = async (farmerId) => {
  const numericId = Number(farmerId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw createServiceError("Invalid farmer ID", 400);
  }

  const user = await userModel.findUserById(numericId);
  if (!user || normalizeRole(user.role_name || user.role) !== "farmer") {
    throw createServiceError("Farmer not found", 404);
  }

  return {
    id: user.id,
    name: user.name,
    role: "farmer",
    bio: user.bio || null,
    address: user.address || null,
    created_at: user.created_at,
  };
};

const updateProfile = async (userId, payload) => {
  const updated = await userModel.updateUserProfile({ user_id: userId, ...payload });

  if (!updated) {
    throw createServiceError("User not found", 404);
  }

  return updated;
};

const listUsers = async (actor) => {
  if (!actor || normalizeRole(actor.role) !== "admin") {
    throw createServiceError("Only admins can list users", 403);
  }

  const users = await userModel.findAllUsers();

  return users.map((user) => ({
    ...user,
    role: normalizeRole(user.role_name || user.role),
  }));
};

const getFarmerProfileProgress = async (userId) => {
  const profile = await userModel.getFarmerProfileExtended(userId);
  if (!profile) {
    throw createServiceError("Farmer profile not found", 404);
  }

  return userModel.calculateProfileProgress(profile);
};

const updateFarmerProfileExtended = async (userId, data) => {
  const updated = await userModel.updateFarmerProfileExtended(userId, data);
  if (!updated) {
    throw createServiceError("Failed to update farmer profile", 404);
  }

  const progress = userModel.calculateProfileProgress(updated);
  return {
    profile: updated,
    ...progress,
  };
};

module.exports = {
  getMe,
  getFarmerPublicProfile,
  updateProfile,
  listUsers,
  getFarmerProfileProgress,
  updateFarmerProfileExtended,
};
