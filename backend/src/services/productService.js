// Product service that centralizes product business rules and persistence operations.
const logger = require("../utils/logger");
const categoryModel = require("../models/categoryModel");
const inventoryModel = require("../models/inventoryModel");
const productModel = require("../models/productModel");
const moderationEngine = require("./moderationEngine");
const riskAdminModel = require("../models/riskAdminModel");
const { canManageProduct, isAgentAssignedToFarmer } = require("../utils/authorization");
const { normalizeRole } = require("../utils/roles");
const {
	getMissingRequiredFields,
	isNonNegativeNumber,
	isPositiveInteger,
} = require("../utils/validators");

const createServiceError = (message, statusCode, extra = {}) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	Object.assign(error, extra);
	return error;
};

const ensureFarmerRole = (user) => {
	if (!user || normalizeRole(user.role) !== "farmer") {
		throw createServiceError("Only farmers can perform this action", 403);
	}
};

const getProductOwnership = async (productId) => {
	return productModel.findProductOwnershipById(productId);
};

const getCategoryById = async (categoryId) => {
	return categoryModel.findCategoryById(categoryId);
};

const validateCategoryId = async (categoryId) => {
	if (categoryId === null || categoryId === undefined) {
		return null;
	}

	if (!Number.isInteger(Number(categoryId))) {
		throw createServiceError("category_id must be an integer", 400);
	}

	const parsedCategoryId = Number(categoryId);
	const category = await getCategoryById(parsedCategoryId);

	if (!category) {
		throw createServiceError("Invalid category_id. Referenced category does not exist", 400);
	}

	return parsedCategoryId;
};

const validateFarmerId = async (farmerId) => {
	if (!isPositiveInteger(farmerId)) {
		throw createServiceError("farmer_id must be a valid integer", 400);
	}

	const parsedFarmerId = Number(farmerId);
	const farmer = await productModel.findFarmerById(parsedFarmerId);

	if (!farmer) {
		throw createServiceError("Invalid farmer_id. Referenced farmer does not exist", 400);
	}

	return parsedFarmerId;
};

const buildProductValues = (payload = {}) => {
	return {
		name: payload.name !== undefined ? String(payload.name).trim() : undefined,
		description:
			payload.description !== undefined
				? payload.description
					? String(payload.description).trim()
					: null
				: undefined,
		price: payload.price !== undefined && payload.price !== null && payload.price !== '' ? Number(payload.price) : undefined,
		discount_price: payload.discount_price !== undefined 
			? (payload.discount_price !== '' && payload.discount_price !== null ? Number(payload.discount_price) : null)
			: undefined,
		stock: payload.stock !== undefined && payload.stock !== null && payload.stock !== '' ? Number(payload.stock) : undefined,
		farm_location:
			payload.farm_location !== undefined
				? payload.farm_location
					? String(payload.farm_location).trim()
					: null
				: undefined,
		image_url:
			payload.image_url !== undefined
				? payload.image_url
					? String(payload.image_url).trim()
					: null
				: undefined,
		image_hash:
			payload.image_hash !== undefined
				? payload.image_hash
					? String(payload.image_hash).trim()
					: null
				: undefined,
		harvest_date: payload.harvest_date || payload.harvestDate || undefined,
		unit: payload.unit ? String(payload.unit).trim() : undefined,
		min_order_quantity: payload.min_order_quantity !== undefined && payload.min_order_quantity !== null && payload.min_order_quantity !== '' ? Number(payload.min_order_quantity) : undefined,
		pickup_available: payload.pickup_available !== undefined ? Boolean(payload.pickup_available) : undefined,
		farmer_delivery_available: payload.farmer_delivery_available !== undefined ? Boolean(payload.farmer_delivery_available) : undefined,
		delivery_radius_km: payload.delivery_radius_km !== undefined ? parseInt(payload.delivery_radius_km, 10) : undefined,
	};
};

