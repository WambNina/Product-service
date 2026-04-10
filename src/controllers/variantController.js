const variantService = require("../services/variantService");
const pricingService = require("../services/pricingService");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const { Product, ProductVariant } = require("../models");
const { Op } = require("sequelize");
const { nanoid } = require('nanoid');

/**
 * Get all variants for a product
 */
exports.getProductVariants = catchAsync(async (req, res) => {
  const { id } = req.params;
  const variants = await variantService.getVariantsByProductId(id);

  const enrichedVariants = variants.map((variant) => ({
    ...variant.toJSON(),
    price_breakdown: pricingService.calculateBreakdown(variant),
  }));

  res.status(200).json({
    success: true,
    count: enrichedVariants.length,
    data: enrichedVariants,
  });
});

/**
 * Create single variant
 */
exports.createVariant = catchAsync(async (req, res) => {
  const { id } = req.params;

  const variantData = {
    ...req.body,
    product_id: id,
  };

  // 🆕 AUTO-GENERATE SKU if empty or placeholder
  const needsSku = !variantData.sku ||
    variantData.sku.trim() === '' ||
    variantData.sku === 'string';

  if (needsSku) {
    const product = await Product.findByPk(id, {
      attributes: ['id', 'name', 'merchant_id', 'price'] // Ensure merchant_id is fetched
    });

    if (!product) {
      throw new ApiError("Product not found", 404);
    }

    // Generate SKU using product + attributes
    variantData.sku = generateSKU(product, variantData.attributes);
  }

  // 🆕 CHECK UNIQUENESS (case-insensitive)
  if (variantData.sku) {
    const existingVariant = await ProductVariant.findOne({
      where: {
        sku: { [Op.like]: variantData.sku }  // Now Op is defined
      },
    });

    if (existingVariant) {
      // If collision, regenerate with new random
      variantData.sku = generateSKU(product, variantData.attributes);
    }
  }

  const variant = await variantService.createVariant(id, variantData);

  // 🆕 DYNAMIC: Build price breakdown from all attributes
  const attributes =
    typeof variant.attributes === "string"
      ? JSON.parse(variant.attributes)
      : variant.attributes;

  const priceBreakdown = {
    base: parseFloat(variant.base_price) || 0,
    is_override: !!(variant.override_price && variant.override_price > 0),
    override_price: variant.override_price || null,
    final_price: parseFloat(variant.final_price),
    total_impact: 0,
  };

  // Add all attribute modifiers dynamically
  for (const [key, attr] of Object.entries(attributes)) {
    if (attr?.priceImpact !== undefined) {
      const modifierKey = `${key}_modifier`;
      priceBreakdown[modifierKey] = parseFloat(attr.priceImpact) || 0;
      priceBreakdown.total_impact += priceBreakdown[modifierKey];
    }
  }

  const pricingMetadata =
    typeof variant.pricing_metadata === "string"
      ? JSON.parse(variant.pricing_metadata)
      : variant.pricing_metadata;

  res.status(201).json({
    success: true,
    message: "Variante créée avec succès",
    data: {
      id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      barcode: variant.barcode,
      attributes: attributes,
      ...Object.fromEntries(
        Object.entries(attributes)
          .filter(([_, attr]) => attr?.value !== undefined)
          .map(([key, attr]) => [key, attr.value]),
      ),
      base_price: parseFloat(variant.base_price),
      calculated_price: parseFloat(variant.calculated_price),
      final_price: parseFloat(variant.final_price),
      price: parseFloat(variant.final_price),
      compare_at_price:
        parseFloat(variant.compare_at_price) || parseFloat(variant.base_price),
      override_price: variant.override_price,
      quantity: variant.quantity,
      weight: variant.weight,
      image_url: variant.image_url,
      is_default: variant.is_default,
      status: variant.status,
      position: variant.position,
      price_breakdown: priceBreakdown,
      pricing_metadata: pricingMetadata,
      created_at: variant.created_at,
      updated_at: variant.updated_at,
    },
  });
});

