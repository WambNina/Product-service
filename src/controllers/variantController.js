const variantService = require('../services/variantService');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');

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