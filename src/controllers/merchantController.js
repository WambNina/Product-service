const merchantService = require('../services/merchantService');
const catchAsync = require('../utils/catchAsync');

exports.getMerchantProducts = catchAsync(async (req, res) => {
  const { merchantId } = req.params;
  const { page = 1, limit = 20, status } = req.query;
  
  const result = await merchantService.getProductsByMerchant(merchantId, {
    page: parseInt(page),
    limit: parseInt(limit),
    status
  });

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
});

exports.createMerchantProduct = catchAsync(async (req, res) => {
  const { merchantId } = req.params;
  
  // Vérifier que l'utilisateur connecté est bien le marchand (ou admin)
  if (req.user.merchant_id && req.user.merchant_id !== merchantId) {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé à ce marchand'
    });
  }

  const product = await merchantService.createProductForMerchant(merchantId, req.body);
  
  res.status(201).json({
    success: true,
    message: 'Produit créé avec succès',
    data: product
  });
});

exports.getStoreProducts = catchAsync(async (req, res) => {
  const { storeId } = req.params;
  const { page = 1, limit = 20, category, in_stock } = req.query;
  
  const result = await merchantService.getProductsByStore(storeId, {
    page: parseInt(page),
    limit: parseInt(limit),
    category,
    in_stock: in_stock === 'true'
  });

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
});