const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockMovement = sequelize.define('StockMovement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  productId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'product_id'
  },
  variantId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'variant_id'
  },
  movementType: {
    type: DataTypes.ENUM('increase', 'decrease', 'adjustment', 'initial'),
    allowNull: false,
    field: 'movement_type'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  previousStock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'previous_stock'
  },
  newStock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'new_stock'
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  referenceId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reference_id'
  },
  createdBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'created_by'
  }
}, {
  tableName: 'stock_movements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = StockMovement;