const createProduct = async ({ user, payload }) => {
	const role = normalizeRole(user && user.role);
	let farmer_id;

	if (role === "field_agent") {
		if (!payload.name) {
			throw createServiceError("name is required", 400);
		}
		farmer_id = await validateFarmerId(payload.farmer_id);
		const agentId = Number(user && user.user_id ? user.user_id : user && user.id);
		const isAssigned = await isAgentAssignedToFarmer(agentId, farmer_id);
		if (!isAssigned) {
			throw createServiceError("Field agent is not assigned to this farmer", 403);
		}
	} else if (role === "farmer") {
		if (!payload.name) {
			throw createServiceError("name is required", 400);
		}
		farmer_id = await validateFarmerId(user.id);
	} else {
		throw createServiceError("Only farmers and field agents can create products", 403);
	}

	const isDraft = payload.status === 'draft' || payload.is_draft === true;
	const productValues = buildProductValues(payload);

	let status = 'draft';
	let moderation_status = 'pending';
	let moderation_reason = null;
	let moderation_risk_score = 0.0;
	let is_published = false;
	let evaluation = null;

	if (isDraft) {
		status = 'draft';
		moderation_status = 'pending';
		is_published = false;
	} else {
		// Complete listing validation for immediate publishing/submission
		const missingFields = getMissingRequiredFields(payload, ["name", "price", "stock"]);
		if (missingFields.length > 0) {
			throw createServiceError("name, price, and stock are required to publish a product", 400);
		}
		if (!isNonNegativeNumber(productValues.price) || Number(productValues.price) <= 0) {
			throw createServiceError("price must be a valid number greater than 0", 400);
		}
		if (!Number.isInteger(productValues.stock) || productValues.stock <= 0) {
			throw createServiceError("stock must be a positive integer", 400);
		}

		if (productValues.discount_price !== null && productValues.discount_price !== undefined) {
			if (!isNonNegativeNumber(productValues.discount_price) || Number(productValues.discount_price) <= 0) {
				throw createServiceError("discount_price must be greater than 0", 400);
			}
			if (Number(productValues.discount_price) >= Number(productValues.price)) {
				throw createServiceError("discount_price must be less than price", 400);
			}
		}

		// Evaluate with Moderation Engine
		evaluation = await moderationEngine.evaluateListing({
			...productValues,
			category_id: payload.category_id,
		}, farmer_id);

		status = evaluation.status;
		moderation_status = evaluation.moderation_status;
		moderation_reason = evaluation.reason || null;
		moderation_risk_score = evaluation.risk_score || 0.0;
		is_published = evaluation.is_published;
	}

	const category_id = payload.category_id ? await validateCategoryId(payload.category_id) : null;

	const product = await productModel.createProduct({
		farmer_id,
		category_id,
		name: productValues.name,
		description: productValues.description || null,
		price: productValues.price || 0,
		discount_price: productValues.discount_price || null,
		stock: productValues.stock || 0,
		farm_location: productValues.farm_location || null,
		image_url: productValues.image_url || null,
		image_hash: evaluation?.image_hash || payload.image_hash || null,
		status,
		moderation_status,
		moderation_reason,
		moderation_risk_score,
		is_published,
		harvest_date: productValues.harvest_date || null,
		unit: productValues.unit || 'kg',
		min_order_quantity: productValues.min_order_quantity !== undefined ? productValues.min_order_quantity : 1.0,
		pickup_available: productValues.pickup_available !== undefined ? productValues.pickup_available : true,
		farmer_delivery_available: productValues.farmer_delivery_available !== undefined ? productValues.farmer_delivery_available : false,
		delivery_radius_km: productValues.delivery_radius_km !== undefined ? productValues.delivery_radius_km : 0,
	});

	if (productValues.stock && Number(productValues.stock) > 0) {
		try {
			await inventoryModel.upsertInventory({
				product_id: product.id,
				farmer_id,
				quantity: productValues.stock,
			});
		} catch (invErr) {
			logger.warn("Initial inventory upsert skipped:", invErr.message);
		}
	}

	// Record any automated intelligence risk flags in risk_flags table
	if (evaluation && evaluation.flags && evaluation.flags.length > 0) {
		for (const flag of evaluation.flags) {
			if (flag === "IMAGE_DUPLICATE") {
				try {
					await riskAdminModel.createRiskFlag({
						entity_type: "product",
						entity_id: product.id,
						flag_type: "duplicate_image",
						severity: "medium",
						flag_reason: `Perceptual image hash matches existing product listing`,
						evidence: {
							image_hash: product.image_hash,
						},
						confidence_score: 95.0,
					});
				} catch (rfErr) {
					logger.warn("Failed to create duplicate_image risk flag", { message: rfErr.message });
				}
			}

			if (flag === "PRICE_OUTLIER") {
				try {
					await riskAdminModel.createRiskFlag({
						entity_type: "product",
						entity_id: product.id,
						flag_type: "price_outlier",
						severity: "high",
						flag_reason: `Price of ETB ${product.price} deviates from regional price corridor benchmarks`,
						evidence: {
							price: product.price,
							moderation_risk_score: product.moderation_risk_score,
						},
						confidence_score: 90.0,
					});
				} catch (rfErr) {
					logger.warn("Failed to create price_outlier risk flag", { message: rfErr.message });
				}
			}
		}
	}

	logger.info("Product created", {
		productId: product.id,
		farmerId: farmer_id,
		status: product.status,
		moderation_status: product.moderation_status,
		is_published: product.is_published,
	});

	const createdProduct = await productModel.findProductById(product.id, { includeUnpublished: true });
	return createdProduct || product;
};

