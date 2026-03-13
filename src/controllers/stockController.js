const stockService = require('../services/stockService');
const catchAsync = require('../utils/catchAsync');

class StockController {
  /**
   * GET /api/v1/products/:id/stock
   */
  getStock = catchAsync(async (req, res) => {
    const { id } = req.params;
    const stock = await stockService.getStock(id);

    res.status(200).json({
      success: true,
      data: stock
    });
  });

  /**
   * PUT /api/v1/products/:id/stock
   */
  updateStock = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { quantity, variantId, reason } = req.body;
    const userId = req.user?.id || req.user?.merchant_id || null;

    const result = await stockService.updateStock(id, {
      quantity: parseInt(quantity),
      variantId: variantId || null,
      reason: reason || 'Manual adjustment'
    }, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * POST /api/v1/products/:id/stock/increase
   */
  increaseStock = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { quantity, variantId, reason, referenceId } = req.body;
    const userId = req.user?.id || req.user?.merchant_id || null;

    const result = await stockService.increaseStock(id, {
      quantity: parseInt(quantity),
      variantId: variantId || null,
      reason: reason || 'Stock addition',
      referenceId: referenceId || null
    }, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * POST /api/v1/products/:id/stock/decrease
   */
  decreaseStock = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { quantity, variantId, reason, referenceId, allowNegative } = req.body;
    const userId = req.user?.id || req.user?.merchant_id || null;

    const result = await stockService.decreaseStock(id, {
      quantity: parseInt(quantity),
      variantId: variantId || null,
      reason: reason || 'Stock removal',
      referenceId: referenceId || null,
      allowNegative: allowNegative || false
    }, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * GET /api/v1/products/:id/stock/history (Optional)
   */
  getStockHistory = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { variantId, limit, offset } = req.query;

    const history = await stockService.getStockHistory(id, {
      variantId: variantId || null,
      limit: limit || 50,
      offset: offset || 0
    });

    res.status(200).json({
      success: true,
      data: history
    });
  });
}

module.exports = new StockController();