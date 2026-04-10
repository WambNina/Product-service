const { Stock, StockMovement, Product, ProductVariant } = require('../models');
const ApiError = require('../utils/apiError');

class StockService {
  
  /**
   * Get stock for a product
   */
  async getStock(productId) {
    const stock = await Stock.findAll({
      where: { product_id: productId },
      include: [
        { model: Product, as: 'product' },
        { model: ProductVariant, as: 'variant' }
      ]
    });
    
    return stock;
  }

  /**
   * Update stock (manual adjustment)
   */
  async updateStock(productId, data, userId) {
    const { quantity, variantId, reason } = data;
    
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    const [stock, created] = await Stock.findOrCreate({
      where: {
        product_id: productId,
        variant_id: variantId || null
      },
      defaults: {
        quantity: 0,
        reserved_quantity: 0,
        alert_threshold: 10
      }
    });

    const previousQuantity = stock.quantity;
    
    await stock.update({
      quantity: quantity,
      last_movement_at: new Date()
    });

    // Log the movement - NO stock_id in your model!
    await StockMovement.create({
      product_id: productId,
      variant_id: variantId || null,
      movement_type: 'adjustment',
      quantity: quantity - previousQuantity,
      previous_stock: previousQuantity,
      new_stock: quantity,
      reason: reason,
      reference_id: null,
      created_by: userId,
      created_at: new Date()
    });

    return {
      message: 'Stock updated successfully',
      data: {
        stock_id: stock.id,
        product_id: productId,
        variant_id: variantId,
        quantity: quantity,
        previous_quantity: previousQuantity
      }
    };
  }

  /**
   * Increase stock
   */
  async increaseStock(productId, data, userId) {
    const { quantity, variantId, reason, referenceId } = data;
    
    // Verify product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    // Find or create stock record
    const [stock, created] = await Stock.findOrCreate({
      where: {
        product_id: productId,
        variant_id: variantId || null
      },
      defaults: {
        quantity: 0,
        reserved_quantity: 0,
        alert_threshold: 10
      }
    });

    // Get previous quantity before update
    const previousQuantity = stock.quantity;
    
    // Calculate new quantity
    const newQuantity = previousQuantity + quantity;

    // Update stock
    await stock.update({
      quantity: newQuantity,
      last_movement_at: new Date()
    });

    // Log movement - NO stock_id field in your model!
    await StockMovement.create({
      product_id: productId,
      variant_id: variantId || null,
      movement_type: 'increase',
      quantity: quantity,  // ✅ Your model uses 'quantity' not 'quantity_change'
      previous_stock: previousQuantity,  // ✅ Required
      new_stock: newQuantity,  // ✅ Required
      reason: reason,
      reference_id: referenceId || null,
      created_by: userId,
      created_at: new Date()
    });

    return {
      message: 'Stock increased successfully',
      data: {
        stock_id: stock.id,
        product_id: productId,
        variant_id: variantId,
        quantity: newQuantity,
        added: quantity,
        previous_quantity: previousQuantity
      }
    };
  }

  /**
   * Decrease stock
   */
  async decreaseStock(productId, data, userId) {
    const { quantity, variantId, reason, referenceId, allowNegative } = data;
    
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    const stock = await Stock.findOne({
      where: {
        product_id: productId,
        variant_id: variantId || null
      }
    });

    if (!stock) {
      throw new ApiError(404, 'Stock record not found');
    }

    const previousQuantity = stock.quantity;
    const newQuantity = previousQuantity - quantity;

    // Check if we have enough stock (unless allowNegative is true)
    if (newQuantity < 0 && !allowNegative) {
      throw new ApiError(400, 'Insufficient stock');
    }

    await stock.update({
      quantity: newQuantity,
      last_movement_at: new Date()
    });

    // Log movement - NO stock_id in your model!
    await StockMovement.create({
      product_id: productId,
      variant_id: variantId || null,
      movement_type: 'decrease',
      quantity: -quantity,
      previous_stock: previousQuantity,
      new_stock: newQuantity,
      reason: reason,
      reference_id: referenceId || null,
      created_by: userId,
      created_at: new Date()
    });

    return {
      message: 'Stock decreased successfully',
      data: {
        stock_id: stock.id,
        product_id: productId,
        variant_id: variantId,
        quantity: newQuantity,
        removed: quantity,
        previous_quantity: previousQuantity
      }
    };
  }

  /**
   * Get stock history
   */
  async getStockHistory(productId, options) {
    const { variantId, limit, offset } = options;

    const where = { product_id: productId };
    if (variantId) {
      where.variant_id = variantId;
    }

    const movements = await StockMovement.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset,
      include: [
        { model: Product, as: 'product' },
        { model: ProductVariant, as: 'variant' }
      ]
    });

    return movements;
  }
}

module.exports = new StockService();