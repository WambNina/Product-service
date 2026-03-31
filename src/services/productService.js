const { Op } = require("sequelize");
const { Category, Stock, StockMovement } = require('../models');
const ApiError = require('../utils/apiError');
const stockService = require('./stockService');
const axios = require('axios');

const SERVICES = {
  STORE: process.env.STORE_SERVICE_URL || 'http://localhost:3000',
  MEDIA: process.env.MEDIA_SERVICE_URL || 'http://localhost:4002',
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:3001'
};

const {
  Product,
  ProductVariant,
  ProductImage,
  ProductAttribute,
} = require("../models");
const models = require("../models");
console.log("Loaded models:", Object.keys(models));
console.log("ProductVariant:", models.ProductVariant);
console.log("ProductImage:", models.ProductImage);
console.log("ProductAttribute:", models.ProductAttribute);


class ProductService {

   /**
   * Vérifier si un store existe via le Store Service
   */
  async validateStore(storeId, authToken) {
    try {
      const response = await axios.get(
        `${SERVICES.STORE}/api/v1/stores/${storeId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 5000
        }
      );
      return response.data.success ? response.data.data : null;
    } catch (error) {
      console.error('❌ Store Service Error:', error.message);
      throw new Error('Store service unavailable');
    }
  }

  /**
   * Vérifier si un merchant existe via Auth Service
   */
  async validateMerchant(merchantId, authToken) {
    try {
      const response = await axios.get(
        `${SERVICES.AUTH}/api/v1/auth/merchants/${merchantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 5000
        }
      );
      return response.data.success ? response.data.data : null;
    } catch (error) {
      console.error('❌ Auth Service Error:', error.message);
      throw new Error('Auth service unavailable');
    }
  }

  /**
   * Créer un produit avec validation cross-service
   */
  async createProductWithValidation(productData, authToken) {
    // 1. Valider le store
    const store = await this.validateStore(productData.store_id, authToken);
    if (!store) {
      throw new Error('Store not found or inactive');
    }

    // 2. Valider le merchant
    const merchant = await this.validateMerchant(productData.merchant_id, authToken);
    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // 3. Vérifier que le merchant possède bien ce store
    if (store.merchant_id !== productData.merchant_id) {
      throw new Error('Store does not belong to this merchant');
    }

    // 4. Créer le produit
    const product = await Product.create({
      ...productData,
      status: 'draft'
    });

    // 5. Notifier le Store Service (event-driven)
    await this.notifyStoreService('PRODUCT_CREATED', {
      product_id: product.id,
      store_id: product.store_id,
      merchant_id: product.merchant_id
    });

    return product;
  }

  /**
   * Associer des médias à un produit via Media Service
   */
  async associateMedia(productId, mediaIds, authToken) {
    try {
      const response = await axios.post(
        `${SERVICES.MEDIA}/api/v1/media/associate`,
        {
          entity_type: 'product',
          entity_id: productId,
          media_ids: mediaIds
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 10000
        }
      );
      
      // Mettre à jour le produit avec les URLs des médias
      if (response.data.success) {
        await Product.update(
          { 
            images: response.data.data.urls,
            has_variants: true 
          },
          { where: { id: productId } }
        );
      }
      
      return response.data.data;
    } catch (error) {
      console.error('❌ Media Service Error:', error.message);
      throw new Error('Failed to associate media');
    }
  }

