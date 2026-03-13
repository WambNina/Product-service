const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Category = sequelize.define("Category", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false, // Strictement requis
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    description: { type: DataTypes.TEXT },
    status: {
        type: DataTypes.ENUM("active", "inactive"),
        defaultValue: "active",
    },
}, {
    tableName: "categories",
    timestamps: true,
    underscored: true
});

module.exports = Category;