const submitProductForModeration = async ({ user, productId }) => {
	if (!isPositiveInteger(productId)) {
		throw createServiceError("Invalid product id", 400);
	}

	const ownedProduct = await getProductOwnership(Number(productId));
	if (!ownedProduct) {
		throw createServiceError("Product not found", 404);
	}

	const isAllowed = await canManageProduct(user, ownedProduct);
	if (!isAllowed) {
		throw createServiceError("Not authorized to submit this product", 403);
	}

	// Validate completeness before submission
	if (!ownedProduct.name || ownedProduct.name.trim().length < 3) {
		throw createServiceError("Product name must be at least 3 characters", 400);
	}
	if (!ownedProduct.price || Number(ownedProduct.price) <= 0) {
		throw createServiceError("Product price must be greater than 0", 400);
	}
	if (ownedProduct.stock === undefined || ownedProduct.stock === null || Number(ownedProduct.stock) < 0) {
		throw createServiceError("Product stock cannot be negative", 400);
	}

	// Run hybrid moderation evaluation
	const evaluation = await moderationEngine.evaluateListing(ownedProduct, ownedProduct.farmer_id);

	await productModel.updateProductById(Number(productId), {
		status: evaluation.status,
		moderation_status: evaluation.moderation_status,
		moderation_reason: evaluation.reason || null,
		moderation_risk_score: evaluation.risk_score || 0.0,
		is_published: evaluation.is_published,
	});

	logger.info("Product submitted for moderation", {
		productId,
		farmerId: ownedProduct.farmer_id,
		decision: evaluation.decision,
		status: evaluation.status,
		moderation_status: evaluation.moderation_status,
		is_published: evaluation.is_published,
	});

	const fullProduct = await productModel.findProductById(Number(productId), { includeUnpublished: true });

	return {
		product: fullProduct,
		evaluation,
	};
};

