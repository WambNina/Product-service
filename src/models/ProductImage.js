const { sequelize, Sequelize } = require('../config/database');

const ProductImage = sequelize.define('ProductImage', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  product_id: {
    type: Sequelize.UUID,
    allowNull: false
  },
  variant_id: {
    type: Sequelize.UUID,
    allowNull: true
  },
  filename: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  original_filename: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  mime_type: {
    type: Sequelize.STRING(50),
    allowNull: false
  },
  size_bytes: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  url: {
    type: Sequelize.STRING(500),
    allowNull: false
  },
  thumbnail_url: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  medium_url: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  large_url: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  width: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  height: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  alt_text: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  caption: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  position: {
    type: Sequelize.INTEGER,
    defaultValue: 0
  },
  is_primary: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  source: {
    type: Sequelize.ENUM('upload', 'whatsapp', 'url', 'api'),
    defaultValue: 'upload'
  },
  whatsapp_media_id: {
    type: Sequelize.STRING(100),
    allowNull: true
  },
  metadata: {
    type: Sequelize.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'product_images',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ProductImage;