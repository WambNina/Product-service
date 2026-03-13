const { ProductVariant, Product } = require('../models');
const ApiError = require('../utils/apiError');

class VariantService {
  async getVariantsByProductId(productId) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    return await ProductVariant.findAll({
      where: { product_id: productId },
      order: [['created_at', 'DESC']]
    });
  }

  async createVariant(productId, variantData) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    // Vérifier si le SKU est unique
    if (variantData.sku) {
      const existingVariant = await ProductVariant.findOne({
        where: { sku: variantData.sku }
      });
      if (existingVariant) {
        throw new ApiError(400, 'Ce SKU est déjà utilisé');
      }
    }

    // Si is_default est true, désactiver les autres variantes par défaut
    if (variantData.is_default) {
      await ProductVariant.update(
        { is_default: false },
        { where: { product_id: productId } }
      );
    }

    return await ProductVariant.create({
      ...variantData,
      product_id: productId
    });
  }

  async updateVariant(variantId, variantData) {
    const variant = await ProductVariant.findByPk(variantId);
    if (!variant) {
      throw new ApiError(404, 'Variante non trouvée');
    }

    // Vérifier le SKU si modifié
    if (variantData.sku && variantData.sku !== variant.sku) {
      const existingVariant = await ProductVariant.findOne({
        where: { sku: variantData.sku }
      });
      if (existingVariant) {
        throw new ApiError(400, 'Ce SKU est déjà utilisé');
      }
    }

    // Gérer le is_default
    if (variantData.is_default && !variant.is_default) {
      await ProductVariant.update(
        { is_default: false },
        { where: { product_id: variant.product_id } }
      );
    }

    await variant.update(variantData);
    return await ProductVariant.findByPk(variantId);
  }

  async deleteVariant(variantId) {
    const variant = await ProductVariant.findByPk(variantId);
    if (!variant) {
      throw new ApiError(404, 'Variante non trouvée');
    }

    // Empêcher la suppression si c'est la seule variante par défaut
    if (variant.is_default) {
      const count = await ProductVariant.count({
        where: { product_id: variant.product_id }
      });
      if (count === 1) {
        throw new ApiError(400, 'Impossible de supprimer la seule variante par défaut');
      }
    }

    await variant.destroy();
  }
}

module.exports = new VariantService();