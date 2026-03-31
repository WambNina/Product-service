const { sequelize } = require('../config/database');
const Category = require('./Category');
const Product = require('./Product');
const ProductImage = require('./ProductImage');
const ProductAttribute = require('./ProductAttribute');
const ProductVariant = require('./ProductVariant');
const Stock = require('./Stock');
const StockMovement = require('./StockMovement');
const { Op } = require('sequelize');

// 🆕 AJOUTER CES IMPORTS MANQUANTS
const AttributeDefinition = require('./AttributeDefinition');
const AttributeValue = require('./AttributeValue');

// ==========================================
// ASSOCIATIONS ATTRIBUTES (NOUVEAU)
// ==========================================

AttributeDefinition.hasMany(AttributeValue, { 
  as: 'values', 
  foreignKey: 'attributeDefinitionId' 
});

AttributeValue.belongsTo(AttributeDefinition, { 
  foreignKey: 'attributeDefinitionId' 
});

Product.belongsToMany(AttributeValue, { 
  through: 'ProductAttributeValues',
  as: 'attributeValues',
  foreignKey: 'productId'
});

AttributeValue.belongsToMany(Product, {
  through: 'ProductAttributeValues',
  foreignKey: 'attributeValueId'
});

// ==========================================
// ASSOCIATIONS EXISTANTES
// ==========================================

Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'images', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(ProductAttribute, { foreignKey: 'product_id', as: 'attributes', onDelete: 'CASCADE' });
ProductAttribute.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Stock associations
Product.hasOne(Stock, { foreignKey: 'product_id', as: 'stock', onDelete: 'CASCADE' });
Stock.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

ProductVariant.hasOne(Stock, { foreignKey: 'variant_id', as: 'stock', onDelete: 'CASCADE' });
Stock.belongsTo(ProductVariant, { foreignKey: 'variant_id', as: 'variant' });

Product.hasMany(StockMovement, { foreignKey: 'product_id', as: 'stockMovements', onDelete: 'CASCADE' });
StockMovement.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

ProductVariant.hasMany(StockMovement, { foreignKey: 'variant_id', as: 'stockMovements', onDelete: 'CASCADE' });
StockMovement.belongsTo(ProductVariant, { foreignKey: 'variant_id', as: 'variant' });

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  sequelize,
  Category,
  Product,
  ProductImage,
  ProductAttribute,
  ProductVariant,
  Stock,
  StockMovement,
  // 🆕 EXPORTER LES NOUVEAUX MODÈLES
  AttributeDefinition,
  AttributeValue, 
  Op
};