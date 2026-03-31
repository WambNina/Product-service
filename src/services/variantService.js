const { Product, ProductVariant, ProductImage, Op } = require("../models");
const ApiError = require("../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const variantService = require('../services/variantService');

class VariantService {
  async getVariantsByProductId(productId) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, "Produit non trouvé");
    }

    return await ProductVariant.findAll({
      where: { product_id: productId },
      order: [["created_at", "DESC"]],
    });
  }

  async createVariant(productId, variantData) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, "Produit non trouvé");
    }

    if (variantData.sku) {
      const existingVariant = await ProductVariant.findOne({
        where: { sku: variantData.sku },
      });
      if (existingVariant) {
        throw new ApiError(400, "Ce SKU est déjà utilisé");
      }
    }

    if (variantData.is_default) {
      await ProductVariant.update(
        { is_default: false },
        { where: { product_id: productId } },
      );
    }

    return await ProductVariant.create({
      ...variantData,
      product_id: productId,
    });
  }

  async updateVariant(variantId, variantData) {
    const variant = await ProductVariant.findByPk(variantId);
    if (!variant) {
      throw new ApiError(404, "Variante non trouvée");
    }

    if (variantData.sku && variantData.sku !== variant.sku) {
      const existingVariant = await ProductVariant.findOne({
        where: { sku: variantData.sku },
      });
      if (existingVariant) {
        throw new ApiError(400, "Ce SKU est déjà utilisé");
      }
    }

    if (variantData.is_default && !variant.is_default) {
      await ProductVariant.update(
        { is_default: false },
        { where: { product_id: variant.product_id } },
      );
    }

    await variant.update(variantData);

    return await ProductVariant.findByPk(variantId);
  }

  async deleteVariant(variantId) {
    const variant = await ProductVariant.findByPk(variantId);
    if (!variant) {
      throw new ApiError(404, "Variante non trouvée");
    }

    if (variant.is_default) {
      const count = await ProductVariant.count({
        where: { product_id: variant.product_id },
      });

      if (count === 1) {
        throw new ApiError(400, "Impossible de supprimer la seule variante");
      }
    }

    await variant.destroy();
  }

  // ✅ VERSION SEQUELIZE (remplace Prisma)
  async getProductById(productId) {
    const product = await Product.findByPk(productId);
    return product; // Retourne null si pas trouvé, le controller gère l'erreur
  }

  /**
   * 🆕 NOUVEAU: Find variant by attributes (pour calculatePrice)
   */
  async findVariantByAttributes(productId, attributes) {
    const whereConditions = {
      product_id: productId,
    };

    // Chercher dans les champs plats ET dans le JSON attributes
    if (attributes.color) {
      whereConditions[Op.or] = [
        { color: attributes.color },
        { attributes: { [Op.like]: `%${attributes.color}%` } }
      ];
    }
    
    if (attributes.size) {
      // Si on a déjà un Op.or, on le combine
      if (whereConditions[Op.or]) {
        whereConditions[Op.and] = [
          { [Op.or]: whereConditions[Op.or] },
          {
            [Op.or]: [
              { size: attributes.size },
              { attributes: { [Op.like]: `%${attributes.size}%` } }
            ]
          }
        ];
        delete whereConditions[Op.or];
      } else {
        whereConditions[Op.or] = [
          { size: attributes.size },
          { attributes: { [Op.like]: `%${attributes.size}%` } }
        ];
      }
    }

    if (attributes.capacity) {
      // Capacity peut être dans size, capacity, ou attributes JSON
      const capacityConditions = [
        { size: attributes.capacity },
        { capacity: attributes.capacity },
        { attributes: { [Op.like]: `%${attributes.capacity}%` } }
      ];
      
      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push({ [Op.or]: capacityConditions });
      } else if (whereConditions[Op.or]) {
        whereConditions[Op.and] = [
          { [Op.or]: whereConditions[Op.or] },
          { [Op.or]: capacityConditions }
        ];
        delete whereConditions[Op.or];
      } else {
        whereConditions[Op.or] = capacityConditions;
      }
    }

    return await ProductVariant.findOne({
      where: whereConditions,
    });
  }

  /**
   * 🆕 NOUVEAU: Count variants by product
   */
  async countVariantsByProduct(productId) {
    return await ProductVariant.count({
      where: { product_id: productId },
    });
  }

  /**
   * 🆕 NOUVEAU: Get variant by ID
   */
  async getVariantById(variantId) {
    return await ProductVariant.findByPk(variantId);
  }

  /**
   * Create batch variants with image (Sequelize version) - 🔄 MIS À JOUR avec pricing modulaire
   */
  async createBatchVariants({
    productId,
    colors,
    sizes,
    capacities,      // 🆕 NOUVEAU pour électronique
    weights,         // 🆕 NOUVEAU avec priceImpact
    basePrice,       // 🆕 NOUVEAU
    pricingStrategy, // 🆕 NOUVEAU: 'capacity-based' | 'modifier-based'
    isDefault,
    imageUrl,
    filename,
    file,
  }) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new ApiError(404, "Produit non trouvé");
    }

    const variants = [];
    let variantCount = 0;

    // 🆕 Mode électronique: capacity définit le prix de base
    if (pricingStrategy === 'capacity-based' && capacities && capacities.length > 0) {
      for (const capacity of capacities) {
        for (const color of colors && colors.length > 0 ? colors : [{ value: null, priceImpact: 0 }]) {
          for (const size of sizes && sizes.length > 0 ? sizes : [{ value: null, priceImpact: 0 }]) {
            
            const basePriceValue = parseFloat(capacity.basePrice) || parseFloat(product.price) || 0;
            const colorImpact = parseFloat(color.priceImpact) || 0;
            const sizeImpact = parseFloat(size.priceImpact) || 0;
            const finalPrice = basePriceValue + colorImpact + sizeImpact;

            const variant = {
              id: uuidv4(),
              product_id: productId,
              sku: this.generateSKU(product.name, capacity.value, color.value, size.value),
              barcode: null,
              attributes: JSON.stringify({
                color: color.value ? {
                  value: color.value,
                  displayValue: color.displayValue || color.value,
                  type: color.type || 'hex',
                  priceImpact: colorImpact,
                  metadata: color.metadata || {}
                } : null,
                size: size.value ? {
                  value: size.value,
                  priceImpact: sizeImpact
                } : null,
                capacity: {
                  value: capacity.value,
                  displayValue: capacity.displayValue || capacity.value,
                  basePrice: basePriceValue
                },
                weight: null
              }),
              color: color.value || null,
              size: size.value || capacity.value, // 🆕 Stocke capacity dans size si pas de size
              capacity: capacity.value, // 🆕 NOUVEAU champ capacity
              material: null,
              pattern: null,
              price_adjustment: colorImpact + sizeImpact,
              final_price: finalPrice,
              price: finalPrice,
              compare_at_price: null,
              quantity: 0,
              weight: null,
              image_id: null,
              image_url: imageUrl,
              is_default: isDefault && variantCount === 0,
              status: 'active',
              position: variantCount,
              base_price: basePriceValue,        // 🆕 NOUVEAU
              calculated_price: finalPrice,      // 🆕 NOUVEAU
              override_price: null,              // 🆕 NOUVEAU
              pricing_metadata: JSON.stringify({ // 🆕 NOUVEAU
                basePrice: basePriceValue,
                colorImpact: colorImpact,
                sizeImpact: sizeImpact,
                totalImpact: colorImpact + sizeImpact,
                strategy: 'capacity-based'
              }),
              created_at: new Date(),
              updated_at: new Date(),
            };

            variants.push(variant);
            variantCount++;
          }
        }
      }
    } 
    // 🆕 Mode standard: basePrice du produit + modificateurs
    else {
      const basePriceValue = parseFloat(basePrice) || parseFloat(product.price) || 0;
      
      for (const color of colors && colors.length > 0 ? colors : [{ value: null, priceImpact: 0 }]) {
        for (const size of sizes && sizes.length > 0 ? sizes : [{ value: null, priceImpact: 0 }]) {
          for (const weight of weights && weights.length > 0 ? weights : [{ value: null, priceImpact: 0 }]) {
            
            const colorImpact = parseFloat(color.priceImpact) || 0;
            const sizeImpact = parseFloat(size.priceImpact) || 0;
            const weightImpact = parseFloat(weight.priceImpact) || 0;
            const finalPrice = basePriceValue + colorImpact + sizeImpact + weightImpact;

            const variant = {
              id: uuidv4(),
              product_id: productId,
              sku: this.generateSKU(product.name, null, color.value, size.value, weight.value),
              barcode: null,
              attributes: JSON.stringify({
                color: color.value ? {
                  value: color.value,
                  displayValue: color.displayValue || color.value,
                  type: color.type || 'hex',
                  priceImpact: colorImpact,
                  metadata: color.metadata || {}
                } : null,
                size: size.value ? {
                  value: size.value,
                  priceImpact: sizeImpact
                } : null,
                capacity: null,
                weight: weight.value ? {
                  value: weight.value,
                  label: weight.label || `${weight.value}kg`,
                  priceImpact: weightImpact
                } : null
              }),
              color: color.value || null,
              size: size.value || null,
              capacity: null,
              material: null,
              pattern: null,
              price_adjustment: colorImpact + sizeImpact + weightImpact,
              final_price: finalPrice,
              price: finalPrice,
              compare_at_price: null,
              quantity: 0,
              weight: weight.value || null,
              image_id: null,
              image_url: imageUrl,
              is_default: isDefault && variantCount === 0,
              status: 'active',
              position: variantCount,
              base_price: basePriceValue,        // 🆕 NOUVEAU
              calculated_price: finalPrice,      // 🆕 NOUVEAU
              override_price: null,              // 🆕 NOUVEAU
              pricing_metadata: JSON.stringify({ // 🆕 NOUVEAU
                basePrice: basePriceValue,
                colorImpact: colorImpact,
                sizeImpact: sizeImpact,
                weightImpact: weightImpact,
                totalImpact: colorImpact + sizeImpact + weightImpact,
                strategy: 'modifier-based'
              }),
              created_at: new Date(),
              updated_at: new Date(),
            };

            variants.push(variant);
            variantCount++;
          }
        }
      }
    }

    // 🆕 Sauvegarder image produit si fichier fourni
    if (file && filename && imageUrl) {
      await ProductImage.create({
        id: uuidv4(),
        product_id: productId,
        variant_id: variants.length > 0 ? variants[0].id : null,
        url: imageUrl,
        filename: filename,
        original_filename: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        is_primary: isDefault,
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // 🆕 Bulk insert Sequelize
    await ProductVariant.bulkCreate(variants);

    return {
      variantsCreated: variants.length,
      variants,
      pricingStrategy: pricingStrategy || 'modifier-based',
      priceRange: {
        min: Math.min(...variants.map(v => v.final_price)),
        max: Math.max(...variants.map(v => v.final_price))
      }
    };
  }

  /**
   * 🆕 UTILITAIRE: Générer un SKU unique
   */
  generateSKU(productName, capacity, color, size, weight) {
    const clean = (str) => {
      if (!str) return '';
      return str.toString().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    };
    
    const parts = [
      clean(productName).substring(0, 4),
      capacity ? clean(capacity) : '',
      color ? clean(color) : '',
      size ? clean(size) : '',
      weight ? clean(weight) : '',
      uuidv4().substring(0, 4).toUpperCase()
    ].filter(Boolean);
    
    return parts.join('-');
  }
}

module.exports = new VariantService();