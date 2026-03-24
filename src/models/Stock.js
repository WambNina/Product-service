const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductStock = sequelize.define('ProductStock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  variant_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
    references: {
      model: 'product_variants',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  reserved_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  alert_threshold: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  last_movement_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'product_stocks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['product_id', 'variant_id'],
      name: 'unique_product_variant'
    }
  ]
});

// Associations
ProductStock.associate = (models) => {
  ProductStock.belongsTo(models.Product, {
    foreignKey: 'product_id',
    as: 'product',
    onDelete: 'CASCADE'
  });
  ProductStock.belongsTo(models.ProductVariant, {
    foreignKey: 'variant_id',
    as: 'variant',
    onDelete: 'CASCADE'
  });
};

module.exports = ProductStock;