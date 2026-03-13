const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    merchant_id: { type: DataTypes.UUID, allowNull: false },
    store_id: { type: DataTypes.UUID, allowNull: false },
    
    // ON DÉFINIT LA CLÉ ICI POUR FORCER LE NOT NULL
    category_id: {
        type: DataTypes.UUID,
        allowNull: false, // DOIT ÊTRE IDENTIQUE À CATEGORY.ID
    },
    
    category_name: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'archived', 'out_of_stock', 'payment_expired'),
        defaultValue: 'draft'
    }
    // ... Garde le reste de tes champs comme price, quantity, etc.
}, {
    tableName: 'products',
    timestamps: true,
    underscored: true
});

module.exports = Product;