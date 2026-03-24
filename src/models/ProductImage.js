const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductImage = sequelize.define('ProductImage', {
  id: {
    type: DataTypes.CHAR(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  product_id: {
    type: DataTypes.CHAR(36),
    allowNull: false
  },
  variant_id: {
    type: DataTypes.CHAR(36),
    allowNull: true
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  original_filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  mime_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  size_bytes: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  thumbnail_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  medium_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  large_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  alt_text: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  caption: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  source: {
    type: DataTypes.ENUM('upload', 'whatsapp', 'url', 'api'),
    defaultValue: 'upload'
  },
  whatsapp_media_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
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
  tableName: 'product_images',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['product_id'], name: 'idx_product_id' },
    { fields: ['variant_id'], name: 'idx_variant_id' },
    { fields: ['is_primary'], name: 'idx_is_primary' }
  ]
});

// Associations
ProductImage.associate = (models) => {
  ProductImage.belongsTo(models.Product, {
    foreignKey: 'product_id',
    as: 'product',
    onDelete: 'CASCADE'
  });
  ProductImage.belongsTo(models.ProductVariant, {
    foreignKey: 'variant_id',
    as: 'variant',
    onDelete: 'SET NULL'
  });
  ProductImage.hasMany(models.ProductVariant, {
    foreignKey: 'image_id',
    as: 'variantsUsingThisImage'
  });
};

module.exports = ProductImage;