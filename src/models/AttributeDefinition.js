const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AttributeDefinition = sequelize.define('AttributeDefinition', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nom affiché (ex: Couleur, Mémoire)'
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Code technique (ex: color, memory)'
  },
  type: {
    type: DataTypes.ENUM('text', 'color', 'image', 'number'),
    defaultValue: 'text',
    comment: 'Type d\'affichage'
  },
  pricingType: {
    type: DataTypes.ENUM('fixed', 'modifier', 'none'),
    defaultValue: 'none',
    comment: 'fixed: définit prix base, modifier: modifie prix, none: sans impact'
  },
  isVariant: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Est-ce un attribut de variant?'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Ordre d\'application (0=capacité d\'abord, 1=couleur, etc.)'
  },
  configuration: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Config additionnelle (options, allowCustom, etc.)'
  }
}, {
  tableName: 'attribute_definitions',
  timestamps: true
});

module.exports = AttributeDefinition;