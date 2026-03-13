const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Routes publiques
router.get('/:merchantId/products', merchantController.getMerchantProducts);
router.get('/stores/:storeId/products', merchantController.getStoreProducts);

// Routes protégées (création de produit pour un marchand)
router.use(authenticate);
router.post(
  '/:merchantId/products',
  upload.array('images', 5),
  merchantController.createMerchantProduct
);

module.exports = router;