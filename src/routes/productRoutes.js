const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const variantController = require('../controllers/variantController');
const searchController = require('../controllers/searchController');
const merchantController = require('../controllers/merchantController');
const discoveryController = require('../controllers/discoveryController');
const stockController = require('../controllers/stockController');
const { authenticate } = require('../middleware/auth');
const { validateProduct, validateStockUpdate, validateStockOperation } = require('../middleware/validation');
const upload = require('../middleware/upload'); 
const imageController = require('../controllers/imageController');

// --- ROUTES PUBLIQUES ---

// Recherche et filtrage (doivent être avant les routes avec :id)
router.get('/search', searchController.searchProducts);
router.get('/filter', searchController.filterProducts);
router.get('/featured', discoveryController.getFeaturedProducts);

// Routes de découverte produit
router.get('/:id/reviews', discoveryController.getProductReviews);
router.get('/:id/rating', discoveryController.getProductRating);
router.get('/:id/related', discoveryController.getRelatedProducts);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.post('/webhook/whatsapp', productController.whatsappWebhook);

// --- ROUTES PROTÉGÉES (Nécessitent un Token) ---
router.use(authenticate);

router.get('/limits', productController.getLimits);

// CRÉATION : Une seule route, AVEC le middleware d'upload en premier
router.post(
  '/', 
  upload.array('images', 5), 
  productController.createProduct
);

// MISE À JOUR
router.put(
  '/:id', 
  upload.array('images', 5), 
  productController.updateProduct
);

router.delete('/:id', productController.deleteProduct);

// GESTION DES VARIANTES
router.get('/:id/variants', variantController.getProductVariants);

// ⭐ NEW: BATCH VARIANT CREATION WITH IMAGE UPLOAD (MUST BE BEFORE /:id/variants)
// This route handles: POST /api/v1/products/:id/variants/batch
router.post(
  '/:id/variants/batch',
  upload.single('image'), // Single image upload, field name must be 'image'
  variantController.createBatchVariants
);

// Single variant creation (JSON only, no image)
router.post('/:id/variants', variantController.createVariant);

router.put('/:variantId', variantController.updateVariant);
router.delete('/:variantId', variantController.deleteVariant);

// GESTION DES IMAGES
router.post('/:id/images', upload.array('images', 5), imageController.uploadImage);
router.get('/:id/images', imageController.getProductImages);
router.delete('/:id/images/:imageId', imageController.deleteImage);

router.post('/:id/renew', productController.renewPayment);

router.get('/:id/stock', stockController.getStock);
router.put('/:id/stock', validateStockUpdate, stockController.updateStock);
router.post('/:id/stock/increase', validateStockOperation, stockController.increaseStock);
router.post('/:id/stock/decrease', validateStockOperation, stockController.decreaseStock);
router.get('/:id/stock/history', stockController.getStockHistory);

module.exports = router;