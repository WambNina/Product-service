const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockMovement = sequelize.define('StockMovement', {
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
  movement_type: {
    type: DataTypes.ENUM('increase', 'decrease', 'adjustment', 'initial'),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  previous_stock: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  new_stock: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  reference_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  created_by: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'stock_movements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // No updated_at in SQL schema
  indexes: [
    {
      fields: ['product_id', 'created_at'],
      name: 'idx_product_movements'
    }
  ]
});

// Associations
StockMovement.associate = (models) => {
  StockMovement.belongsTo(models.Product, {
    foreignKey: 'product_id',
    as: 'product',
    onDelete: 'CASCADE'
  });
  StockMovement.belongsTo(models.ProductVariant, {
    foreignKey: 'variant_id',
    as: 'variant',
    onDelete: 'CASCADE'
  });
};

module.exports = StockMovement;