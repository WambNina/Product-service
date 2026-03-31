module.exports = (sequelize, DataTypes) => {
  return sequelize.define('ProductAttributeDefinition', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: DataTypes.UUID,
    attributeDefinitionId: DataTypes.UUID,
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    defaultValueId: {
      type: DataTypes.UUID,
      allowNull: true
      // Valeur par défaut si l'utilisateur ne choisit rien
    },
    customConfig: {
      type: DataTypes.JSON,
      defaultValue: {}
      // Config spécifique pour ce produit (ex: min/max pour poids)
    }
  });
};