const updateProduct = async ({ user, productId, payload }) => {
	if (!isPositiveInteger(productId)) {
		throw createServiceError("Invalid product id", 400);
	}

	const ownedProduct = await getProductOwnership(Number(productId));
	if (!ownedProduct) {
		throw createServiceError("Product not found", 404);
	}

	const isAllowed = await canManageProduct(user, ownedProduct);
	if (!isAllowed) {
		throw createServiceError("Not authorized to update this product", 403);
	}

	const hasUpdateField = [
		"name",
		"description",
		"price",
		"discount_price",
		"stock",
		"category_id",
		"farm_location",
		"image_url",
		"harvest_date",
		"unit",
		"min_order_quantity",
		"pickup_available",
		"farmer_delivery_available",
		"delivery_radius_km",
		"status",
	].some((field) => payload[field] !== undefined);

	if (!hasUpdateField) {
		throw createServiceError("At least one field is required for update", 400);
	}

	const productValues = buildProductValues(payload);

	if (
		productValues.price !== undefined &&
		(!isNonNegativeNumber(productValues.price) || Number(productValues.price) <= 0)
	) {
		throw createServiceError("price must be a valid number greater than 0", 400);
	}

	if (
		productValues.stock !== undefined &&
		(!Number.isInteger(productValues.stock) || productValues.stock < 0)
	) {
		throw createServiceError("stock must be a non-negative integer", 400);
	}

	if (productValues.discount_price !== null && productValues.discount_price !== undefined) {
		if (!isNonNegativeNumber(productValues.discount_price) || Number(productValues.discount_price) <= 0) {
			throw createServiceError("discount_price must be greater than 0", 400);
		}
		const finalPrice = productValues.price !== undefined ? Number(productValues.price) : Number(ownedProduct.price);
		if (Number(productValues.discount_price) >= finalPrice) {
			throw createServiceError("discount_price must be less than price", 400);
		}
	}

	const category_id =
		payload.category_id === undefined ? undefined : await validateCategoryId(payload.category_id);

	// Live Product Edit Protection:
	// If the product is currently active & published, significant revisions must be queued for moderation
	// while keeping original live listing active in the marketplace.
	const isLiveProduct = ownedProduct.status === 'active' && ownedProduct.is_published === true && ownedProduct.moderation_status === 'approved';

	if (isLiveProduct) {
		let priceDiffersSignificantly = false;
		if (productValues.price !== undefined && productValues.price !== null) {
			const oldPrice = Number(ownedProduct.price);
			const newPrice = Number(productValues.price);
			if (oldPrice > 0 && Math.abs(newPrice - oldPrice) / oldPrice > 0.10) {
				priceDiffersSignificantly = true;
			}
		}

		const nameChanged = productValues.name !== undefined && productValues.name !== ownedProduct.name;
		const descChanged = productValues.description !== undefined && productValues.description !== (ownedProduct.description || null);
		const imageChanged = productValues.image_url !== undefined && productValues.image_url !== (ownedProduct.image_url || null);
		const catChanged = category_id !== undefined && category_id !== ownedProduct.category_id;

		const isSignificantRevision = priceDiffersSignificantly || nameChanged || descChanged || imageChanged || catChanged;

		if (isSignificantRevision) {
			const revisionData = {
				name: productValues.name !== undefined ? productValues.name : ownedProduct.name,
				price: productValues.price !== undefined ? productValues.price : ownedProduct.price,
				discount_price: productValues.discount_price !== undefined ? productValues.discount_price : ownedProduct.discount_price,
				description: productValues.description !== undefined ? productValues.description : ownedProduct.description,
				category_id: category_id !== undefined ? category_id : ownedProduct.category_id,
				farm_location: productValues.farm_location !== undefined ? productValues.farm_location : ownedProduct.farm_location,
				image_url: productValues.image_url !== undefined ? productValues.image_url : ownedProduct.image_url,
				previous_values: {
					name: ownedProduct.name,
					price: ownedProduct.price,
					description: ownedProduct.description,
					image_url: ownedProduct.image_url,
				},
			};

			const revision = await productModel.createProductRevision({
				productId: Number(productId),
				farmerId: ownedProduct.farmer_id,
				revisionData,
			});

			if (productValues.stock !== undefined && productValues.stock !== null) {
				await productModel.updateProductById(Number(productId), {
					stock: productValues.stock,
				});
				await inventoryModel.upsertInventory({
					product_id: Number(productId),
					farmer_id: Number(ownedProduct.farmer_id),
					quantity: productValues.stock,
				});
			}

			logger.info("Product revision created for live listing", {
				productId,
				farmerId: ownedProduct.farmer_id,
				revisionId: revision.id,
			});

			const liveProduct = await productModel.findProductById(Number(productId), { includeUnpublished: true });

			return {
				...liveProduct,
				is_revision_pending: true,
				pending_revision_id: revision.id,
				message: "Significant changes submitted for administrator moderation. Your live product listing remains active and unchanged on the marketplace until reviewed.",
			};
		}
	}

	const updatedProduct = await productModel.updateProductById(Number(productId), {
		name: productValues.name !== undefined ? productValues.name : null,
		description: productValues.description !== undefined ? productValues.description : null,
		price: productValues.price !== undefined ? productValues.price : null,
		discount_price: productValues.discount_price === null ? -1 : (productValues.discount_price !== undefined ? productValues.discount_price : null),
		stock: productValues.stock !== undefined ? productValues.stock : null,
		category_id: category_id !== undefined ? category_id : null,
		farm_location:
			productValues.farm_location !== undefined ? productValues.farm_location : null,
		image_url: productValues.image_url !== undefined ? productValues.image_url : null,
		harvest_date: productValues.harvest_date !== undefined ? productValues.harvest_date : null,
		unit: productValues.unit !== undefined ? productValues.unit : null,
		min_order_quantity: productValues.min_order_quantity !== undefined ? productValues.min_order_quantity : null,
		pickup_available: productValues.pickup_available !== undefined ? productValues.pickup_available : null,
		farmer_delivery_available: productValues.farmer_delivery_available !== undefined ? productValues.farmer_delivery_available : null,
		delivery_radius_km: productValues.delivery_radius_km !== undefined ? productValues.delivery_radius_km : null,
	});

	if (productValues.stock !== undefined && productValues.stock !== null) {
		await inventoryModel.upsertInventory({
			product_id: Number(productId),
			farmer_id: Number(ownedProduct.farmer_id),
			quantity: productValues.stock,
		});
	}

	return productModel.findProductById(updatedProduct.id, { includeUnpublished: true });
};

