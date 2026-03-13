const productService = require("../services/productService");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/apiError");

// Récupérer tous les produits (GET /)
exports.getProducts = catchAsync(async (req, res) => {
  const filters = {
    merchant_id: req.query.merchant_id,
    store_id: req.query.store_id,
    category_id: req.query.category_id,
    min_price: req.query.min_price,
    max_price: req.query.max_price,
    colors: req.query.colors,
    weight: req.query.weight,
    status: req.query.status,
  };

  // On appelle la méthode du service (renommée en getAllProducts ou listProducts selon ton choix précédent)
  const result = await productService.getAllProducts(filters, {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
  });

  res.status(200).json({
    success: true,
    count: result.products.length,
    data: result.products,
    pagination: result.pagination,
  });
});

// Récupérer un produit par ID (GET /:id)
exports.getProduct = catchAsync(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");
  res.status(200).json({ success: true, data: product });
});

// In productController.js - createProduct method
exports.createProduct = catchAsync(async (req, res) => {
    console.log("BODY REÇU PAR MULTER:", req.body);
    console.log("USER:", req.user); // Debug log

    // Handle case where req.user might be undefined or missing properties
    const merchant_id = req.user?.id || req.user?.merchant_id || req.body.merchant_id;
    const store_id = req.user?.store_id || req.body.store_id || req.user?.id; // Fallback logic

    if (!merchant_id) {
        throw new ApiError(400, "merchant_id is required (from token or body)");
    }
    if (!store_id) {
        throw new ApiError(400, "store_id is required (from token or body)");
    }

    const productData = {
        name: req.body.name,
        price: parseFloat(req.body.price) || 0,
        description: req.body.description,
        category_id: req.body.category_id,
        category_name: req.body.category_name,
        quantity: parseInt(req.body.quantity) || 0,
        status: req.body.status || 'active',
        merchant_id: merchant_id,
        store_id: store_id,
        slug: req.body.name ? req.body.name.toLowerCase().replace(/ /g, '-') : null
    };

    if (!productData.name || !productData.category_id) {
        throw new ApiError(400, "Les champs 'name' et 'category_id' sont obligatoires.");
    }

    const product = await productService.createProduct(productData, req.files);

    res.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        data: product
    });
});

exports.updateProduct = catchAsync(async (req, res) => {
  const product = await productService.updateProduct(
    req.params.id,
    req.body,
    req.files,
  );
  res
    .status(200)
    .json({
      success: true,
      data: product,
      message: "Product updated successfully",
    });
});

exports.deleteProduct = catchAsync(async (req, res) => {
  const productId = req.params.id;

  // On récupère l'ID du marchand depuis le token JWT (req.user est rempli par ton middleware d'auth)
  const merchantId = req.user ? req.user.id : null;

  const result = await productService.deleteProduct(productId, merchantId);

  res.status(200).json({
    success: true,
    data: result,
  });
});
exports.getLimits = catchAsync(async (req, res) => {
  const limits = await productService.checkProductLimit(req.user.merchant_id);
  res.status(200).json({ success: true, data: limits });
});

exports.uploadImages = catchAsync(async (req, res) => {
  const updatedProduct = await productService.updateProduct(
    req.params.id,
    {},
    req.files,
  );
  res.status(200).json({ success: true, data: updatedProduct });
});

exports.renewPayment = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, message: "Payment renewed" });
});

exports.whatsappWebhook = catchAsync(async (req, res) => {
  res.status(200).send("EVENT_RECEIVED");
});
