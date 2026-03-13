// src/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Supprime ou commente le middleware "authenticate" pour le moment
router.route('/')
    .get(categoryController.getAllCategories)
    .post(categoryController.createCategory); 

router.route('/:id')
    .get(categoryController.getCategoryById)
    .put(categoryController.updateCategory)
    .delete(categoryController.deleteCategory);

module.exports = router;