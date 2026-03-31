const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AttributeValue = sequelize.define('AttributeValue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  attributeDefinitionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'attribute_definitions',
      key: 'id'
    }
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Valeur technique (ex: 256GB, #FF0000)'
  },
  displayValue: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nom affiché (ex: 256 Go, Rouge Profond)'
  },
  priceImpact: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: 'Impact sur le prix'
  },
  priceImpactType: {
    type: DataTypes.ENUM('absolute', 'percentage', 'fixed'),
    defaultValue: 'absolute',
    comment: 'absolute: +/- montant, percentage: +/- %, fixed: prix de base'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Données supplémentaires (hex, imageUrl, etc.)'
  }
}, {
  tableName: 'attribute_values',
  timestamps: true
});

module.exports = AttributeValue;