/**
 * Create batch variants with image - CORRIGÉ
 */
exports.createBatchVariants = catchAsync(async (req, res) => {
  const productId = req.params.id;

  console.log("🔥 Batch variant creation started");
  console.log("Product ID:", productId);

  // 🆕 Parser les champs JSON
  let colors = parseJSONField(req.body.colors, []);
  let sizes = parseJSONField(req.body.sizes, []);
  let capacities = parseJSONField(req.body.capacities, []);
  let weights = parseJSONField(req.body.weights, []);

  // Rétrocompatibilité : convertir strings en objets
  if (colors.length === 0 && req.body.colors) {
    let legacyColors = Array.isArray(req.body.colors)
      ? req.body.colors
      : [req.body.colors];
    colors = legacyColors
      .filter((c) => c && c.trim() !== "")
      .map((c) => ({
        value: c,
        displayValue: c,
        type: c.startsWith("#") ? "hex" : "text",
        priceImpact: 0,
        metadata: c.startsWith("#") ? { hex: c } : {},
      }));
  }

  if (sizes.length === 0 && req.body.sizes) {
    let legacySizes = Array.isArray(req.body.sizes)
      ? req.body.sizes
      : [req.body.sizes];
    sizes = legacySizes
      .filter((s) => s && s.trim() !== "")
      .map((s) => ({
        value: s,
        priceImpact: 0,
      }));
  }

  // Déterminer stratégie pricing
  const pricingStrategy =
    req.body.pricingStrategy ||
    (capacities.length > 0 ? "capacity-based" : "modifier-based");

  // Validation
  if (!req.file) {
    throw new ApiError("Image is required", 400);
  }

  if (colors.length === 0) {
    cleanupFile(req.file);
    throw new ApiError("At least one color must be selected", 400);
  }

  if (capacities.length === 0 && sizes.length === 0 && weights.length === 0) {
    cleanupFile(req.file);
    throw new ApiError(
      "At least one size or weight must be selected (or use capacities for electronics)",
      400,
    );
  }

  // 🆕 Vérifier que le produit existe
  const product = await Product.findByPk(productId);
  if (!product) {
    cleanupFile(req.file);
    throw new ApiError("Product not found", 404);
  }

  console.log("✅ Produit trouvé:", product.name);

  const imageUrl = `/uploads/products/${req.file.filename}`;

  // 🆕 Création des variants selon la stratégie
  let result;

  if (pricingStrategy === "capacity-based" && capacities.length > 0) {
    // Mode Électronique
    result = await createElectronicVariants({
      product,
      productId,
      capacities,
      colors,
      sizes: sizes.length > 0 ? sizes : [{ value: null, priceImpact: 0 }],
      weights: weights.length > 0 ? weights : [{ value: null, priceImpact: 0 }],
      imageUrl,
      isDefault: req.body.is_default === "true" || req.body.is_default === true,
      file: req.file,
    });
  } else {
    // Mode Standard
    const basePrice =
      parseFloat(req.body.price) || parseFloat(product.price) || 0;

    result = await createStandardVariants({
      product,
      productId,
      colors,
      sizes: sizes.length > 0 ? sizes : [{ value: null, priceImpact: 0 }],
      weights:
        weights.length > 0
          ? weights
          : [{ value: parseFloat(req.body.weight) || 0, priceImpact: 0 }],
      basePrice,
      imageUrl,
      isDefault: req.body.is_default === "true" || req.body.is_default === true,
      file: req.file,
    });
  }

  res.status(201).json({
    success: true,
    message: `Image uploaded and ${result.variantsCreated} variants created successfully`,
    data: {
      product_id: productId,
      image_url: imageUrl,
      filename: req.file.filename,
      pricing_strategy: pricingStrategy,
      variants_created: result.variantsCreated,
      price_range: result.priceRange,
      variants: result.variants,
    },
  });
});

