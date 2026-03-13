const { Product, Category, ProductVariant, Sequelize } = require('../models');
const { Op } = require("sequelize");
const ApiError = require('../utils/apiError');

class SearchService {
  /**
   * Recherche textuelle avec scoring
   */
  async searchProducts(queryParams) {
    const {
      q = '',
      category,
      min_price,
      max_price,
      status = 'active',
      sort_by = 'relevance',
      page = 1,
      limit = 20,
      fields
    } = queryParams;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { status };

    // Recherche textuelle sur nom et description
    if (q) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
        { short_description: { [Op.like]: `%${q}%` } },
        { tags: { [Op.like]: `%${q}%` } }
      ];
    }

    // Filtres additionnels
    if (category) {
      whereClause.category_id = category;
    }

    if (min_price || max_price) {
      whereClause.price = {};
      if (min_price) whereClause.price[Op.gte] = parseFloat(min_price);
      if (max_price) whereClause.price[Op.lte] = parseFloat(max_price);
    }

    // Déterminer l'ordre de tri
    let order = [];
    switch (sort_by) {
      case 'price_asc':
        order = [['price', 'ASC']];
        break;
      case 'price_desc':
        order = [['price', 'DESC']];
        break;
      case 'newest':
        order = [['created_at', 'DESC']];
        break;
      case 'name':
        order = [['name', 'ASC']];
        break;
      default: // relevance - par défaut les plus récents
        order = [['created_at', 'DESC']];
    }

    // Sélection des champs
    const attributes = fields ? fields.split(',') : 
      ['id', 'name', 'slug', 'price', 'compare_at_price', 'quantity', 
       'status', 'category_id', 'images', 'created_at', 'short_description'];

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      attributes,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: ProductVariant,
          as: 'variants',
          attributes: ['id', 'sku', 'color', 'size', 'price_adjustment', 'quantity']
        }
      ],
      order,
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit))
      },
      meta: {
        query: q,
        sort_by,
        filters_applied: Object.keys(queryParams).filter(k => !['page', 'limit', 'sort_by', 'fields'].includes(k))
      }
    };
  }

  /**
   * Filtrage avancé avec critères multiples
   */
  async filterProducts(queryParams) {
    const {
      categories,
      brands,
      attributes,
      min_price,
      max_price,
      in_stock,
      has_variants,
      status = 'active',
      merchant_id,
      store_id,
      tags,
      created_after,
      created_before,
      sort_by = 'created_at',
      sort_dir = 'DESC',
      page = 1,
      limit = 20
    } = queryParams;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { status };
    const appliedFilters = [];

    // Filtre par catégories (multiple)
    if (categories) {
      const categoryIds = categories.split(',');
      whereClause.category_id = { [Op.in]: categoryIds };
      appliedFilters.push({ type: 'categories', values: categoryIds });
    }

    // Filtre par marchand
    if (merchant_id) {
      whereClause.merchant_id = merchant_id;
      appliedFilters.push({ type: 'merchant', value: merchant_id });
    }

    // Filtre par store
    if (store_id) {
      whereClause.store_id = store_id;
      appliedFilters.push({ type: 'store', value: store_id });
    }

    // Filtre par prix
    if (min_price || max_price) {
      whereClause.price = {};
      if (min_price) {
        whereClause.price[Op.gte] = parseFloat(min_price);
        appliedFilters.push({ type: 'min_price', value: min_price });
      }
      if (max_price) {
        whereClause.price[Op.lte] = parseFloat(max_price);
        appliedFilters.push({ type: 'max_price', value: max_price });
      }
    }

    // Filtre stock disponible
    if (in_stock === 'true') {
      whereClause.quantity = { [Op.gt]: 0 };
      appliedFilters.push({ type: 'in_stock', value: true });
    }

    // Filtre par tags
    if (tags) {
      const tagList = tags.split(',');
      whereClause.tags = { [Op.overlap]: tagList }; // Pour PostgreSQL, adapter pour MySQL si nécessaire
      appliedFilters.push({ type: 'tags', values: tagList });
    }

    // Filtre par date de création
    if (created_after || created_before) {
      whereClause.created_at = {};
      if (created_after) {
        whereClause.created_at[Op.gte] = new Date(created_after);
        appliedFilters.push({ type: 'created_after', value: created_after });
      }
      if (created_before) {
        whereClause.created_at[Op.lte] = new Date(created_before);
        appliedFilters.push({ type: 'created_before', value: created_before });
      }
    }

    // Construction de l'ordre de tri
    const order = [[sort_by, sort_dir.toUpperCase()]];

    const includeOptions = [
      {
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }
    ];

    // Inclure les variantes si demandé ou si filtre sur variantes
    if (has_variants === 'true' || attributes) {
      includeOptions.push({
        model: ProductVariant,
        as: 'variants',
        required: has_variants === 'true', // INNER JOIN si on veut uniquement ceux avec variantes
        where: attributes ? this.parseAttributesFilter(attributes) : undefined
      });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      order,
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit))
      },
      appliedFilters
    };
  }

  parseAttributesFilter(attributesString) {
    // Format: color:red,blue|size:M,L
    const attributes = {};
    const pairs = attributesString.split('|');
    
    pairs.forEach(pair => {
      const [key, values] = pair.split(':');
      if (key && values) {
        attributes[key] = values.split(',');
      }
    });

    // Construire la clause where pour les variantes
    const whereClause = {};
    if (attributes.color) {
      whereClause.color = { [Op.in]: attributes.color };
    }
    if (attributes.size) {
      whereClause.size = { [Op.in]: attributes.size };
    }

    return whereClause;
  }
}

module.exports = new SearchService();