const getProductRevisions = async ({ user, productId }) => {
	if (!isPositiveInteger(productId)) {
		throw createServiceError("Invalid product id", 400);
	}
	const ownedProduct = await getProductOwnership(Number(productId));
	if (!ownedProduct) {
		throw createServiceError("Product not found", 404);
	}

	const role = normalizeRole(user && user.role);
	if (role !== "admin" && role !== "super_admin") {
		const isAllowed = await canManageProduct(user, ownedProduct);
		if (!isAllowed) {
			throw createServiceError("Not authorized to view revisions for this product", 403);
		}
	}

	return productModel.getProductRevisions(Number(productId));
};

const reviewProductRevision = async ({ user, revisionId, decision, feedback }) => {
	if (!isPositiveInteger(revisionId)) {
		throw createServiceError("Invalid revision id", 400);
	}
	if (!["approve", "reject"].includes(decision)) {
		throw createServiceError("Decision must be either 'approve' or 'reject'", 400);
	}

	const reviewerId = user && user.id ? user.id : null;
	const result = await productModel.reviewProductRevision({
		revisionId: Number(revisionId),
		decision,
		feedback: feedback || null,
		reviewerId,
	});

	logger.info("Product revision reviewed", {
		revisionId,
		reviewerId,
		decision,
	});

	return result;
};

const deleteProduct = async ({ user, productId }) => {
	if (!isPositiveInteger(productId)) {
		throw createServiceError("Invalid product id", 400);
	}

	const ownedProduct = await getProductOwnership(Number(productId));

	if (!ownedProduct) {
		throw createServiceError("Product not found", 404);
	}

	const isAllowed = await canManageProduct(user, ownedProduct);

	if (!isAllowed) {
		throw createServiceError("Not authorized to delete this product", 403);
	}

	await productModel.deleteProductById(Number(productId));
	return { deleted: true };
};

const getAllProducts = async ({ page, limit, farmer_id, category_id, search, sort } = {}) => {
	const parsedPage = Math.max(1, parseInt(page, 10) || 1);
	const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
	const offset = (parsedPage - 1) * parsedLimit;

	const result = await productModel.findAllProducts({ limit: parsedLimit, offset, farmer_id, category_id, search, sort });

	const total = result.total;
	const total_pages = Math.ceil(total / parsedLimit);

	return {
		products: result.rows,
		pagination: {
			page: parsedPage,
			limit: parsedLimit,
			total,
			total_pages,
		},
	};
};

const getProductById = async (productId, { user } = {}) => {
	if (!isPositiveInteger(productId)) {
		throw createServiceError("Invalid product id", 400);
	}

	let includeUnpublished = false;
	if (user) {
		const role = normalizeRole(user.role);
		if (role === "admin" || role === "super_admin") {
			includeUnpublished = true;
		} else {
			const owned = await productModel.findProductOwnershipById(Number(productId));
			if (owned && (Number(owned.farmer_id) === Number(user.id) || role === "field_agent")) {
				includeUnpublished = true;
			}
		}
	}

	const product = await productModel.findProductById(Number(productId), { includeUnpublished });

	if (!product) {
		throw createServiceError("Product not found", 404);
	}

	return product;
};

const updateProductStock = async ({ user, productId, stock }) => {
	if (!isPositiveInteger(productId)) {
		throw createServiceError("Invalid product id", 400);
	}

	const parsedStock = Number(stock);

	if (!Number.isInteger(parsedStock) || parsedStock <= 0) {
		throw createServiceError("stock must be a positive integer", 400);
	}

	const ownedProduct = await getProductOwnership(Number(productId));

	if (!ownedProduct) {
		throw createServiceError("Product not found", 404);
	}

	const isAllowed = await canManageProduct(user, ownedProduct);

	if (!isAllowed) {
		throw createServiceError("You can only update stock for your own products", 403);
	}

	await inventoryModel.upsertInventory({
		product_id: Number(productId),
		farmer_id: Number(ownedProduct.farmer_id),
		quantity: parsedStock,
	});

	return productModel.findProductById(Number(productId));
};

module.exports = {
	createProduct,
	deleteProduct,
	getAllProducts,
	getProductById,
	getProductRevisions,
	reviewProductRevision,
	submitProductForModeration,
	updateProduct,
	updateProductStock,
};
