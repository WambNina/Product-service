const express = require('express');
const router = express.Router();
const pricingService = require('../services/modularPricingService');

// POST /api/products/:id/calculate-price
// Calculer le prix pour une sélection d'attributs
router.post('/:id/calculate-price', async (req, res) => {
  try {
    const { selectedAttributes } = req.body;
    // selectedAttributes: { "memory": "uuid-256gb", "color": "uuid-red" }
    
    const result = await pricingService.calculatePrice(
      req.params.id, 
      selectedAttributes
    );
    
    res.json({
      productId: req.params.id,
      ...result,
      formattedPrice: `${result.finalPrice.toFixed(2)} €`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/products/:id/price-matrix
// Récupérer toutes les combinaisons de prix (pour grille d'affichage)
router.get('/:id/price-matrix', async (req, res) => {
  try {
    const matrix = await pricingService.generatePriceMatrix(req.params.id);
    res.json({
      productId: req.params.id,
      combinations: matrix,
      totalCombinations: matrix.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});