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
   if (req.query.brand) { where.brand = req.query.brand; }

  // NEW: Tags filter (MySQL JSON search)
  if (req.query.tag) {
    where.tags = {
      [Op.contains]: [req.query.tag]  // For MySQL 5.7+ or PostgreSQL
    };
  }

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

async function generateUniqueSlug(name, Product) {
  // Clean the base name
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check if any slugs exist with this base name
  const existingProducts = await Product.findAll({
    where: {
      slug: {
        [Op.or]: [
          { [Op.eq]: baseSlug },           // Exact match "television"
          { [Op.like]: `${baseSlug}-%` }   // Matches "television-1", "television-2", etc.
        ]
      }
    },
    attributes: ['slug'],
    raw: true
  });

  // No existing products - use base slug
  if (existingProducts.length === 0) {
    return baseSlug;
  }

  // Extract numbers from existing slugs (e.g., "television-5" → 5)
  const numbers = existingProducts
    .map(p => {
      const match = p.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
      return match ? parseInt(match[1]) : 0;
    })
    .filter(n => n > 0);

  // Determine next number
  // If we have numbered slugs, increment the highest
  // If only base slug exists, start with 1
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  
  return `${baseSlug}-${nextNumber}`;
}

// Alternative: Always include number (television-1, television-2, etc.)
async function generateUniqueSlugWithNumber(name, Product) {
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Find all slugs starting with base slug
  const existingProducts = await Product.findAll({
    where: {
      slug: {
        [Op.like]: `${baseSlug}%`
      }
    },
    attributes: ['slug'],
    raw: true
  });

  // Extract all numbers
  const numbers = existingProducts
    .map(p => {
      const match = p.slug.match(new RegExp(`^${baseSlug}-?(\\d*)$`));
      if (!match) return 0;
      return match[1] ? parseInt(match[1]) : 0;
    });

  // Find max number and add 1
  const maxNumber = Math.max(...numbers, 0);
  return `${baseSlug}-${maxNumber + 1}`;
}

// In productController.js - createProduct method
/**
 * Create product with external validations
 * POST /
 */
exports.createProduct = catchAsync(async (req, res) => {
  console.log('=== CREATE PRODUCT DEBUG ===');
  console.log('Request body:', req.body);

  const { 
    store_id, 
    name, 
    price, 
    description, 
    category_id, 
    category_name,
    brand,        
    tags,         
    quantity, 
    status, 
    images 
  } = req.body;

  // Extract merchant_id from body or authenticated user
  const merchant_id = req.body.merchant_id || req.user?.merchant_id;

  console.log('Extracted merchant_id:', merchant_id);
  console.log('Extracted store_id:', store_id);
  console.log('Extracted brand:', brand);
  console.log('Extracted tags:', tags);

  // Validation: Required fields
  if (!merchant_id || !store_id) {
    throw new ApiError(400, 'merchant_id and store_id are required');
  }

  if (!name) {
    throw new ApiError(400, "Field 'name' is required");
  }

  // Handle category - support both category_id and category_name
  let finalCategoryId = category_id;
  let categoryData = null;

  // If category_id is invalid/empty but category_name is provided
  if ((!finalCategoryId || finalCategoryId === 'string' || !isValidUUID(finalCategoryId)) && category_name) {
    // Try to find existing category by name
    let category = await Category.findOne({ 
      where: { name: category_name } 
    });
    
    if (!category) {
      // Create new category if not exists
      const { v4: uuidv4 } = require('uuid');
      category = await Category.create({
        id: uuidv4(),
        name: category_name,
        slug: category_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        status: 'active'
      });
      console.log('✅ Created new category:', category.id, category.name);
    } else {
      console.log('✅ Found existing category:', category.id, category.name);
    }
    
    finalCategoryId = category.id;
    categoryData = category;
  } else if (finalCategoryId) {
    // Validate the provided category_id exists
    const existingCategory = await Category.findByPk(finalCategoryId);
    if (!existingCategory) {
      throw new ApiError(400, 'Invalid or non-existent category_id');
    }
    categoryData = existingCategory;
  }

  if (!finalCategoryId) {
    throw new ApiError(400, 'category_id or category_name is required');
  }

  // Process tags - handle both string and array formats
  let processedTags = [];
  if (tags) {
    if (typeof tags === 'string') {
      // If sent as comma-separated string: "electronics, tv, samsung"
      processedTags = tags.split(',').map(t => t.trim()).filter(t => t);
    } else if (Array.isArray(tags)) {
      processedTags = tags.map(t => String(t).trim()).filter(t => t);
    }
  }

  // Verify store exists via STORE-SERVICE
  try {
    await serviceClient.getStore(store_id, req.headers.authorization);
  } catch (err) {
    console.error('❌ Store validation failed:', err.message);
    throw new ApiError(400, 'Invalid or non-existent store');
  }

  const slug = await generateUniqueSlug(name, Product);

  // Prepare product data with new fields
  const productData = {
    name: name.trim(),
    price: parseFloat(price) || 0,
    description: description?.trim(),
    category_id: finalCategoryId,
    brand: brand?.trim() || null,
    tags: processedTags.length > 0 ? processedTags : null,
    store_id,
    merchant_id,
    quantity: parseInt(quantity) || 0,
    status: status || 'active',
    slug: slug,
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

  // Build response with category data
  const responseData = product.toJSON();
  responseData.category = categoryData ? {
    id: categoryData.id,
    name: categoryData.name,
    slug: categoryData.slug,
    status: categoryData.status
  } : null;

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: responseData
  });
});

// Helper function to validate UUID format
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to validate UUID format
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

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
  const { id } = req.params;
  const updateData = { ...req.body };

  console.log('=== UPDATE PRODUCT DEBUG ===');
  console.log('Product ID:', id);

  // Process tags
  if (updateData.tags !== undefined) {
    if (typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(t => t.trim()).filter(t => t);
    } else if (Array.isArray(updateData.tags)) {
      updateData.tags = updateData.tags.map(t => String(t).trim()).filter(t => t);
    }
    if (updateData.tags.length === 0) updateData.tags = null;
  }

  // Clean brand
  if (updateData.brand !== undefined) {
    updateData.brand = updateData.brand?.trim() || null;
  }

  // If name is being updated, regenerate slug with sequential number
  if (updateData.name) {
    updateData.name = updateData.name.trim();
    // Optional: Generate new slug if name changes
    // updateData.slug = await generateSequentialSlug(updateData.name, Product);
  }

  // Clean other fields
  if (updateData.description) updateData.description = updateData.description.trim();

  const product = await productService.updateProduct(id, updateData, req.files);

  console.log('✅ Product updated:', product.id);

  res.status(200).json({
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

exports.getProductsByStore = catchAsync(async (req, res) => {
  const { storeId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: products } = await Product.findAndCountAll({
    where: { 
      store_id: storeId,
      // Optional: add merchant check for security
      // merchant_id: req.user.merchant_id 
    },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images' }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['created_at', 'DESC']]
  });

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      total_pages: Math.ceil(count / parseInt(limit))
    }
  });
});

exports.renewPayment = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, message: "Payment renewed" });
});

exports.whatsappWebhook = catchAsync(async (req, res) => {
  res.status(200).send("EVENT_RECEIVED");
});