  /**
   * Récupérer les médias d'un produit
   */
  async getProductMedia(productId, authToken) {
    try {
      const response = await axios.get(
        `${SERVICES.MEDIA}/api/v1/media/product/${productId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 5000
        }
      );
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('❌ Media Service Error:', error.message);
      return []; // Retourne vide si service indisponible
    }
  }

  /**
   * Notifier un autre service (event-driven)
   */
  async notifyStoreService(event, data) {
    try {
      await axios.post(
        `${SERVICES.STORE}/api/v1/internal/events`,
        { event, data },
        { timeout: 5000 }
      );
    } catch (error) {
      console.error('❌ Failed to notify store service:', error.message);
      // Ne pas bloquer si la notification échoue
    }
  }

  /**
   * Récupérer un produit enrichi avec données des autres services
   */
  async getEnrichedProduct(productId, authToken) {
    const product = await Product.findByPk(productId, {
      include: [{ model: ProductVariant, as: 'variants' }]
    });

    if (!product) return null;

    // Récupérer les données du store en parallèle
    const [storeData, mediaData] = await Promise.allSettled([
      this.validateStore(product.store_id, authToken),
      this.getProductMedia(productId, authToken)
    ]);

    return {
      ...product.toJSON(),
      store: storeData.status === 'fulfilled' ? storeData.value : null,
      media: mediaData.status === 'fulfilled' ? mediaData.value : [],
      _meta: {
        store_loaded: storeData.status === 'fulfilled',
        media_loaded: mediaData.status === 'fulfilled'
      }
    };
  }
  
  async checkProductLimit(merchantId) {
    const count = await Product.count({
      where: {
        merchant_id: merchantId,
        status: { [Op.notIn]: ["archived", "payment_expired"] },
      },
    });

    return {
      current_count: count,
      free_limit: 5,
      has_reached_limit: count >= 5,
      remaining_free: Math.max(0, 5 - count),
      requires_payment: count >= 5,
    };
  }

  async createProduct(productData, files) {
    const transaction = await require("../config/database").sequelize.transaction();
    
    try {
      console.log("Creating product with data:", productData);
      
      // Check product limit first
      const limitCheck = await this.checkProductLimit(productData.merchant_id);
      if (limitCheck.has_reached_limit) {
        throw new Error("Product limit reached. Please upgrade your plan.");
      }
      
      // Convert price to number if it's a string
      if (productData.price && typeof productData.price === 'string') {
        productData.price = parseFloat(productData.price);
      }
      
      // Convert quantity to number
      if (productData.quantity && typeof productData.quantity === 'string') {
        productData.quantity = parseInt(productData.quantity);
      }
      
      // Ensure merchant_id and store_id are present
      if (!productData.merchant_id) {
        throw new Error("merchant_id is required");
      }
      if (!productData.store_id) {
        throw new Error("store_id is required");
      }
      
      // Create the product
      const product = await Product.create(productData, { transaction });
      
      // Handle image uploads if files exist
      if (files && files.length > 0) {
        const imageRecords = files.map((file, index) => ({
          product_id: product.id,
          url: `/uploads/products/${file.filename}`,
          filename: file.filename,
          original_filename: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          position: index,
          is_main: index === 0 // First image is main
        }));
        
        await ProductImage.bulkCreate(imageRecords, { transaction });
      }
      
      await transaction.commit();
      // Initialize stock with quantity from product data
    try {
      await stockService.initializeStock(
        product.id, 
        productData.quantity || 0,
        productData.merchant_id
      );
    } catch (stockError) {
      console.error('Failed to initialize stock:', stockError.message);
      // Don't fail the request if stock init fails, just log it
    }
    
    console.log("Product created successfully:", product.id);
    return product;
    
  } catch (error) {
    await transaction.rollback();
    console.error("Transaction error in createProduct:", error.message);
    throw error;
  }
}

  extractVariantAttributes(variants) {
    const attributes = new Set();
    variants.forEach((variant) => {
      if (variant.attributes) {
        Object.keys(variant.attributes).forEach((key) => attributes.add(key));
      }
    });
    return Array.from(attributes);
  }

  

  async processProductImages(
    files,
    productId,
    variantId = null,
    transaction = null,
  ) {
    const sharp = require("sharp");
    const path = require("path");
    const fs = require("fs").promises;
    const { v4: uuidv4 } = require("uuid");

    const processedImages = [];

    for (const file of files) {
      const id = uuidv4();
      const ext = path.extname(file.originalname).toLowerCase();
      const baseName = `${id}${ext}`;

      const ownerDir = path.join(
        __dirname,
        "../../uploads/products",
        productId,
      );
      await fs.mkdir(ownerDir, { recursive: true });

      const processor = sharp(file.buffer);
      const imageInfo = await processor.metadata();

      const sizes = {
        thumbnail: { width: 150, height: 150, fit: "cover" },
        small: { width: 300, height: 300, fit: "inside" },
        medium: { width: 600, height: 600, fit: "inside" },
        large: { width: 1200, height: 1200, fit: "inside" },
      };

      const urls = {
        original: `/uploads/products/${productId}/original-${baseName}`,
      };

      await processor.toFile(path.join(ownerDir, `original-${baseName}`));

      for (const [sizeName, dimensions] of Object.entries(sizes)) {
        const sizeFileName = `${id}_${sizeName}${ext}`;
        const sizePath = path.join(ownerDir, sizeFileName);

        await processor
          .clone()
          .resize(dimensions.width, dimensions.height, {
            fit: dimensions.fit,
            withoutEnlargement: true,
          })
          .toFile(sizePath);

        urls[`${sizeName}_url`] =
          `/uploads/products/${productId}/${sizeFileName}`;
      }

      if ([".jpg", ".jpeg", ".png"].includes(ext)) {
        const webpName = `${id}.webp`;
        await processor
          .clone()
          .webp({ quality: 85 })
          .toFile(path.join(ownerDir, webpName));
        urls.webp = `/uploads/products/${productId}/${webpName}`;
      }

      const imageRecord = await ProductImage.create(
        {
          id,
          product_id: productId,
          variant_id: variantId,
          filename: baseName,
          original_filename: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          url: urls.original,
          thumbnail_url: urls.thumbnail_url,
          medium_url: urls.medium_url,
          large_url: urls.large_url,
          width: imageInfo.width,
          height: imageInfo.height,
          position: processedImages.length,
          source: file.source || "upload",
        },
        { transaction },
      );

      processedImages.push(imageRecord);
    }

    return processedImages;
  }

  async processWhatsAppMediaGroup(mediaGroupId, productId, transaction) {
    console.log(
      `Processing WhatsApp media group ${mediaGroupId} for product ${productId}`,
    );
  }

  async getProductById(productId, includeExpired = false) {
  const where = { id: productId };
  if (!includeExpired) {
    where.status = { [Op.not]: "payment_expired" };
  }

  // Build include array only for models that exist
  const include = [];
  
  if (ProductVariant) {
    include.push({ model: ProductVariant, as: "variants" });
  }
  if (ProductImage) {
    include.push({ model: ProductImage, as: "images" });
  }
  if (ProductAttribute) {
    include.push({ model: ProductAttribute, as: "attributes" });
  }

  const product = await Product.findOne({
    where,
    include: include.length > 0 ? include : undefined,
  });

  if (!product) return null;

  // Check if product has checkPaymentStatus method before calling it
  if (typeof product.checkPaymentStatus === 'function') {
    const paymentStatus = product.checkPaymentStatus();
    if (!paymentStatus.valid && product.status !== "payment_expired") {
      await this.handleExpiredPayment(product);
      product.status = "payment_expired";
      product.visibility = "hidden";
    }
  }

  return product;
}

  async handleExpiredPayment(product) {
    await Product.update(
      { status: "payment_expired", visibility: "hidden" },
      { where: { id: product.id } },
    );

    await this.notifyMerchant(product.merchant_id, "payment_expired", {
      product_id: product.id,
      product_name: product.name,
    });
  }

 async updateProduct(productId, updateData, files = []) {
  const transaction = await require("../config/database").sequelize.transaction();

  try {
    const product = await Product.findByPk(productId, { transaction });
    if (!product) throw new Error("Product not found");

    if (
      updateData.payment_plan &&
      updateData.payment_plan !== product.payment_plan
    ) {
      if (updateData.payment_plan === "free") {
        const limitCheck = await this.checkProductLimit(product.merchant_id);
        if (limitCheck.current_count > 5) {
          throw new Error(
            "Cannot downgrade to free plan: you have more than 5 products",
          );
        }
      }
      updateData.is_free_tier = updateData.payment_plan === "free";
    }

    await product.update(updateData, { transaction });

    if (updateData.variants) {
      const variantIds = updateData.variants
        .filter((v) => v.id)
        .map((v) => v.id);
      await ProductVariant.destroy({
        where: { product_id: productId, id: { [Op.notIn]: variantIds } },
        transaction,
      });

      for (const variant of updateData.variants) {
        if (variant.id) {
          await ProductVariant.update(variant, {
            where: { id: variant.id },
            transaction,
          });
        } else {
          await ProductVariant.create(
            { ...variant, product_id: productId },
            { transaction },
          );
        }
      }
    }

    if (files && files.length > 0) {
      const currentImageCount = await ProductImage.count({
        where: { product_id: productId },
        transaction, // Add transaction here for consistency
      });
      const remainingSlots = Math.max(0, 5 - currentImageCount);

      if (remainingSlots > 0) {
        await this.processProductImages(
          files.slice(0, remainingSlots),
          productId,
          null,
          transaction,
        );
      }
    }

    await transaction.commit();

    // Fetch updated product AFTER commit, without passing transaction
    // Wrap in try-catch so errors here don't trigger rollback
    try {
      const updatedProduct = await this.getProductById(productId);
      return updatedProduct;
    } catch (fetchError) {
      console.error("Error fetching updated product:", fetchError.message);
      // Return basic product data if fetch fails
      return product;
    }

  } catch (error) {
    // Only rollback if transaction hasn't been finished
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
}

  async getAllProducts(filters = {}, pagination = { page: 1, limit: 20 }) {
  const { Op } = require("sequelize");
  const where = {};

  // Remove undefined/null filters
  Object.keys(filters).forEach(key => {
    if (filters[key] === undefined || filters[key] === null) {
      delete filters[key];
    }
  });

  // Filtres de base
  if (filters.merchant_id) where.merchant_id = filters.merchant_id;
  if (filters.store_id) where.store_id = filters.store_id;
  if (filters.category_id) where.category_id = filters.category_id;
  if (filters.weight) where.weight = filters.weight;
  if (filters.status) where.status = filters.status;

  // Filtre sur la plage de prix (price)
  if (filters.min_price || filters.max_price) {
    where.price = {};
    if (filters.min_price)
      where.price[Op.gte] = parseFloat(filters.min_price);
    if (filters.max_price)
      where.price[Op.lte] = parseFloat(filters.max_price);
  }

  // Filtre sur les couleurs
  if (filters.colors) {
    const colorList = filters.colors.split(",");
    where.colors = { [Op.overlap]: colorList };
  }

  const offset = (pagination.page - 1) * pagination.limit;

  // Build include array only for models that exist
  const include = [];
  if (ProductVariant) {
    include.push({ model: ProductVariant, as: "variants", required: false });
  }
  if (ProductImage) {
    include.push({ model: ProductImage, as: "images", required: false });
  }

  const { count, rows: products } = await Product.findAndCountAll({
    where,
    include: include.length > 0 ? include : undefined,
    order: [['created_at', 'DESC']],
    limit: pagination.limit,
    offset: offset,
    distinct: true,
  });

  return {
    products,
    pagination: {
      total: count,
      page: pagination.page,
      limit: pagination.limit,
      total_pages: Math.ceil(count / pagination.limit),
    },
  };
}


  async deleteProduct(productId, merchantId) {
    const product = await Product.findOne({
      where: { id: productId } 
    });

    if (!product) {
        console.log("ID recherché non trouvé dans la base :", productId);
        throw new Error("Product not found");
    }

    await product.update({ 
        status: "archived", 
        visibility: "hidden" 
    });

    return { message: "Product archived successfully" };
  }

  async renewProductPayment(productId, paymentData) {
    const product = await Product.findByPk(productId);
    if (!product) throw new Error("Product not found");

    const now = new Date();
    let expiresAt;

    if (paymentData.plan === "monthly") {
      expiresAt = new Date(now.setMonth(now.getMonth() + 1));
    } else if (paymentData.plan === "yearly") {
      expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
    } else {
      throw new Error("Invalid payment plan");
    }

    await product.update({
      payment_plan: paymentData.plan,
      payment_expires_at: expiresAt,
      status: "active",
      visibility: "visible",
      is_free_tier: false,
      payment_renewal_reminder_sent: false,
    });

    return await this.getProductById(productId);
  }

  async getMerchantStats(merchantId) {
    const stats = await Product.findAll({
      where: { merchant_id: merchantId },
      attributes: [
        "status",
        "payment_plan",
        [require("../config/database").Sequelize.fn("COUNT", "*"), "count"],
      ],
      group: ["status", "payment_plan"],
      raw: true,
    });

    const limitCheck = await this.checkProductLimit(merchantId);

    const expiringSoon = await Product.findAll({
      where: {
        merchant_id: merchantId,
        payment_expires_at: {
          [Op.lte]: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          [Op.gt]: new Date(),
        },
        payment_renewal_reminder_sent: false,
      },
    });

    return {
      product_limits: limitCheck,
      status_breakdown: stats,
      expiring_soon: expiringSoon.length,
      expiring_products: expiringSoon,
    };
  }

  async notifyMerchant(merchantId, type, data) {
    try {
      await axios.post(
        process.env.NOTIFICATION_SERVICE_URL ||
          "http://localhost:3004/api/v1/notify",
        {
          merchant_id: merchantId,
          type,
          data,
        },
      );
    } catch (error) {
      console.error("Failed to send notification:", error.message);
    }
  }

  async checkExpiredPayments() {
    const expiredProducts = await Product.findAll({
      where: {
        payment_expires_at: { [Op.lt]: new Date() },
        status: { [Op.notIn]: ["payment_expired", "archived"] },
      },
    });

    for (const product of expiredProducts) {
      await this.handleExpiredPayment(product);
    }

    return { processed: expiredProducts.length };
  }

  async sendRenewalReminders() {
    const reminderProducts = await Product.findAll({
      where: {
        payment_expires_at: {
          [Op.lte]: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          [Op.gt]: new Date(),
        },
        payment_renewal_reminder_sent: false,
      },
    });

    for (const product of reminderProducts) {
      await this.notifyMerchant(product.merchant_id, "payment_renewal_due", {
        product_id: product.id,
        product_name: product.name,
        expires_at: product.payment_expires_at,
      });
      await product.update({ payment_renewal_reminder_sent: true });
    }

    return { reminders_sent: reminderProducts.length };
  }

   async getProductVariants(productId) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    const variants = await ProductVariant.findAll({
      where: { product_id: productId, is_active: true },
      order: [['position', 'ASC'], ['created_at', 'ASC']]
    });

    return variants;
  }

  // Add variant to product
  async addProductVariant(productId, variantData) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    // Check SKU uniqueness
    const existingVariant = await ProductVariant.findOne({
      where: { sku: variantData.sku }
    });
    if (existingVariant) {
      throw new ApiError(400, 'SKU déjà utilisé');
    }

    // If this is the first variant or marked as default, handle default logic
    if (variantData.is_default) {
      await ProductVariant.update(
        { is_default: false },
        { where: { product_id: productId } }
      );
    }

    const variant = await ProductVariant.create({
      product_id: productId,
      ...variantData
    });

    // Create initial stock entry if quantity provided
    if (variantData.quantity > 0) {
      await Stock.create({
        variant_id: variant.id,
        quantity: variantData.quantity,
        reserved_quantity: 0
      });
    }

    return variant;
  }

  // Update variant
  async updateVariant(variantId, updateData) {
    const variant = await ProductVariant.findByPk(variantId);
    if (!variant) {
      throw new ApiError(404, 'Variante non trouvée');
    }

    // Check SKU uniqueness if changed
    if (updateData.sku && updateData.sku !== variant.sku) {
      const existingVariant = await ProductVariant.findOne({
        where: { sku: updateData.sku, id: { [Op.ne]: variantId } }
      });
      if (existingVariant) {
        throw new ApiError(400, 'SKU déjà utilisé');
      }
    }

    // Handle default variant logic
    if (updateData.is_default && !variant.is_default) {
      await ProductVariant.update(
        { is_default: false },
        { where: { product_id: variant.product_id } }
      );
    }

    await variant.update(updateData);
    return variant;
  }

  // Delete variant (soft delete)
  async deleteVariant(variantId) {
    const variant = await ProductVariant.findByPk(variantId);
    if (!variant) {
      throw new ApiError(404, 'Variante non trouvée');
    }

    // Check if it's the only variant
    const variantCount = await ProductVariant.count({
      where: { product_id: variant.product_id, is_active: true }
    });
    if (variantCount <= 1) {
      throw new ApiError(400, 'Impossible de supprimer la seule variante du produit');
    }

    await variant.update({ is_active: false });
    return { message: 'Variante supprimée avec succès' };
  }

  /**
   * SEARCH & FILTER
   */

  // Search products
  async searchProducts(query, options = {}) {
    const { 
      limit = 20, 
      offset = 0, 
      sortBy = 'created_at', 
      order = 'DESC',
      category_id,
      min_price,
      max_price,
      in_stock
    } = options;

    const whereClause = {
      is_active: true,
      [Op.or]: [
        { name: { [Op.like]: `%${query}%` } },
        { description: { [Op.like]: `%${query}%` } },
        { sku: { [Op.like]: `%${query}%` } },
        { tags: { [Op.like]: `%${query}%` } }
      ]
    };

    if (category_id) {
      whereClause.category_id = category_id;
    }

    if (min_price || max_price) {
      whereClause.price = {};
      if (min_price) whereClause.price[Op.gte] = min_price;
      if (max_price) whereClause.price[Op.lte] = max_price;
    }

    if (in_stock === 'true') {
      whereClause.quantity = { [Op.gt]: 0 };
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: ProductImage, where: { is_primary: true }, required: false },
        { 
          model: ProductVariant, 
          where: { is_active: true }, 
          required: false,
          include: [{ model: Stock, attributes: ['quantity', 'reserved_quantity'] }]
        }
      ],
      order: [[sortBy, order]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return {
      products,
      pagination: {
        total: count,
        page: Math.floor(offset / limit) + 1,
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    };
  }

  // Filter products
  async filterProducts(filters) {
    const {
      category_id,
      merchant_id,
      store_id,
      min_price,
      max_price,
      attributes,
      tags,
      brand,
      status,
      in_stock,
      featured,
      sortBy = 'created_at',
      order = 'DESC',
      limit = 20,
      offset = 0
    } = filters;

    const whereClause = { is_active: true };

    if (merchant_id) whereClause.merchant_id = merchant_id;
    if (store_id) whereClause.store_id = store_id;
    if (category_id) whereClause.category_id = category_id;
    if (brand) whereClause.brand = brand;
    if (status) whereClause.status = status;
    if (featured === 'true') whereClause.is_featured = true;

    if (min_price || max_price) {
      whereClause.price = {};
      if (min_price) whereClause.price[Op.gte] = parseFloat(min_price);
      if (max_price) whereClause.price[Op.lte] = parseFloat(max_price);
    }

    if (tags) {
      const tagArray = tags.split(',');
      whereClause.tags = { [Op.or]: tagArray.map(tag => ({ [Op.like]: `%${tag.trim()}%` })) };
    }

    // Handle attributes filtering (JSON)
    if (attributes) {
      try {
        const attrFilters = JSON.parse(attributes);
        Object.keys(attrFilters).forEach(key => {
          whereClause[`attributes.${key}`] = attrFilters[key];
        });
      } catch (e) {
        // If not valid JSON, ignore
      }
    }

    const include = [
      { model: Category, attributes: ['id', 'name', 'slug'] },
      { 
        model: ProductImage, 
        where: { is_primary: true }, 
        required: false 
      },
      {
        model: ProductVariant,
        where: { is_active: true },
        required: false,
        include: [{ model: Stock, attributes: ['quantity'] }]
      }
    ];

    if (in_stock === 'true') {
      include.push({
        model: Stock,
        where: { quantity: { [Op.gt]: 0 } },
        required: true
      });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include,
      order: [[sortBy, order]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return {
      products,
      filters: { category_id, min_price, max_price, brand, tags },
      pagination: {
        total: count,
        page: Math.floor(offset / limit) + 1,
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    };
  }

  /**
   * MERCHANT & STORE PRODUCTS
   */

  // Get products by merchant
  async getMerchantProducts(merchantId, options = {}) {
    const { limit = 20, offset = 0, status } = options;

    const whereClause = { merchant_id: merchantId, is_active: true };
    if (status) whereClause.status = status;

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: ProductImage, where: { is_primary: true }, required: false },
        { model: ProductVariant, where: { is_active: true }, required: false }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return {
      merchant_id: merchantId,
      products,
      pagination: {
        total: count,
        page: Math.floor(offset / limit) + 1,
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    };
  }

  // Add product for merchant
  async addMerchantProduct(merchantId, productData) {
    // Verify merchant exists (you might have a Merchant model)
    // const merchant = await Merchant.findByPk(merchantId);
    // if (!merchant) throw new ApiError(404, 'Marchand non trouvé');

    const product = await Product.create({
      ...productData,
      merchant_id: merchantId,
      status: productData.status || 'draft'
    });

    // Create default variant if variants provided
    if (productData.variants && productData.variants.length > 0) {
      const variants = productData.variants.map((v, index) => ({
        ...v,
        product_id: product.id,
        position: index
      }));
      await ProductVariant.bulkCreate(variants);
    } else {
      // Create default variant
      await ProductVariant.create({
        product_id: product.id,
        sku: `${productData.sku || product.id}-DEFAULT`,
        price: productData.price,
        quantity: productData.quantity || 0,
        is_default: true
      });
    }

    return await this.getProductById(product.id);
  }

  // Get products by store
  async getStoreProducts(storeId, options = {}) {
    const { limit = 20, offset = 0, category_id } = options;

    const whereClause = { store_id: storeId, is_active: true };
    if (category_id) whereClause.category_id = category_id;

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: ProductImage, where: { is_primary: true }, required: false },
        { 
          model: ProductVariant, 
          where: { is_active: true }, 
          required: false,
          include: [{ model: Stock, attributes: ['quantity'] }]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return {
      store_id: storeId,
      products,
      pagination: {
        total: count,
        page: Math.floor(offset / limit) + 1,
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    };
  }

  /**
   * REVIEWS, RATINGS & RELATED
   */

  // Get product reviews (placeholder - implement with Review model)
  async getProductReviews(productId, options = {}) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    // If you have a Review model, use it. Otherwise return placeholder
    // const reviews = await Review.findAll({ where: { product_id: productId } });
    
    return {
      product_id: productId,
      reviews: [], // Populate from your Review model
      average_rating: product.average_rating || 0,
      total_reviews: product.total_reviews || 0,
      rating_breakdown: {
        5: 0, 4: 0, 3: 0, 2: 0, 1: 0
      }
    };
  }

  // Get product rating summary
  async getProductRating(productId) {
    const product = await Product.findByPk(productId, {
      attributes: ['id', 'name', 'average_rating', 'total_reviews']
    });
    
    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    // Calculate rating distribution if Review model exists
    // const distribution = await Review.findAll({
    //   where: { product_id: productId },
    //   attributes: ['rating', [sequelize.fn('COUNT', sequelize.col('rating')), 'count']],
    //   group: ['rating']
    // });

    return {
      product_id: productId,
      average_rating: parseFloat(product.average_rating) || 0,
      total_reviews: product.total_reviews || 0,
      rating_distribution: {
        5: 0, 4: 0, 3: 0, 2: 0, 1: 0
      }
    };
  }

  // Get related products
  async getRelatedProducts(productId, limit = 4) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    const related = await Product.findAll({
      where: {
        id: { [Op.ne]: productId },
        is_active: true,
        [Op.or]: [
          { category_id: product.category_id },
          { tags: { [Op.like]: `%${product.tags}%` } }
        ]
      },
      include: [
        { model: ProductImage, where: { is_primary: true }, required: false },
        { model: ProductVariant, where: { is_default: true, is_active: true }, required: false }
      ],
      limit: parseInt(limit),
      order: sequelize.random()
    });

    return related;
  }

  // Get featured products
  async getFeaturedProducts(limit = 10, options = {}) {
    const whereClause = { 
      is_active: true, 
      is_featured: true 
    };

    if (options.category_id) {
      whereClause.category_id = options.category_id;
    }

    const products = await Product.findAll({
      where: whereClause,
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: ProductImage, where: { is_primary: true }, required: false },
        { 
          model: ProductVariant, 
          where: { is_default: true, is_active: true }, 
          required: false 
        }
      ],
      order: [['featured_position', 'ASC'], ['created_at', 'DESC']],
      limit: parseInt(limit)
    });

    return products;
  }
}

module.exports = new ProductService();