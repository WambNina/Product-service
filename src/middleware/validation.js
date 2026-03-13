const Joi = require('joi');
const ApiError = require('../utils/apiError');

const productSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().max(5000).optional(),
  short_description: Joi.string().max(500).optional(),
  merchant_id:  Joi.string().optional(),
  price: Joi.number().positive().required(),
  category_name: Joi.string().required(),
  compare_at_price: Joi.number().positive().optional(),
  cost_price: Joi.number().positive().optional(),
  quantity: Joi.number().integer().min(0).optional(),
  category_id: Joi.string().required(),
  images: Joi.any().optional(),
  store_id: Joi.string().optional(),
  sku: Joi.string().max(100).optional(),
  weight: Joi.number().positive().optional(),
  weight_unit: Joi.string().valid('kg', 'g', 'lb', 'oz').optional(),
  status: Joi.string().valid('draft', 'active', 'archived', 'out_of_stock').optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  attributes: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required(),
      is_variant_attribute: Joi.boolean().optional()
    })
  ).optional(),
  variants: Joi.array().items(
    Joi.object({
      sku: Joi.string().required(),
      attributes: Joi.object().required(),
      color: Joi.string().optional(),
      size: Joi.string().optional(),
      price_adjustment: Joi.number().optional(),
      quantity: Joi.number().integer().min(0).optional(),
      is_default: Joi.boolean().optional()
    })
  ).optional(),
  payment_plan: Joi.string().valid('free', 'monthly', 'yearly').optional(),
  source: Joi.string().valid('web', 'whatsapp', 'api').optional(),
  whatsapp_media_group_id: Joi.string().optional()

});

exports.validateProduct = (req, res, next) => {
  const { error, value } = productSchema.validate(req.body, {
    abortEarly: false,
    convert: true
  });
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    return next(new ApiError(400, message));
  }
  
  next();
};

// Stock validation schemas
const stockUpdateSchema = Joi.object({
  quantity: Joi.number().integer().min(0).required(),
  variantId: Joi.string().optional(),
  reason: Joi.string().max(255).optional()
});

const stockOperationSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
  variantId: Joi.string().optional(),
  reason: Joi.string().max(255).optional(),
  referenceId: Joi.string().max(100).optional(),
  allowNegative: Joi.boolean().optional()
});

// Existing validateProduct...
exports.validateProduct = (req, res, next) => {
  const { error, value } = productSchema.validate(req.body, {
    abortEarly: false,
    convert: true
  });
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    return next(new ApiError(400, message));
  }
  
  next();
};

// New stock validations
exports.validateStockUpdate = (req, res, next) => {
  const { error } = stockUpdateSchema.validate(req.body, {
    abortEarly: false,
    convert: true
  });
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    return next(new ApiError(400, message));
  }
  
  next();
};

exports.validateStockOperation = (req, res, next) => {
  const { error } = stockOperationSchema.validate(req.body, {
    abortEarly: false,
    convert: true
  });
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    return next(new ApiError(400, message));
  }
  
  next();
};

const variantSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  attributes: Joi.object().required(),
  color: Joi.string().optional(),
  size: Joi.string().optional(),
  price_adjustment: Joi.number().optional(),
  quantity: Joi.number().integer().min(0).optional(),
  is_default: Joi.boolean().optional(),
  weight: Joi.number().positive().optional(),
  barcode: Joi.string().optional()
});

exports.validateVariant = (req, res, next) => {
  const { error, value } = variantSchema.validate(req.body, {
    abortEarly: false,
    convert: true
  });
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    return next(new ApiError(400, message));
  }
  
  next();
};