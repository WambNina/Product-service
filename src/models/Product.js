const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.CHAR(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  merchant_id: {
    type: DataTypes.CHAR(36),
    allowNull: false
  },
  store_id: {
    type: DataTypes.CHAR(36),
    allowNull: true
  },
  category_id: {
    type: DataTypes.CHAR(36),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  short_description: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  sku: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  compare_at_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  brand: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [2, 100]
    }
  },
  weight: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  weight_unit: {
    type: DataTypes.ENUM('kg', 'g', 'lb', 'oz'),
    defaultValue: 'kg'
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'archived', 'out_of_stock', 'payment_expired'),
    defaultValue: 'draft'
  },
  visibility: {
    type: DataTypes.ENUM('public', 'draft', 'hidden'),
    defaultValue: 'public'
  },
  is_free_tier: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  payment_plan: {
    type: DataTypes.ENUM('free', 'monthly', 'yearly'),
    defaultValue: 'free'
  },
  payment_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  payment_renewal_reminder_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tax_class: {
    type: DataTypes.STRING(50),
    defaultValue: 'standard'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    validate: {
      isValidTags(value) {
        if (value && !Array.isArray(value)) {
          throw new Error('Tags must be an array');
        }
        if (value && value.some(tag => typeof tag !== 'string')) {
          throw new Error('All tags must be strings');
        }
      }
    }
  },
  seo_title: {
    type: DataTypes.STRING(70),
    allowNull: true
  },
  seo_description: {
    type: DataTypes.STRING(160),
    allowNull: true
  },
  meta_keywords: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  attributes_schema: {
    type: DataTypes.JSON,
    allowNull: true
  },
  has_variants: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  variant_attributes: {
    type: DataTypes.JSON,
    allowNull: true
  },
  source: {
    type: DataTypes.ENUM('web', 'whatsapp', 'api', 'bulk_import'),
    defaultValue: 'web'
  },
  whatsapp_media_group_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sales_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  rating_average: {
    type: DataTypes.DECIMAL(2, 1),
    defaultValue: 0.0
  },
  rating_count: {
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
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['merchant_id'], name: 'idx_merchant_id' },
    { fields: ['store_id'], name: 'idx_store_id' },
    { fields: ['category_id'], name: 'idx_category_id' },
    { fields: ['status'], name: 'idx_status' },
    { fields: ['visibility'], name: 'idx_visibility' },
    { fields: ['payment_expires_at'], name: 'idx_payment_expires' },
    { fields: ['created_at'], name: 'idx_created_at' }
  ]
});

// Associations
Product.associate = (models) => {
  Product.belongsTo(models.Category, {
    foreignKey: 'category_id',
    as: 'category',
    onDelete: 'RESTRICT'
  });
  
  Product.hasMany(models.ProductVariant, {
    foreignKey: 'product_id',
    as: 'variants'
  });
  
  Product.hasMany(models.ProductImage, {
    foreignKey: 'product_id',
    as: 'images'
  });
  
  Product.hasMany(models.ProductAttribute, {
    foreignKey: 'product_id',
    as: 'attributes'
  });
  
  Product.hasOne(models.ProductStock, {
    foreignKey: 'product_id',
    as: 'stock'
  });

  Product.hasMany(models.StockMovement, {
    foreignKey: 'product_id',
    as: 'stockMovements'
  });

  Product.hasMany(models.ProductPaymentHistory, {
    foreignKey: 'product_id',
    as: 'paymentHistory'
  });

  Product.hasMany(models.ProductAnalytics, {
    foreignKey: 'product_id',
    as: 'analytics'
  });
};

module.exports = Product;