const { sequelize, Sequelize } = require('../config/database');

const ProductAttribute = sequelize.define('ProductAttribute', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  product_id: {
    type: Sequelize.UUID,
    allowNull: false
  },
  name: {
    type: Sequelize.STRING(50),
    allowNull: false
  },
  value: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  display_name: {
    type: Sequelize.STRING(100),
    allowNull: true
  },
  type: {
    type: Sequelize.ENUM('text', 'number', 'boolean', 'select', 'multiselect', 'date'),
    defaultValue: 'text'
  },
  unit: {
    type: Sequelize.STRING(20),
    allowNull: true
  },
  is_variant_attribute: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  is_visible: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
  is_filterable: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  position: {
    type: Sequelize.INTEGER,
    defaultValue: 0
  },
  metadata: {
    type: Sequelize.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'product_attributes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ProductAttribute;