// routes/attributes.js
const express = require('express');
const router = express.Router();

// POST /api/attributes/definitions
// Créer un nouveau type d'attribut (ex: "Mémoire")
router.post('/definitions', async (req, res) => {
  try {
    const { name, code, type, isVariant, configuration } = req.body;
    
    // Validation: type doit être 'text', 'color', 'image', ou 'number'
    const validTypes = ['text', 'color', 'image', 'number'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Type invalide' });
    }

    const definition = await AttributeDefinition.create({
      name,
      code,
      type,
      isVariant,
      configuration
    });

    res.status(201).json(definition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/attributes/definitions
// Récupérer tous les types d'attributs disponibles
router.get('/definitions', async (req, res) => {
  try {
    const definitions = await AttributeDefinition.findAll({
      include: [{ model: AttributeValue, as: 'values' }]
    });
    res.json(definitions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/attributes/values
// Ajouter une valeur à un attribut (ex: "256GB" pour l'attribut "Mémoire")
router.post('/values', async (req, res) => {
  try {
    const { attributeDefinitionId, value, displayValue, metadata } = req.body;
    
    // Validation selon le type
    const definition = await AttributeDefinition.findByPk(attributeDefinitionId);
    if (!definition) return res.status(404).json({ error: 'Attribut non trouvé' });

    // Validation spécifique par type
    if (definition.type === 'color' && !metadata?.hex) {
      return res.status(400).json({ error: 'La couleur hex est requise' });
    }
    if (definition.type === 'image' && !metadata?.imageUrl) {
      return res.status(400).json({ error: 'L\'URL de l\'image est requise' });
    }

    const attributeValue = await AttributeValue.create({
      attributeDefinitionId,
      value,
      displayValue,
      metadata
    });

    res.status(201).json(attributeValue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});