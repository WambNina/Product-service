const productService = require("../services/productService");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/apiError");
const { Op } = require('sequelize');
const { Product, Category, ProductImage, ProductVariant } = require('../models');
const mediaService = require("../services/mediaService");
const storeService = require("../services/storeService");
const serviceClient = require('../utils/serviceClient');

// Récupérer tous les produits (GET /)
exports.getProducts = catchAsync(async (req, res) => {
  // Build filters
  const where = {};
  if (req.query.merchant_id) where.merchant_id = req.query.merchant_id;
  if (req.query.store_id) where.store_id = req.query.store_id;
  if (req.query.category_id) where.category_id = req.query.category_id;
  if (req.query.status) where.status = req.query.status;
  
  // Price range filter
  if (req.query.min_price || req.query.max_price) {
    where.price = {};
    if (req.query.min_price) where.price[Op.gte] = req.query.min_price;
    if (req.query.max_price) where.price[Op.lte] = req.query.max_price;
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  // Fetch with Category included
  const { count, rows: products } = await Product.findAndCountAll({
    where,
    include: [
      {
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug', 'description', 'status']
      },
      {
        model: ProductImage,
        as: 'images',
         attributes: ['id', 'filename', 'original_filename', 'url']
      },
      {
        model: ProductVariant,
        as: 'variants'
      }
    ],
    limit,
    offset: (page - 1) * limit,
    order: [['created_at', 'DESC']]
  });

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit)
    }
  });
});

// Récupérer un produit par ID (GET /:id) - Single product
exports.getProduct = catchAsync(async (req, res) => {
  const product = await Product.findByPk(req.params.id, {
    include: [
      {
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug', 'description', 'status']
      },
      {
        model: ProductImage,
        as: 'images',
         attributes: ['id', 'filename', 'original_filename', 'url']
      },
      {
        model: ProductVariant,
        as: 'variants'
      }
    ]
  });

  if (!product) throw new ApiError(404, "Product not found");

  res.status(200).json({
    success: true,
    data: product
  });
});

function generateUniqueSlug(name) {
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${baseSlug}-${Date.now()}`;
}
// In productController.js - createProduct method
/**
 * Create product with external validations
 * POST /
 */
exports.createProduct = catchAsync(async (req, res) => {
  console.log('=== CREATE PRODUCT DEBUG ===');
  console.log('Request body:', req.body);

  const { store_id, name, price, description, category_id, quantity, status, images } = req.body;

  // Extract merchant_id from body or authenticated user
  const merchant_id = req.body.merchant_id || req.user?.merchant_id;

  console.log('Extracted merchant_id:', merchant_id);
  console.log('Extracted store_id:', store_id);

  // Validation: Required fields
  if (!merchant_id || !store_id) {
    throw new ApiError(400, 'merchant_id and store_id are required');
  }

  if (!name || !category_id) {
    throw new ApiError(400, "Fields 'name' and 'category_id' are required");
  }

  // Verify store exists via STORE-SERVICE
  try {
    await serviceClient.getStore(store_id, req.headers.authorization);
  } catch (err) {
    console.error('❌ Store validation failed:', err.message);
    throw new ApiError(400, 'Invalid or non-existent store');
  }
  

  // Prepare product data
  const productData = {
    name: name.trim(),
    price: parseFloat(price) || 0,
    description: description?.trim(),
    category_id,
    store_id,
    merchant_id,
    quantity: parseInt(quantity) || 0,
    status: status || 'active',
    slug: generateUniqueSlug(name),
    visibility: req.body.visibility?.trim() || 'public'
  };

  console.log('Product data to create:', productData);

  // Create product using service layer
  const product = await productService.createProduct(productData);

  console.log('✅ Product created:', product.id);

  // Handle image uploads to MEDIA-SERVICE
  if (images && images.length > 0) {
    const uploadedImages = [];
    const failedImages = [];

    for (const [index, image] of images.entries()) {
      try {
        const mediaResult = await serviceClient.uploadMedia(image, {
          entity_type: 'product',
          entity_id: product.id,
          merchant_id,
          store_id
        });
        uploadedImages.push(mediaResult);
        console.log(`✅ Image ${index + 1} uploaded:`, mediaResult.id || mediaResult.media_id);
      } catch (mediaError) {
        console.error(`❌ Failed to upload image ${index + 1}:`, mediaError.message);
        failedImages.push({ index, error: mediaError.message });
      }
    }

    // Attach upload results to response
    product.setDataValue('uploaded_images', uploadedImages);
    if (failedImages.length > 0) {
      product.setDataValue('failed_uploads', failedImages);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: product
  });
});

/**
 * Get product with details from external services
 * GET /:id/details
 */
exports.getProductWithDetails = catchAsync(async (req, res) => {
  const { productId } = req.params;

  // 1. Get local product
  const product = await Product.findByPk(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  // 2. Get store info from STORE-SERVICE
  let storeData = null;
  try {
    storeData = await serviceClient.getStore(
      product.store_id,
      req.headers.authorization
    );
  } catch (err) {
    console.warn('⚠️  Store service unavailable:', err.message);
  }

  // 3. Get images from MEDIA-SERVICE
  let mediaData = [];
  try {
    mediaData = await serviceClient.getMedia('product', productId);
  } catch (err) {
    console.warn('⚠️  Media service unavailable:', err.message);
  }

  // 4. Combine and return data
  res.status(200).json({
    success: true,
    data: {
      ...product.toJSON(),
      store: storeData,
      media: mediaData
    }
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

// Add new method to get product with images
exports.getProductWithImages = catchAsync(async (req, res) => {
    const product = await productService.getProductById(req.params.id);
    if (!product) throw new ApiError(404, "Product not found");
    
    // Fetch images from Media Service
    const images = await mediaService.getProductImages(
        product.id,
        product.store_id,
        product.merchant_id
    );
    
    product.images = images;

    res.status(200).json({ 
        success: true, 
        data: product 
    });
});

exports.renewPayment = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, message: "Payment renewed" });
});

exports.whatsappWebhook = catchAsync(async (req, res) => {
  res.status(200).send("EVENT_RECEIVED");
});