/**
 * Calculate price for selected attributes
 */
exports.calculatePrice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { attributes, quantity = 1 } = req.body;

  const product = await Product.findByPk(id);
  if (!product) {
    throw new ApiError('Product not found', 404);
  }

  // 🆕 FIX: Only search in known flat columns, dynamic attrs go in JSON search
  const knownFlatColumns = ['color', 'size', 'capacity', 'weight', 'material', 'pattern'];

  const whereConditions = {
    product_id: id,
    status: 'active'
  };

  const orConditions = [];

  for (const [key, value] of Object.entries(attributes)) {
    if (!value) continue;

    // 🆕 Only add flat column condition if it's a known column
    if (knownFlatColumns.includes(key)) {
      orConditions.push({ [key]: value });
    }

    // Always search in JSON attributes (for both known and dynamic attrs)
    orConditions.push({
      attributes: { [Op.like]: `%"${key}":{"value":"${value}"%` }
    });
    orConditions.push({
      attributes: { [Op.like]: `%"${key}":{"value":"${value}",%` }
    });
    // Also match without quotes for numbers
    orConditions.push({
      attributes: { [Op.like]: `%"${key}":{"value":${value}%` }
    });
  }

  if (orConditions.length > 0) {
    whereConditions[Op.or] = orConditions;
  }

  const existingVariant = await ProductVariant.findOne({
    where: whereConditions,
    order: [['final_price', 'ASC']]
  });

  // 🆕 FIX: Calculate price even if no variant found
  let unitPrice;
  let calculation;

  if (existingVariant) {
    unitPrice = parseFloat(existingVariant.final_price);
    calculation = {
      basePrice: parseFloat(existingVariant.base_price),
      modifiers: parsePricingMetadata(existingVariant.pricing_metadata),
      modifiersTotal: parseFloat(existingVariant.calculated_price) - parseFloat(existingVariant.base_price),
      finalPrice: unitPrice,
      calculation: `Base: ${existingVariant.base_price} + Modifiers = ${unitPrice}`
    };
  } else {
    // 🆕 CALCULATE from product + attribute impacts
    const basePrice = parseFloat(product.price) || 0;

    // Get all variants to extract attribute definitions with price impacts
    const allVariants = await ProductVariant.findAll({
      where: { product_id: id },
      limit: 10
    });

    // Extract unique attribute definitions with their price impacts
    const attributeDefs = extractAttributeDefinitions(allVariants);

    // Calculate modifiers from requested attributes
    const modifiers = [];
    let modifiersTotal = 0;

    for (const [key, value] of Object.entries(attributes)) {
      const attrDef = findAttributeDefinition(attributeDefs, key, value);
      if (attrDef?.priceImpact) {
        const impact = parseFloat(attrDef.priceImpact);
        modifiers.push({
          attribute: key,
          value: value,
          impact: impact
        });
        modifiersTotal += impact;
      }
    }

    unitPrice = basePrice + modifiersTotal;
    calculation = {
      basePrice: basePrice,
      modifiers: modifiers,
      modifiersTotal: modifiersTotal,
      finalPrice: unitPrice,
      calculation: `Base: ${basePrice} + Modifiers (${modifiersTotal}) = ${unitPrice}`
    };
  }

  const totalPrice = unitPrice * quantity;

  res.status(200).json({
    success: true,
    data: {
      product_id: id,
      selected_attributes: attributes,
      existing_variant: existingVariant ? {
        id: existingVariant.id,
        sku: existingVariant.sku,
        stock: existingVariant.quantity
      } : null,
      price_breakdown: calculation,
      quantity: quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      formatted_price: formatPrice(totalPrice)
    }
  });
});

// 🆕 Helper functions
function parsePricingMetadata(metadata) {
  if (!metadata) return [];
  try {
    const parsed =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    return Object.entries(parsed)
      .filter(([key]) => key.endsWith("Impact") && key !== "totalImpact")
      .map(([key, value]) => ({
        attribute: key.replace("Impact", ""),
        impact: value,
      }));
  } catch {
    return [];
  }
}

