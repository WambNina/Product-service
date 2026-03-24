const variantService = require('../services/variantService');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

exports.getProductVariants = catchAsync(async (req, res) => {
  const { id } = req.params;
  const variants = await variantService.getVariantsByProductId(id);
  
  res.status(200).json({
    success: true,
    data: variants
  });
});

exports.createVariant = catchAsync(async (req, res) => {
  const { id } = req.params;
  const variant = await variantService.createVariant(id, req.body);
  
  res.status(201).json({
    success: true,
    message: 'Variante créée avec succès',
    data: variant
  });
});

/**
 * Create multiple variants with image upload
 * POST /api/v1/products/:id/variants/batch
 */
exports.createBatchVariants = catchAsync(async (req, res) => {
  const productId = req.params.id;
  
  console.log('🔥 Batch variant creation started');
  console.log('Product ID:', productId);
  console.log('File:', req.file);
  console.log('Body:', req.body);

  // Handle arrays from form-data (multer parses them as strings if single value)
  let colors = req.body.colors || [];
  let sizes = req.body.sizes || [];
  
  // Convert to arrays if single values
  if (!Array.isArray(colors)) colors = [colors];
  if (!Array.isArray(sizes)) sizes = [sizes];

  // Filter out empty values
  colors = colors.filter(c => c && c.trim() !== '');
  sizes = sizes.filter(s => s && s.trim() !== '');

  // Validation
  if (!req.file) {
    throw new ApiError('Image is required', 400);
  }

  if (colors.length === 0 || sizes.length === 0) {
    // Clean up uploaded file
    if (req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    throw new ApiError('At least one color and one size must be selected', 400);
  }

  // Parse values
  const weight = parseFloat(req.body.weight) || 0;
  const price = parseFloat(req.body.price) || 0;
  const isDefault = req.body.is_default === 'true' || req.body.is_default === true;

  // Check if product exists
  const product = await variantService.getProductById(productId);
  if (!product) {
    // Clean up uploaded file
    if (req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    throw new ApiError('Product not found', 404);
  }

  const imageUrl = `/uploads/products/${req.file.filename}`;

  // Create variants using service
  const result = await variantService.createBatchVariants({
    productId,
    colors,
    sizes,
    weight,
    price,
    isDefault,
    imageUrl: imageUrl,
    filename: req.file.filename,
    file: req.file // 👈 important
  });

  res.status(201).json({
    success: true,
    message: `Image uploaded and ${result.variantsCreated} variants created successfully`,
    data: {
      product_id: productId,
      image_url: imageUrl,
      filename: req.file.filename,
      variants_created: result.variantsCreated,
      variants: result.variants
    }
  });
});

exports.updateVariant = catchAsync(async (req, res) => {
  const { variantId } = req.params;
  const variant = await variantService.updateVariant(variantId, req.body);
  
  res.status(200).json({
    success: true,
    message: 'Variante mise à jour avec succès',
    data: variant
  });
});

exports.deleteVariant = catchAsync(async (req, res) => {
  const { variantId } = req.params;
  await variantService.deleteVariant(variantId);
  
  res.status(200).json({
    success: true,
    message: 'Variante supprimée avec succès'
  });
});