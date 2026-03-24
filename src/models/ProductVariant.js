const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductVariant = sequelize.define('ProductVariant', {
  id: {
    type: DataTypes.CHAR(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  product_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  attributes: {
    type: DataTypes.JSON,
    allowNull: false
  },
  color: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  size: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  material: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  pattern: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  price_adjustment: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  final_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  compare_at_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  weight: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  image_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
    references: {
      model: 'product_images',
      key: 'id'
    }
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('active', 'out_of_stock', 'discontinued'),
    defaultValue: 'active'
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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
  tableName: 'product_variants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['product_id', 'status'], name: 'idx_product_id_status' },
    { fields: ['color', 'size'], name: 'idx_color_size' },
    { fields: ['sku'], unique: true, name: 'idx_sku' }
  ]
});

ProductVariant.associate = (models) => {
  ProductVariant.belongsTo(models.Product, {
    foreignKey: 'product_id',
    as: 'product',
    onDelete: 'CASCADE'
  });
  ProductVariant.belongsTo(models.ProductImage, {
    foreignKey: 'image_id',
    as: 'image',
    onDelete: 'SET NULL'
  });
  ProductVariant.hasMany(models.ProductStock, {
    foreignKey: 'variant_id',
    as: 'stocks'
  });
  ProductVariant.hasMany(models.StockMovement, {
    foreignKey: 'variant_id',
    as: 'stockMovements'
  });
};

module.exports = ProductVariant;