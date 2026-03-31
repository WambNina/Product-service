const categoryService = require('../services/categoryService');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const { Category } = require('../models');

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await categoryService.getAllCategories();
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 🆕 Fonction pour générer un slug
function generateSlug(name) {
  return name
    .toString()
    .normalize('NFD')                // Supprime les accents
    .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')            // Espaces -> tirets
    .replace(/[^\w\-]+/g, '')        // Supprime caractères spéciaux
    .replace(/\-\-+/g, '-');         // Évite tirets multiples
}

exports.createCategory = catchAsync(async (req, res) => {
  console.log('🔥 Body:', req.body);

  const { name, description } = req.body;

  // Validation détaillée
   if (!name || name.trim().length < 2) {
    throw new ApiError(400, 'Le nom est requis (min 2 caractères)');
  }

  const trimmedName = name.trim();
  const slug = generateSlug(trimmedName);

  // Vérifier si nom existe déjà
  const existingByName = await Category.findOne({ 
    where: { name: trimmedName } 
  });
  
  if (existingByName) {
    throw new ApiError(400, `La catégorie "${trimmedName}" existe déjà`);
  }

  // Vérifier si slug existe déjà
  const existingBySlug = await Category.findOne({ 
    where: { slug: slug } 
  });
  
  if (existingBySlug) {
    // Ajouter un suffixe unique au slug
    slug = `${slug}-${Date.now()}`;
  }

  // Création avec slug généré
  const category = await Category.create({
    name: trimmedName,
    slug: slug, // 🆕 AJOUTÉ
    description: description?.trim() || null,
    status: 'active'
  });

  res.status(201).json({
    success: true,
    message: 'Catégorie créée avec succès',
    data: category
  });
});

exports.getCategoryById = async (req, res) => {
    try {
        const category = await categoryService.getCategoryById(req.params.id);
        res.status(200).json({ success: true, data: category });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const category = await categoryService.updateCategory(req.params.id, req.body);
        res.status(200).json({ success: true, data: category });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await categoryService.deleteCategory(req.params.id);
        res.status(200).json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};