function extractAttributeDefinitions(variants) {
  const defs = [];
  for (const variant of variants) {
    try {
      const attrs =
        typeof variant.attributes === "string"
          ? JSON.parse(variant.attributes)
          : variant.attributes;

      for (const [key, attr] of Object.entries(attrs)) {
        if (attr?.value && attr?.priceImpact !== undefined) {
          defs.push({
            key,
            value: attr.value,
            displayValue: attr.displayValue,
            priceImpact: attr.priceImpact,
          });
        }
      }
    } catch {
      continue;
    }
  }
  return defs;
}

function findAttributeDefinition(defs, key, value) {
  // Try exact match first
  let match = defs.find(
    (d) =>
      d.key.toLowerCase() === key.toLowerCase() &&
      d.value.toLowerCase() === value.toLowerCase(),
  );

  // Fallback: match by key only (first occurrence)
  if (!match) {
    match = defs.find((d) => d.key.toLowerCase() === key.toLowerCase());
  }

  return match;
}

/**
 * Get price matrix
 */
exports.getPriceMatrix = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findByPk(id);
  if (!product) {
    throw new ApiError("Product not found", 404);
  }

  const variants = await ProductVariant.findAll({ where: { product_id: id } });

  const matrix = variants.map((variant) => ({
    combination: {
      color: variant.color,
      size: variant.size,
      capacity: variant.capacity,
    },
    sku: variant.sku,
    price: variant.final_price,
    stock: variant.quantity,
    in_stock: variant.quantity > 0,
    is_default: variant.is_default,
  }));

  const prices = matrix.map((m) => m.price).filter((p) => p);

  res.status(200).json({
    success: true,
    data: {
      product_id: id,
      product_name: product.name,
      total_combinations: matrix.length,
      price_range:
        prices.length > 0
          ? {
            min: Math.min(...prices),
            max: Math.max(...prices),
          }
          : null,
      matrix,
    },
  });
});

/**
 * Get single variant by ID
 * GET /api/v1/variants/:variantId
 */
exports.getVariantById = catchAsync(async (req, res) => {
  const { variantId } = req.params;

  const variant = await ProductVariant.findByPk(variantId, {
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["id", "name", "price", "merchant_id", "store_id"],
      },
    ],
  });

  if (!variant) {
    throw new ApiError("Variant not found", 404);
  }

  res.status(200).json({
    success: true,
    data: {
      id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      barcode: variant.barcode,
      attributes: parseJSONField(variant.attributes),
      color: variant.color,
      size: variant.size,
      capacity: variant.capacity,
      price_adjustment: variant.price_adjustment,
      final_price: variant.final_price,
      price: variant.price,
      compare_at_price: variant.compare_at_price,
      quantity: variant.quantity,
      weight: variant.weight,
      image_url: variant.image_url,
      is_default: variant.is_default,
      status: variant.status,
      product: variant.product,
      price_breakdown: pricingService.calculateBreakdown(variant),
      created_at: variant.created_at,
      updated_at: variant.updated_at,
    },
  });
});

/**
 * Update variant
 */
exports.updateVariant = catchAsync(async (req, res) => {
  const { variantId } = req.params;

  const variant = await ProductVariant.findByPk(variantId);
  if (!variant) {
    throw new ApiError("Variant not found", 404);
  }

  // Recalculer prix si attributs changent
  if (req.body.attributes) {
    const product = await Product.findByPk(variant.product_id);

    const merged = {
      color: req.body.attributes.color || variant.attributes?.color,
      size: req.body.attributes.size || variant.attributes?.size,
      weight: req.body.attributes.weight || variant.attributes?.weight,
      capacity: req.body.attributes.capacity || variant.attributes?.capacity,
    };

    const basePrice = merged.capacity?.basePrice || product.price;
    const colorImpact = merged.color?.priceImpact || 0;
    const sizeImpact = merged.size?.priceImpact || 0;
    const weightImpact = merged.weight?.priceImpact || 0;

    req.body.calculated_price =
      basePrice + colorImpact + sizeImpact + weightImpact;

    if (!req.body.override_price) {
      req.body.final_price = req.body.calculated_price;
    }
  }

  await variant.update(req.body);

  const updated = await ProductVariant.findByPk(variantId);

  res.status(200).json({
    success: true,
    message: "Variant updated",
    data: updated,
  });
});

