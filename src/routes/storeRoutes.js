const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');

// GET /api/v1/stores/:storeId/products
router.get('/:storeId/products', authenticate, productController.getProductsByStore);

module.exports = router;