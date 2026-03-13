const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Stock = sequelize.define('Stock', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  productId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'products',
      key: 'id'
    }
  },
  variantId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'variant_id',
    references: {
      model: 'product_variants',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  reservedQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'reserved_quantity'
  },
  alertThreshold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
    field: 'alert_threshold'
  },
  lastMovementAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_movement_at'
  }
}, {
  tableName: 'product_stocks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['product_id', 'variant_id']
    }
  ]
});

// Virtual field for available stock
Stock.prototype.getAvailableStock = function() {
  return this.quantity - this.reservedQuantity;
};

// Check if stock is low
Stock.prototype.isLowStock = function() {
  return this.getAvailableStock() <= this.alertThreshold;
};

module.exports = Stock;