/**
 * Update variant price (override)
 */
exports.updateVariantPrice = catchAsync(async (req, res) => {
  const { variantId } = req.params;
  const { price, reason } = req.body;

  const variant = await ProductVariant.findByPk(variantId);
  if (!variant) {
    throw new ApiError("Variant not found", 404);
  }

  const oldPrice = variant.final_price;

  await variant.update({
    override_price: price,
    final_price: price,
  });

  res.status(200).json({
    success: true,
    data: {
      variant_id: variantId,
      previous_price: oldPrice,
      new_price: price,
      calculated_price: variant.calculated_price,
      override_price: price,
      reason: reason || "manual_override",
    },
  });
});

/**
 * Delete variant
 */
exports.deleteVariant = catchAsync(async (req, res) => {
  const { variantId } = req.params;

  const variant = await ProductVariant.findByPk(variantId);
  if (!variant) {
    throw new ApiError("Variant not found", 404);
  }

  if (variant.is_default) {
    const count = await ProductVariant.count({
      where: { product_id: variant.product_id },
    });

    if (count <= 1) {
      throw new ApiError("Cannot delete the last variant", 400);
    }
  }

  await variant.destroy();

  res.status(200).json({
    success: true,
    message: "Variant deleted",
  });
});

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

function parseJSONField(field, defaultValue = []) {
  if (!field) return defaultValue;
  try {
    if (typeof field === "string") {
      return JSON.parse(field);
    }
    return field;
  } catch (e) {
    console.warn("Failed to parse JSON field:", field);
    return defaultValue;
  }
}

