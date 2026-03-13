const { sequelize } = require('../config/database');
const Category = require('./Category');
const Product = require('./Product');
const ProductImage = require('./ProductImage');
const ProductAttribute = require('./ProductAttribute');
const ProductVariant = require('./ProductVariant');
const Stock = require('./Stock'); // Add this
const StockMovement = require('./StockMovement'); // Add this

// Existing associations
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'images', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(ProductAttribute, { foreignKey: 'product_id', as: 'attributes', onDelete: 'CASCADE' });
ProductAttribute.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// NEW: Stock associations
Product.hasOne(Stock, { foreignKey: 'product_id', as: 'stock', onDelete: 'CASCADE' });
Stock.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

ProductVariant.hasOne(Stock, { foreignKey: 'variant_id', as: 'stock', onDelete: 'CASCADE' });
Stock.belongsTo(ProductVariant, { foreignKey: 'variant_id', as: 'variant' });

Product.hasMany(StockMovement, { foreignKey: 'product_id', as: 'stockMovements', onDelete: 'CASCADE' });
StockMovement.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

ProductVariant.hasMany(StockMovement, { foreignKey: 'variant_id', as: 'stockMovements', onDelete: 'CASCADE' });
StockMovement.belongsTo(ProductVariant, { foreignKey: 'variant_id', as: 'variant' });

module.exports = {
  sequelize,
  Category,
  Product,
  ProductImage,
  ProductAttribute,
  ProductVariant,
  Stock,           // Export
  StockMovement    // Export
};