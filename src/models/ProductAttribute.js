const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductAttribute = sequelize.define('ProductAttribute', {
  id: {
    type: DataTypes.CHAR(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  product_id: {
    type: DataTypes.CHAR(36),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  value: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('text', 'number', 'boolean', 'select', 'multiselect', 'date'),
    defaultValue: 'text'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  is_variant_attribute: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_visible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_filterable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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
  tableName: 'product_attributes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['product_id', 'name'], name: 'idx_product_id_name' },
    { fields: ['is_variant_attribute'], name: 'idx_is_variant' }
  ]
});

// Associations
ProductAttribute.associate = (models) => {
  ProductAttribute.belongsTo(models.Product, {
    foreignKey: 'product_id',
    as: 'product',
    onDelete: 'CASCADE'
  });
};

module.exports = ProductAttribute;