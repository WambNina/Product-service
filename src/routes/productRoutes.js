const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const variantController = require('../controllers/variantController');
const searchController = require('../controllers/searchController');
const discoveryController = require('../controllers/discoveryController');
const stockController = require('../controllers/stockController');
const imageController = require('../controllers/imageController');
const { authenticate } = require('../middleware/auth');
const { validateStockUpdate, validateStockOperation } = require('../middleware/validation');
const upload = require('../middleware/upload');

console.log('Product Controller:', Object.keys(productController));
console.log('getProducts:', typeof productController.getProducts);

console.log('=== MIDDLEWARE DEBUG ===');
console.log('authenticate:', typeof authenticate);
console.log('validateStockUpdate:', typeof validateStockUpdate);
console.log('validateStockOperation:', typeof validateStockOperation);
console.log('upload:', typeof upload);
console.log('upload.array:', typeof upload.array);
console.log('upload.single:', typeof upload.single);
console.log('========================');

if (typeof authenticate !== 'function') {
  throw new Error('authenticate is not a function. Check your auth middleware export!');
}
if (typeof validateStockUpdate !== 'function') {
  throw new Error('validateStockUpdate is not a function');
}
if (typeof validateStockOperation !== 'function') {
  throw new Error('validateStockOperation is not a function');
}

// ============================================
// ROUTES PUBLIQUES (sans authentification)
// ============================================

// 🔍 Recherche et découverte (DOIVENT être avant /:id)
router.get('/search', searchController.searchProducts);
router.get('/filter', searchController.filterProducts);
router.get('/featured', discoveryController.getFeaturedProducts);

// 📋 Liste et détail produit
router.get('/', productController.getProducts);

// 🤖 Webhook (spécifique, avant /:id)
router.post('/webhook/whatsapp', productController.whatsappWebhook);

// ============================================
// ROUTES PUBLIQUES AVEC :id (ordre important!)
// ============================================

// 🖼️ Routes spécifiques AVANT /:id générique
router.get('/:id/reviews', discoveryController.getProductReviews);
router.get('/:id/rating', discoveryController.getProductRating);
router.get('/:id/related', discoveryController.getRelatedProducts);
router.get('/:id/stock', stockController.getStock); // Stock public

// 📦 Détail produit (APRÈS les routes spécifiques)
router.get('/:id', productController.getProduct);

// ============================================
// MIDDLEWARE AUTH (toutes les routes suivantes sont protégées)
// ============================================
router.use(authenticate);

// ============================================
// ROUTES PROTÉGÉES - CRÉATION/MODIFICATION PRODUITS
// ============================================

// 📊 Limites merchant
router.get('/limits', productController.getLimits);

// ➕ Création produit avec images
router.post(
  '/',
  upload.array('images', 300),
  productController.createProduct
);

// ✏️ Mise à jour produit
router.put(
  '/:id',
  upload.array('images', 300),
  productController.updateProduct
);

// 🗑️ Suppression produit
router.delete('/:id', productController.deleteProduct);

// ============================================
// ROUTES PROTÉGÉES - VARIANTS (ORDRE CRUCIAL!)
// ============================================

// 🚨 ROUTES SPÉCIFIQUES D'ABORD (avant /:id/variants génériques)

// 1. BATCH: POST /api/v1/products/:id/variants/batch
router.post(
  '/:id/variants/batch',
  upload.single('image'),
  variantController.createBatchVariants
);

// 2. CALCUL PRIX: POST /api/v1/products/:id/calculate-price
router.post(
  '/:id/calculate-price',
  variantController.calculatePrice
);

// 3. MATRICE PRIX: GET /api/v1/products/:id/price-matrix
router.get(
  '/:id/price-matrix',
  variantController.getPriceMatrix
);

// 📋 ROUTES VARIANTS GÉNÉRIQUES (APRÈS les spécifiques)

// 4. LISTER: GET /api/v1/products/:id/variants
router.get('/:id/variants', variantController.getProductVariants);

// 5. CRÉER UN SEUL: POST /api/v1/products/:id/variants
router.post('/:id/variants', variantController.createVariant);

// ============================================
// ROUTES PROTÉGÉES - VARIANTS PAR ID DIRECT
// ============================================

// ⚠️ Ces routes utilisent :variantId directement (pas de /:id/ avant)
// Donc elles peuvent être après sans problème

// ✏️ Mise à jour variant (avec gestion prix modulaire)
router.put(
  '/:variantId',
  upload.single('image'), // Optionnel: permet changer l'image
  variantController.updateVariant
);

// 🗑️ Suppression variant
router.delete('/:variantId', variantController.deleteVariant);

// 💰 Mise à jour prix spécifique (override calculé)
router.put('/:variantId/price', variantController.updateVariantPrice);

// ============================================
// ROUTES PROTÉGÉES - GESTION IMAGES
// ============================================

router.post('/:id/images', upload.array('images', 5), imageController.uploadImage);
router.get('/:id/images', imageController.getProductImages);
router.delete('/:id/images/:imageId', imageController.deleteImage);

// ============================================
// ROUTES PROTÉGÉES - STOCK AVANCÉ
// ============================================

router.put('/:id/stock', validateStockUpdate, stockController.updateStock);
router.post('/:id/stock/increase', validateStockOperation, stockController.increaseStock);
router.post('/:id/stock/decrease', validateStockOperation, stockController.decreaseStock);
router.get('/:id/stock/history', stockController.getStockHistory);

// ============================================
// ROUTES PROTÉGÉES - PAIEMENT
// ============================================

router.post('/:id/renew', productController.renewPayment);

module.exports = router;