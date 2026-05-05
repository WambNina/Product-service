const { Product, ProductVariant, ProductImage } = require("../models");
const ApiError = require("../utils/apiError");
const { Op } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const { nanoid } = require("nanoid");
const variantService = require("../services/variantService");

class VariantService {
  // services/variantService.js - REPLACE the createVariant method
  async createVariant(productId, variantData) {
    const finalProductId = variantData.product_id || productId;

    const product = await Product.findByPk(finalProductId, {
      attributes: ["id", "name", "merchant_id", "price"], // Fetch merchant_id
    });

    if (!product) {
      throw new ApiError(404, "Produit non trouvé");
    }

    // 🆕 AUTO-GENERATE SKU if not provided or invalid
    const needsSku =
      !variantData.sku ||
      variantData.sku.trim() === "" ||
      variantData.sku === "string";

    if (needsSku) {
      variantData.sku = this.generateSKU(product, variantData.attributes);
    }

    // 🆕 CHECK UNIQUENESS with retry
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const existing = await ProductVariant.findOne({
        where: {
          sku: { [Op.like]: variantData.sku }  // Now Op is defined
        },
      });

      if (!existing) break;

      // Collision - regenerate
      variantData.sku = this.generateSKU(product, variantData.attributes);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new ApiError(
        500,
        "Unable to generate unique SKU after multiple attempts",
      );
    }

    // 🆕 DYNAMIC PRICE CALCULATION
    if (variantData.attributes && typeof variantData.attributes === "object") {
      const basePrice =
        parseFloat(variantData.base_price) || parseFloat(product.price) || 0;

      // Calculate impacts from ALL attributes that have priceImpact
      let totalImpact = 0;
      const impactBreakdown = {};

      for (const [key, attr] of Object.entries(variantData.attributes)) {
        if (
          attr &&
          typeof attr === "object" &&
          attr.priceImpact !== undefined
        ) {
          const impact = parseFloat(attr.priceImpact) || 0;
          totalImpact += impact;
          impactBreakdown[`${key}Impact`] = impact; // e.g., colorImpact, resolutionImpact
        }
      }

      const calculatedPrice = basePrice + totalImpact;

      // Set pricing fields
      variantData.calculated_price = calculatedPrice;
      variantData.final_price =
        variantData.override_price && variantData.override_price > 0
          ? variantData.override_price
          : calculatedPrice;
      variantData.price = variantData.final_price;

      // Set override_price to null if 0 or not provided
      if (!variantData.override_price || variantData.override_price === 0) {
        variantData.override_price = null;
      }

      // Set compare_at_price if not provided
      if (!variantData.compare_at_price) {
        variantData.compare_at_price = basePrice;
      }

      // Build pricing_metadata with dynamic impacts
      variantData.pricing_metadata = JSON.stringify({
        basePrice: basePrice,
        ...impactBreakdown, // colorImpact, sizeImpact, resolutionImpact, etc.
        totalImpact: totalImpact,
        strategy: variantData.attributes?.capacity?.basePrice
          ? "capacity-based"
          : "dynamic-attribute-based",
        calculatedAt: new Date().toISOString(),
      });

      // 🆕 DYNAMIC: Set flat fields for all attributes with 'value'
      for (const [key, attr] of Object.entries(variantData.attributes)) {
        if (attr?.value !== undefined) {
          variantData[key] = attr.value;
        }
      }
    }

    // Handle is_default logic
    if (variantData.is_default) {
      await ProductVariant.update(
        { is_default: false },
        { where: { product_id: finalProductId } },
      );
    }

    // 🆕 CRITICAL FIX: Ensure product_id is explicitly set in create data
    const createData = {
      ...variantData,
      product_id: finalProductId,
    };

