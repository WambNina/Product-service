const { Product, Category, ProductVariant } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');

class MerchantService {
  async getProductsByMerchant(merchantId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    const whereClause = { merchant_id: merchantId };
    if (status) whereClause.status = status;

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: ProductVariant, as: 'variants', attributes: ['id', 'sku', 'color', 'size', 'quantity'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    return {
      data: products,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    };
  }

  async createProductForMerchant(merchantId, productData) {
    // Ajouter automatiquement le merchant_id
    const data = {
      ...productData,
      merchant_id: merchantId,
      status: productData.status || 'draft'
    };

    return await Product.create(data, {
      include: [
        { model: ProductVariant, as: 'variants' },
        { association: 'attributes' }
      ]
    });
  }

  async getProductsByStore(storeId, options = {}) {
    const { page = 1, limit = 20, category, in_stock } = options;
    const offset = (page - 1) * limit;

    const whereClause = { store_id: storeId, status: 'active' };
    
    if (in_stock) {
      whereClause.quantity = { [Op.gt]: 0 };
    }

    const includeOptions = [
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      { model: ProductVariant, as: 'variants', attributes: ['id', 'sku', 'color', 'size', 'price_adjustment'] }
    ];

    if (category) {
      includeOptions[0].where = { id: category };
      includeOptions[0].required = true;
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      order: [['featured', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    return {
      data: products,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    };
  }
}

module.exports = new MerchantService();