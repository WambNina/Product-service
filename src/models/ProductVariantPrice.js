// models/ProductVariantPrice.js (optionnel - si tu veux historique des prix)
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductVariantPrice = sequelize.define('ProductVariantPrice', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  variant_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'product_variants',
      key: 'id'
    }
  },
  price_type: {
    type: DataTypes.ENUM('calculated', 'override', 'promotion', 'cost'),
    defaultValue: 'calculated'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  valid_from: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'product_variant_prices',
  timestamps: true
});

module.exports = ProductVariantPrice;