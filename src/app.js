const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const swaggerDocument = require('../swagger/swagger.json');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const variantRoutes = require('./routes/variantRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const storeRoutes = require('./routes/storeRoutes');
const { errorHandler } = require('./utils/apiError');
const { authenticate } = require('./middleware/auth');

const app = express();

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Security middleware
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(morgan('combined'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger JSON
app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerDocument);
});

// Swagger UI (CDN version)
app.get('/api-docs', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Product Service API</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
        <style>.swagger-ui .topbar { display: none }</style>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
        <script>
            window.onload = () => {
                window.ui = SwaggerUIBundle({
                    url: '/api-docs/swagger.json',
                    dom_id: '#swagger-ui',
                    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                    layout: 'StandaloneLayout',
                    validatorUrl: null,
                    persistAuthorization: true,
                    tryItOutEnabled: true
                });
            };
        </script>
    </body>
    </html>
    `);
});

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

// ============================================
// ROUTES — NO authenticate on productRoutes (it handles auth internally)
// ============================================

app.use('/api/v1/products', productRoutes);        // ← NO authenticate here
app.use('/api/v1/variants', authenticate, variantRoutes);
app.use('/api/v1/merchants', authenticate, merchantRoutes);
app.use('/api/v1/categories', authenticate, categoryRoutes);
app.use('/api/v1/stores', authenticate, storeRoutes);

// ============================================
// ROUTE DEBUGGING (fixed to show full paths)
// ============================================
console.log('=== REGISTERED ROUTES ===');
const listRoutes = (stack, basePath = '') => {
  stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
      console.log(`${methods} ${basePath}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      // Extract the full mount path from regexp
      const regexpStr = layer.regexp.toString();
      let path = '';
      
      // Parse /api/v1/products pattern
      const fullMatch = regexpStr.match(/\\\^\\\\\\\/([^\\]+)\\\\\\\/([^\\]+)\\\\\\\/([^\\]+)/);
      if (fullMatch) {
        path = `/${fullMatch[1]}/${fullMatch[2]}/${fullMatch[3]}`;
      } else {
        const simpleMatch = regexpStr.match(/\\\^\\\\\\\/([^\\]+)/);
        path = simpleMatch ? `/${simpleMatch[1]}` : '';
      }
      
      listRoutes(layer.handle.stack, basePath + path);
    }
  });
};
listRoutes(app._router.stack);
console.log('=========================');

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;