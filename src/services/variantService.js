const { Product, ProductVariant, ProductImage } = require("../models");
const ApiError = require("../utils/apiError");
const { v4: uuidv4 } = require("uuid");

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

    if (!product) {
      throw new ApiError(404, "Produit non trouvé");
    }

    return product;
  }

  /**
   * Create batch variants with image (Sequelize version)
   */
  async createBatchVariants({
    productId,
    colors,
    sizes,
    weight,
    price,
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

    for (let i = 0; i < colors.length; i++) {
      for (let j = 0; j < sizes.length; j++) {
        const variant = {
          id: uuidv4(),
          product_id: productId,
          sku: `SKU-${productId.toString().substring(0, 8)}-${colors[i].replace("#", "")}-${sizes[j]}`,
          color: colors[i],
          size: sizes[j],
          attributes: JSON.stringify({
            color: colors[i],
            size: sizes[j]
          }),
          weight: weight,
          price: price,
          image_url: imageUrl,
          is_default: isDefault && i === 0 && j === 0,
          quantity: 0,
          price_adjustment: 0,
          status: "active",
          created_at: new Date(),
          updated_at: new Date(),
        };

        variants.push(variant);
      }
    }

    // ✅ Sauvegarder image produit
    await ProductImage.create({
      id: uuidv4(),
      product_id: productId,
      url: imageUrl,
      filename: filename,
      original_filename: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
      is_main: isDefault,
      sort_order: 0,
      created_at: new Date(),
    });

    // ✅ Bulk insert Sequelize
    await ProductVariant.bulkCreate(variants);

    return {
      variantsCreated: variants.length,
      variants,
    };
  }
}

module.exports = new VariantService();
