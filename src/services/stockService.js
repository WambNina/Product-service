const { Op } = require('sequelize');
const { Stock, StockMovement, Product, ProductVariant } = require('../models');
const ApiError = require('../utils/apiError');

class StockService {
  /**
   * Get stock for a product (with variants)
   */
  async getStock(productId) {
    const product = await Product.findByPk(productId, {
      include: [
        {
          model: Stock,
          as: 'stock'
        },
        {
          model: ProductVariant,
          as: 'variants',
          include: [{
            model: Stock,
            as: 'stock'
          }]
        }
      ]
    });

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku
      },
      stock: product.stock ? {
        quantity: product.stock.quantity,
        reservedQuantity: product.stock.reservedQuantity,
        availableStock: product.stock.getAvailableStock(),
        alertThreshold: product.stock.alertThreshold,
        isLowStock: product.stock.isLowStock(),
        lastMovementAt: product.stock.lastMovementAt,
        updatedAt: product.stock.updatedAt
      } : {
        quantity: 0,
        reservedQuantity: 0,
        availableStock: 0,
        alertThreshold: 10,
        isLowStock: true,
        lastMovementAt: null,
        updatedAt: null
      },
      variants: product.variants.map(variant => ({
        id: variant.id,
        name: variant.name || variant.sku,
        sku: variant.sku,
        stock: variant.stock ? {
          quantity: variant.stock.quantity,
          reservedQuantity: variant.stock.reservedQuantity,
          availableStock: variant.stock.getAvailableStock(),
          alertThreshold: variant.stock.alertThreshold,
          isLowStock: variant.stock.isLowStock(),
          lastMovementAt: variant.stock.lastMovementAt
        } : null
      }))
    };
  }

  /**
   * Update stock (absolute value)
   */
  async updateStock(productId, data, userId = null) {
    const { quantity, variantId = null, reason = 'Manual adjustment' } = data;

    if (quantity === undefined || quantity === null) {
      throw new ApiError(400, 'Quantity is required');
    }

    if (isNaN(quantity) || quantity < 0) {
      throw new ApiError(400, 'Quantity must be a non-negative number');
    }

    const transaction = await require('../config/database').sequelize.transaction();

    try {
      // Verify product exists
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        throw new ApiError(404, 'Product not found');
      }

      // Verify variant if provided
      if (variantId) {
        const variant = await ProductVariant.findOne({
          where: { id: variantId, product_id: productId },
          transaction
        });
        if (!variant) {
          throw new ApiError(404, 'Product variant not found');
        }
      }

      // Find or create stock
      let [stock, created] = await Stock.findOrCreate({
        where: { productId, variantId },
        defaults: {
          quantity: 0,
          reservedQuantity: 0,
          alertThreshold: 10
        },
        transaction
      });

      const previousStock = stock.quantity;
      
      // Update stock
      await stock.update({ 
        quantity: parseInt(quantity),
        lastMovementAt: new Date()
      }, { transaction });

      // Create movement record
      await StockMovement.create({
        productId,
        variantId,
        movementType: 'adjustment',
        quantity: parseInt(quantity) - previousStock,
        previousStock,
        newStock: parseInt(quantity),
        reason,
        createdBy: userId
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        message: 'Stock updated successfully',
        data: {
          productId,
          variantId,
          previousStock,
          newStock: parseInt(quantity),
          change: parseInt(quantity) - previousStock,
          availableStock: parseInt(quantity) - stock.reservedQuantity
        }
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Increase stock
   */
  async increaseStock(productId, data, userId = null) {
    const { quantity, variantId = null, reason = 'Stock addition', referenceId = null } = data;

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      throw new ApiError(400, 'Quantity must be a positive number');
    }

    const transaction = await require('../config/database').sequelize.transaction();

    try {
      // Verify product exists
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        throw new ApiError(404, 'Product not found');
      }

      // Verify variant if provided
      if (variantId) {
        const variant = await ProductVariant.findOne({
          where: { id: variantId, product_id: productId },
          transaction
        });
        if (!variant) {
          throw new ApiError(404, 'Product variant not found');
        }
      }

      // Find or create stock
      let [stock] = await Stock.findOrCreate({
        where: { productId, variantId },
        defaults: {
          quantity: 0,
          reservedQuantity: 0,
          alertThreshold: 10
        },
        transaction
      });

      const previousStock = stock.quantity;
      const newStock = previousStock + parseInt(quantity);

      // Update stock
      await stock.update({ 
        quantity: newStock,
        lastMovementAt: new Date()
      }, { transaction });

      // Create movement record
      await StockMovement.create({
        productId,
        variantId,
        movementType: 'increase',
        quantity: parseInt(quantity),
        previousStock,
        newStock,
        reason,
        referenceId,
        createdBy: userId
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        message: `Stock increased by ${quantity}`,
        data: {
          productId,
          variantId,
          previousStock,
          newStock,
          added: parseInt(quantity),
          availableStock: newStock - stock.reservedQuantity
        }
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Decrease stock
   */
  async decreaseStock(productId, data, userId = null) {
    const { quantity, variantId = null, reason = 'Stock removal', referenceId = null, allowNegative = false } = data;

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      throw new ApiError(400, 'Quantity must be a positive number');
    }

    const transaction = await require('../config/database').sequelize.transaction();

    try {
      // Find stock
      const stock = await Stock.findOne({
        where: { productId, variantId },
        transaction
      });

      if (!stock) {
        throw new ApiError(404, 'Stock record not found for this product');
      }

      const previousStock = stock.quantity;
      const newStock = previousStock - parseInt(quantity);

      // Check if sufficient stock (unless allowNegative is true)
      if (!allowNegative && newStock < 0) {
        throw new ApiError(400, `Insufficient stock. Available: ${previousStock}, Requested: ${quantity}`);
      }

      // Check reserved stock
      const availableAfterDecrease = newStock - stock.reservedQuantity;
      if (!allowNegative && availableAfterDecrease < 0) {
        throw new ApiError(400, `Cannot decrease below reserved quantity. Reserved: ${stock.reservedQuantity}`);
      }

      // Update stock
      await stock.update({ 
        quantity: newStock,
        lastMovementAt: new Date()
      }, { transaction });

      // Create movement record
      await StockMovement.create({
        productId,
        variantId,
        movementType: 'decrease',
        quantity: -parseInt(quantity),
        previousStock,
        newStock,
        reason,
        referenceId,
        createdBy: userId
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        message: `Stock decreased by ${quantity}`,
        data: {
          productId,
          variantId,
          previousStock,
          newStock,
          removed: parseInt(quantity),
          availableStock: newStock - stock.reservedQuantity
        }
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get stock movement history
   */
  async getStockHistory(productId, options = {}) {
    const { variantId, limit = 50, offset = 0 } = options;

    const where = { productId };
    if (variantId) where.variantId = variantId;

    const movements = await StockMovement.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      total: movements.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: movements.rows
    };
  }

  /**
   * Initialize stock for new product (called from productService)
   */
  async initializeStock(productId, initialQuantity = 0, userId = null) {
    const transaction = await require('../config/database').sequelize.transaction();

    try {
      const [stock, created] = await Stock.findOrCreate({
        where: { productId, variantId: null },
        defaults: {
          quantity: parseInt(initialQuantity),
          reservedQuantity: 0,
          alertThreshold: 10,
          lastMovementAt: new Date()
        },
        transaction
      });

      if (created && initialQuantity > 0) {
        await StockMovement.create({
          productId,
          variantId: null,
          movementType: 'initial',
          quantity: parseInt(initialQuantity),
          previousStock: 0,
          newStock: parseInt(initialQuantity),
          reason: 'Initial stock',
          createdBy: userId
        }, { transaction });
      }

      await transaction.commit();
      return stock;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new StockService();