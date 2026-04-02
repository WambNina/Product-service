const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger/swagger.json');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const variantRoutes = require('./routes/variantRoutes');
const { errorHandler } = require('./utils/apiError');
const merchantRoutes = require('./routes/merchantRoutes');
const { authenticate } = require('./middleware/auth');

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const app = express();

// Avant les routes
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Security middleware (LAN friendly)
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(compression());
app.use(morgan('combined'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve swagger JSON FIRST
app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerDocument);
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    explorer: true,
    swaggerOptions: {
        url: '/api-docs/swagger.json',
        validatorUrl: null,
        persistAuthorization: true,
        tryItOutEnabled: true
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Product Service API'
}));

// Static uploads
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'product-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/v1/variants', authenticate, variantRoutes);
app.use('/api/v1/products', authenticate, productRoutes);


app.use('/api/v1/merchants', authenticate, merchantRoutes);

app.use('/api/v1/categories', authenticate, categoryRoutes);

console.log('=== REGISTERED ROUTES ===');
const listRoutes = (stack, basePath = '') => {
  stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
      console.log(`${methods} ${basePath}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      const match = layer.regexp.toString().match(/^\/\^\\\/([^\\]+)/);
      const path = match ? `/${match[1]}` : '';
      listRoutes(layer.handle.stack, basePath + path);
    }
  });
};
listRoutes(app._router.stack);
console.log('=========================');

app.use('/uploads', express.static('uploads'));

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});



// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and WebP allowed.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Validation Schema
const uploadSchema = Joi.object({
  colors: Joi.array().items(
    Joi.string().valid('#0000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFFFFF', '#000000')
  ).min(1).required(),
  sizes: Joi.array().items(
    Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size')
  ).min(1).required(),
  weight: Joi.number().min(0).default(0),
  is_default: Joi.boolean().default(false)
});

// POST /api/v1/products/:id/images
app.post('/api/v1/products/:id/images', authenticate,
  upload.single('image'), // Handle single file upload
  async (req, res) => {
    try {
      const productId = req.params.id;
      
      // Handle form arrays (checkboxes send multiple values)
      // If single value sent, convert to array
      let colors = req.body.colors || [];
      let sizes = req.body.sizes || [];
      
      if (!Array.isArray(colors)) colors = [colors];
      if (!Array.isArray(sizes)) sizes = [sizes];

      // Validate body
      const { error, value } = uploadSchema.validate({
        ...req.body,
        colors,
        sizes
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Product image is required'
        });
      }

      // Generate variants for each color + size combination
      const variants = [];
      let variantCount = 0;

      for (const color of value.colors) {
        for (const size of value.sizes) {
          variants.push({
            id: uuidv4(),
            product_id: productId,
            sku: `SKU-${productId.substring(0, 8)}-${color.replace('#', '')}-${size}`,
            color: color,
            size: size,
            weight: value.weight,
            image_url: `/uploads/products/${req.file.filename}`,
            is_default: value.is_default && variantCount === 0, // First variant default if requested
            created_at: new Date().toISOString()
          });
          variantCount++;
        }
      }

      // TODO: Save to database here
      // await db.products.update(productId, { image_url: req.file.filename });
      // await db.variants.insert(variants);

      res.status(201).json({
        success: true,
        message: `Image uploaded and ${variants.length} variants created successfully`,
        data: {
          product_id: productId,
          image_url: `/uploads/products/${req.file.filename}`,
          filename: req.file.filename,
          variants_created: variants.length,
          variants: variants
        }
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
);

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large (max 5MB)'
      });
    }
  }
  res.status(500).json({
    success: false,
    message: error.message
  });
});



// Error handler
app.use(errorHandler);

module.exports = app;