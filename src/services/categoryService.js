const categoryService = require('../services/categoryService');
const Category = require('../models/Category');
const slugify = require('slugify');

class CategoryService {
    async getAllCategories() {
        return await Category.findAll({ where: { status: 'active' } });
    }

    async getCategoryById(id) {
        const category = await Category.findByPk(id);
        if (!category) throw new Error("Unfindable category");
        return category;
    }

    async createCategory(data) {
        const slug = slugify(data.name, { lower: true, strict: true });
        return await Category.create({ ...data, slug });
    }

    async updateCategory(id, data) {
        const category = await this.getCategoryById(id);
        if (data.name) {
            data.slug = slugify(data.name, { lower: true, strict: true });
        }
        return await category.update(data);
    }

    async deleteCategory(id) {
        const category = await this.getCategoryById(id);
        // On peut faire un destroy (suppression physique) 
        // ou un archivage comme pour les produits
        return await category.destroy();
    }
}

module.exports = new CategoryService();