    return await ProductVariant.create(createData);
  }

  /**
 * Get all variants for a product
 */
  async getVariantsByProductId(productId) {
    return await ProductVariant.findAll({
      where: { product_id: productId },
      order: [['position', 'ASC'], ['created_at', 'DESC']]
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
        { attributes: { [Op.like]: `%${attributes.color}%` } },
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
              { attributes: { [Op.like]: `%${attributes.size}%` } },
            ],
          },
        ];
        delete whereConditions[Op.or];
      } else {
        whereConditions[Op.or] = [
          { size: attributes.size },
          { attributes: { [Op.like]: `%${attributes.size}%` } },
        ];
      }
    }

    if (attributes.capacity) {
      // Capacity peut être dans size, capacity, ou attributes JSON
      const capacityConditions = [
        { size: attributes.capacity },
        { capacity: attributes.capacity },
        { attributes: { [Op.like]: `%${attributes.capacity}%` } },
      ];

      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push({ [Op.or]: capacityConditions });
      } else if (whereConditions[Op.or]) {
        whereConditions[Op.and] = [
          { [Op.or]: whereConditions[Op.or] },
          { [Op.or]: capacityConditions },
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
    capacities, // 🆕 NOUVEAU pour électronique
    weights, // 🆕 NOUVEAU avec priceImpact
    basePrice, // 🆕 NOUVEAU
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
    if (pricingStrategy === "capacity-based" && capacities && capacities.length > 0) {
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
              sku: this.generateSKU(product, {
                capacity: { value: capacity.value },
                color: { value: color.value },
                size: { value: size.value },
                weight: { value: weight.value }
              }),
              barcode: null,
              attributes: JSON.stringify({
                color: color.value
                  ? {
                    value: color.value,
                    displayValue: color.displayValue || color.value,
                    type: color.type || "hex",
                    priceImpact: colorImpact,
                    metadata: color.metadata || {},
                  }
                  : null,
                size: size.value
                  ? {
                    value: size.value,
                    priceImpact: sizeImpact,
                  }
                  : null,
                capacity: {
                  value: capacity.value,
                  displayValue: capacity.displayValue || capacity.value,
                  basePrice: basePriceValue,
                },
                weight: null,
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
              status: "active",
              position: variantCount,
              base_price: basePriceValue, // 🆕 NOUVEAU
              calculated_price: finalPrice, // 🆕 NOUVEAU
              override_price: null, // 🆕 NOUVEAU
              pricing_metadata: JSON.stringify({
                // 🆕 NOUVEAU
                basePrice: basePriceValue,
                colorImpact: colorImpact,
                sizeImpact: sizeImpact,
                totalImpact: colorImpact + sizeImpact,
                strategy: "capacity-based",
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
      const basePriceValue =
        parseFloat(basePrice) || parseFloat(product.price) || 0;

      for (const color of colors && colors.length > 0
        ? colors
        : [{ value: null, priceImpact: 0 }]) {
        for (const size of sizes && sizes.length > 0
          ? sizes
          : [{ value: null, priceImpact: 0 }]) {
          for (const weight of weights && weights.length > 0
            ? weights
            : [{ value: null, priceImpact: 0 }]) {
            const colorImpact = parseFloat(color.priceImpact) || 0;
            const sizeImpact = parseFloat(size.priceImpact) || 0;
            const weightImpact = parseFloat(weight.priceImpact) || 0;
            const finalPrice =
              basePriceValue + colorImpact + sizeImpact + weightImpact;

            const variant = {
              id: uuidv4(),
              product_id: productId,
              sku: this.generateSKU(
                product.name,
                null,
                color.value,
                size.value,
                weight.value,
              ),
              barcode: null,
              attributes: JSON.stringify({
                color: color.value
                  ? {
                    value: color.value,
                    displayValue: color.displayValue || color.value,
                    type: color.type || "hex",
                    priceImpact: colorImpact,
                    metadata: color.metadata || {},
                  }
                  : null,
                size: size.value
                  ? {
                    value: size.value,
                    priceImpact: sizeImpact,
                  }
                  : null,
                capacity: null,
                weight: weight.value
                  ? {
                    value: weight.value,
                    label: weight.label || `${weight.value}kg`,
                    priceImpact: weightImpact,
                  }
                  : null,
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
              status: "active",
              position: variantCount,
              base_price: basePriceValue, // 🆕 NOUVEAU
              calculated_price: finalPrice, // 🆕 NOUVEAU
              override_price: null, // 🆕 NOUVEAU
              pricing_metadata: JSON.stringify({
                // 🆕 NOUVEAU
                basePrice: basePriceValue,
                colorImpact: colorImpact,
                sizeImpact: sizeImpact,
                weightImpact: weightImpact,
                totalImpact: colorImpact + sizeImpact + weightImpact,
                strategy: "modifier-based",
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
      pricingStrategy: pricingStrategy || "modifier-based",
      priceRange: {
        min: Math.min(...variants.map((v) => v.final_price)),
        max: Math.max(...variants.map((v) => v.final_price)),
      },
    };
  }

  /**
   * 🆕 UTILITAIRE: Générer un SKU unique
   */
  generateSKU(product, attributes = {}) {
    const merchantId = product.merchant_id || "00";
    const productShort = product.id.substring(0, 4).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6); // Last 6 chars
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Extract attribute codes
    const getAttrCode = (key) => {
      const val = attributes?.[key]?.value;
      return val
        ? val
          .toString()
          .substring(0, 2)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
        : "";
    };

    const colorCode = getAttrCode("color");
    const sizeCode = getAttrCode("size");
    const capacityCode = getAttrCode("capacity");

    const attrPart = [colorCode, sizeCode, capacityCode]
      .filter(Boolean)
      .join("");

    return `M${merchantId}-${productShort}${attrPart ? "-" + attrPart : ""}-${timestamp}-${random}`;
  }
}

module.exports = new VariantService();