function cleanupFile(file) {
  if (file && file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

async function createElectronicVariants({
  product,
  productId,
  capacities,
  colors,
  sizes,
  weights,
  imageUrl,
  isDefault,
  file,
}) {
  const variants = [];
  let variantCount = 0;

  for (const capacity of capacities) {
    for (const color of colors) {
      for (const size of sizes) {
        for (const weight of weights) {
          const basePrice =
            parseFloat(capacity.basePrice) || parseFloat(product.price) || 0;
          const colorImpact = parseFloat(color.priceImpact) || 0;
          const sizeImpact = parseFloat(size.priceImpact) || 0;
          const weightImpact = parseFloat(weight.priceImpact) || 0;

          const finalPrice =
            basePrice + colorImpact + sizeImpact + weightImpact;

          const variant = {
            id: uuidv4(),
            product_id: productId,
            sku: generateSKU(
              product.name,
              capacity.value,
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
              capacity: {
                value: capacity.value,
                displayValue: capacity.displayValue || capacity.value,
                basePrice: basePrice,
              },
              weight: weight.value
                ? {
                  value: weight.value,
                  label: weight.label || `${weight.value}kg`,
                  priceImpact: weightImpact,
                }
                : null,
            }),
            color: color.value || null,
            size: size.value || capacity.value,
            capacity: capacity.value,
            material: null,
            pattern: null,
            price_adjustment: colorImpact + sizeImpact + weightImpact,
            final_price: finalPrice,
            price: finalPrice,
            compare_at_price: finalPrice,
            quantity: 0,
            weight: weight.value || null,
            image_id: null,
            image_url: imageUrl,
            is_default: isDefault && variantCount === 0,
            status: "active",
            position: variantCount,
            base_price: basePrice,
            calculated_price: finalPrice,
            override_price: null,
            pricing_metadata: JSON.stringify({
              basePrice: basePrice,
              colorImpact: colorImpact,
              sizeImpact: sizeImpact,
              weightImpact: weightImpact,
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

  await ProductVariant.bulkCreate(variants);

  // Créer l'image produit
  await createProductImage(
    productId,
    variants[0]?.id,
    imageUrl,
    file,
    isDefault,
  );

  const prices = variants.map((v) => v.final_price);

  return {
    variantsCreated: variants.length,
    variants,
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices),
    },
  };
}

async function createStandardVariants({
  product,
  productId,
  colors,
  sizes,
  weights,
  basePrice,
  imageUrl,
  isDefault,
  file,
}) {
  const variants = [];
  let variantCount = 0;

  for (const color of colors) {
    for (const size of sizes) {
      for (const weight of weights) {
        const colorImpact = parseFloat(color.priceImpact) || 0;
        const sizeImpact = parseFloat(size.priceImpact) || 0;
        const weightImpact = parseFloat(weight.priceImpact) || 0;

        const finalPrice = basePrice + colorImpact + sizeImpact + weightImpact;

        const variant = {
          id: uuidv4(),
          product_id: productId,
          sku: generateSKU(
            product.name,
            null,
            color.value,
            size.value,
            weight.value,
          ),
          barcode: null,
          attributes: JSON.stringify({
            color: {
              value: color.value,
              displayValue: color.displayValue || color.value,
              type: color.type || "hex",
              priceImpact: colorImpact,
              metadata: color.metadata || {},
            },
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
          color: color.value,
          size: size.value,
          capacity: null,
          material: null,
          pattern: null,
          price_adjustment: colorImpact + sizeImpact + weightImpact,
          final_price: finalPrice,
          price: finalPrice,
          compare_at_price: finalPrice,
          quantity: 0,
          weight: weight.value || null,
          image_id: null,
          image_url: imageUrl,
          is_default: isDefault && variantCount === 0,
          status: "active",
          position: variantCount,
          base_price: basePrice,
          calculated_price: finalPrice,
          override_price: null,
          pricing_metadata: JSON.stringify({
            basePrice: basePrice,
            colorImpact: colorImpact,
            sizeImpact: sizeImpact,
            weightImpact: weightImpact,
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

  await ProductVariant.bulkCreate(variants);

  // Créer l'image produit
  await createProductImage(
    productId,
    variants[0]?.id,
    imageUrl,
    file,
    isDefault,
  );

  const prices = variants.map((v) => v.final_price);

  return {
    variantsCreated: variants.length,
    variants,
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices),
    },
  };
}

async function createProductImage(
  productId,
  variantId,
  imageUrl,
  file,
  isDefault,
) {
  const { ProductImage } = require("../models");

  if (!file) return;

  await ProductImage.create({
    id: uuidv4(),
    product_id: productId,
    variant_id: variantId,
    url: imageUrl,
    filename: file.filename,
    original_filename: file.originalname,
    mime_type: file.mimetype,
    size_bytes: file.size,
    is_primary: isDefault,
    sort_order: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

function generateSKU(product, variantAttributes = {}) {
  const merchantId = product.merchant_id || '00';
  const productShort = product.id.substring(0, 4).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase(); // Base36 timestamp
  const random = nanoid(4).toUpperCase(); // 4-char random suffix

  // Build attribute suffix for readability (optional)
  const attrParts = [];
  if (variantAttributes.color?.value) {
    attrParts.push(cleanString(variantAttributes.color.value, 2));
  }
  if (variantAttributes.size?.value) {
    attrParts.push(cleanString(variantAttributes.size.value, 2));
  }

  const attrSuffix = attrParts.length > 0 ? `-${attrParts.join('')}` : '';

  return `M${merchantId}-${productShort}${attrSuffix}-${timestamp}-${random}`;
}

// Helper function
function cleanString(str, length = 3) {
  if (!str) return '';
  return str
    .toString()
    .substring(0, length)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatPrice(price) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}
