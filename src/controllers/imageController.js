// src/controllers/imageController.js
const { Product, ProductImage } = require('../models');
const fs = require('fs');
const path = require('path');

exports.uploadImage = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Handle multiple files (req.files)
        const files = req.files;
        
        if (!files || files.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: "No files sent" 
            });
        }

        const product = await Product.findByPk(id);
        if (!product) {
            // Delete uploaded files if product not found
            files.forEach(file => {
                if (file.path && fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            return res.status(404).json({ 
                success: false,
                error: "product not found" 
            });
        }

        // Get current image count
        const existingImages = await ProductImage.count({
            where: { product_id: id }
        });

        const createdImages = [];

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isMain = (existingImages + i) === 0; // First image is main

            const image = await ProductImage.create({
                product_id: id,
                url: `/uploads/products/${file.filename}`,
                filename: file.filename,
                original_filename: file.originalname,
                mime_type: file.mimetype,
                size_bytes: file.size,
                is_main: isMain,
                position: existingImages + i
            });

            createdImages.push(image);
        }

        res.status(201).json({
            success: true,
            message: `${createdImages.length} image(s) added successfully`,
            data: createdImages
        });
        
    } catch (error) {
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                if (file.path && fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

exports.getProductImages = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify product exists first
        const product = await Product.findByPk(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: "Product not found"
            });
        }

        const images = await ProductImage.findAll({ 
            where: { product_id: id },
            order: [['position', 'ASC'], ['created_at', 'DESC']]
        });
        
        res.json({
            success: true,
            count: images.length,
            data: images
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

exports.deleteImage = async (req, res) => {
    try {
        const { imageId } = req.params;
        const image = await ProductImage.findByPk(imageId);
        
        if (!image) {
            return res.status(404).json({ 
                success: false,
                error: "Image not found" 
            });
        }

        // Delete the physical file
        const filePath = path.join(__dirname, '../../', image.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await image.destroy();
        
        res.json({ 
            success: true,
            message: "Image successfully deleted" 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};