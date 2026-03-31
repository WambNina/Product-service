const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductVariant = sequelize.define('ProductVariant', {
  id: {
    type: DataTypes.CHAR(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  product_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  // 🔄 CHAMP JSON EXISTANT - enrichi pour le pricing modulaire
  // Stocke: color, size, capacity, weight avec leurs priceImpact
  attributes: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
    comment: 'Tous les attributs avec pricing: {color, size, capacity, weight, etc.}'
  },
  
  // 🆕 DÉCOMPOSITION pour faciliter les requêtes (optionnel mais pratique)
  // Ces champs sont synchronisés avec attributes par les hooks
  color: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Valeur brute de la couleur (ex: #FF0000 ou Rouge)'
  },
  size: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Valeur brute de la taille (ex: XL, 256GB)'
  },
  material: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  pattern: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  
  // 🆕 NOUVEAU: Capacité spécifique (pour électronique)
  capacity: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Capacité/mémoire (ex: 256GB, 512GB) - définit le prix de base'
  },
  
  // 💰 PRICING CLARIFIÉ
  // Prix de base du produit (copié pour référence)
  base_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Prix de base du produit parent au moment de la création'
  },
  
  // Ancien champ gardé pour compatibilité (déprécié, utiliser final_price)
  price_adjustment: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: 'DEPRECATED - Utiliser attributes.{color|size|weight}.priceImpact'
  },
  
  // 🆕 PRIX CALCULÉ (sum de base_price + tous les priceImpact)
  calculated_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Prix auto-calculé: base + colorImpact + sizeImpact + weightImpact'
  },
  
  // 🆕 PRIX MANUEL (override)
  override_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Prix manuel qui remplace calculated_price'
  },
  
  // ✅ PRIX EFFECTIF (celui affiché et utilisé)
  final_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Prix effectif: COALESCE(override_price, calculated_price, price, 0)'
  },
  
  // Gardé pour rétrocompatibilité
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'DEPRECATED - Utiliser final_price'
  },
  
  compare_at_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Prix barré (ancien prix pour promo)'
  },
  
  // 📦 STOCK
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantité en stock'
  },
  
  // 🏋️ POIDS
  weight: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    comment: 'Poids en kg'
  },
  
  // 🖼️ IMAGE
  image_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
    references: {
      model: 'product_images',
      key: 'id'
    }
  },
  // 🆕 URL directe pour accès rapide
  image_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'URL directe de l\'image (redondant avec image_id mais pratique)'
  },
  
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('active', 'out_of_stock', 'discontinued'),
    defaultValue: 'active'
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  // 🆕 MÉTADONNÉES PRIX
  pricing_metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Détails du calcul: {basePrice, colorImpact, sizeImpact, weightImpact, totalImpact}'
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
  tableName: 'product_variants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  
  // 🆕 HOOKS pour synchronisation auto
  hooks: {
    beforeValidate: (variant) => {
      // Synchroniser attributes JSON avec les champs plats
      if (variant.attributes && typeof variant.attributes === 'object') {
        if (variant.attributes.color?.value) variant.color = variant.attributes.color.value;
        if (variant.attributes.size?.value) variant.size = variant.attributes.size.value;
        if (variant.attributes.capacity?.value) variant.capacity = variant.attributes.capacity.value;
        if (variant.attributes.weight?.value) variant.weight = variant.attributes.weight.value;
      }
      
      // 🧮 CALCUL AUTO DU PRIX
      calculateFinalPrice(variant);
    },
    
    beforeUpdate: (variant) => {
      // Recalculer si les attributs changent
      if (variant.changed('attributes')) {
        if (variant.attributes.color?.value) variant.color = variant.attributes.color.value;
        if (variant.attributes.size?.value) variant.size = variant.attributes.size.value;
        if (variant.attributes.capacity?.value) variant.capacity = variant.attributes.capacity.value;
        if (variant.attributes.weight?.value) variant.weight = variant.attributes.weight.value;
        
        calculateFinalPrice(variant);
      }
    }
  },
  
  indexes: [
    { fields: ['product_id', 'status'], name: 'idx_product_id_status' },
    { fields: ['color', 'size'], name: 'idx_color_size' },
    { fields: ['capacity'], name: 'idx_capacity' },
    { fields: ['sku'], unique: true, name: 'idx_sku' },
    { fields: ['final_price'], name: 'idx_final_price' }
  ]
});

// 🆕 FONCTION DE CALCUL CENTRALISÉE
function calculateFinalPrice(variant) {
  // Déterminer le prix de base
  let basePrice = 0;
  
  if (variant.attributes?.capacity?.basePrice) {
    // Mode électronique: capacité définit le prix
    basePrice = parseFloat(variant.attributes.capacity.basePrice);
  } else if (variant.base_price) {
    // Mode standard: prix du produit
    basePrice = parseFloat(variant.base_price);
  } else if (variant.price) {
    // Fallback rétrocompatibilité
    basePrice = parseFloat(variant.price);
  }
  
  // Calculer les impacts
  let colorImpact = 0;
  let sizeImpact = 0;
  let weightImpact = 0;
  
  if (variant.attributes?.color?.priceImpact) {
    colorImpact = parseFloat(variant.attributes.color.priceImpact);
  }
  if (variant.attributes?.size?.priceImpact) {
    sizeImpact = parseFloat(variant.attributes.size.priceImpact);
  }
  if (variant.attributes?.weight?.priceImpact) {
    weightImpact = parseFloat(variant.attributes.weight.priceImpact);
  }
  
  // Calcul final
  const calculatedPrice = basePrice + colorImpact + sizeImpact + weightImpact;
  
  // Stocker le calcul
  variant.calculated_price = Math.round(calculatedPrice * 100) / 100;
  
  // Déterminer le prix final
  if (variant.override_price !== null && variant.override_price !== undefined) {
    variant.final_price = parseFloat(variant.override_price);
  } else {
    variant.final_price = variant.calculated_price;
  }
  
  // Stocker les métadonnées du calcul
  variant.pricing_metadata = {
    basePrice: basePrice,
    colorImpact: colorImpact,
    sizeImpact: sizeImpact,
    weightImpact: weightImpact,
    totalImpact: colorImpact + sizeImpact + weightImpact,
    calculatedAt: new Date().toISOString()
  };
  
  // Synchroniser l'ancien champ price pour compatibilité
  variant.price = variant.final_price;
}

// Associations
ProductVariant.associate = (models) => {
  ProductVariant.belongsTo(models.Product, {
    foreignKey: 'product_id',
    as: 'product',
    onDelete: 'CASCADE'
  });
  ProductVariant.belongsTo(models.ProductImage, {
    foreignKey: 'image_id',
    as: 'image',
    onDelete: 'SET NULL'
  });
  ProductVariant.hasMany(models.ProductStock, {
    foreignKey: 'variant_id',
    as: 'stocks'
  });
  ProductVariant.hasMany(models.StockMovement, {
    foreignKey: 'variant_id',
    as: 'stockMovements'
  });
};

// ✅ UN SEUL EXPORT
module.exports = ProductVariant;