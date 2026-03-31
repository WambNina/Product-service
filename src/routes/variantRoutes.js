const express = require('express');
const router = express.Router();
const variantController = require('../controllers/variantController');
const { authenticate } = require('../middleware/auth');

// GET /api/v1/variants/:variantId
router.get('/:variantId', authenticate, variantController.getVariantById);

module.exports = router;