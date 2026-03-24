const ServiceClient = require('../utils/serviceClient');
const FormData = require('form-data');

class MediaService {
  constructor() {
    this.client = new ServiceClient('PRODUCT-SERVICE');
  }

  /**
   * Upload product images to Media Service
   */
  async uploadProductImages(files, { merchant_id, store_id, product_id, product_name }) {
    try {
      const formData = new FormData();
      
      files.forEach((file) => {
        formData.append('files', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });
      });

      formData.append('merchant_id', merchant_id);
      formData.append('store_id', store_id);
      formData.append('metadata', JSON.stringify({
        product_id,
        product_name,
        type: 'product_image',
        uploaded_at: new Date().toISOString()
      }));

      const result = await this.client.uploadFile('MEDIA', '/api/media/upload', formData);
      console.log('✅ Product images uploaded:', result.media_ids);
      return result;
    } catch (error) {
      console.error('❌ Product image upload failed:', error.message);
      throw new Error('Failed to upload product images');
    }
  }

  /**
   * Get images for a product
   */
  async getProductImages(product_id, store_id, merchant_id) {
    try {
      const media = await this.client.get('MEDIA', '/api/media', {
        store_id,
        merchant_id,
        limit: 100
      });
      
      // Filter by product_id in metadata
      return (media.data || []).filter(item => {
        try {
          const meta = JSON.parse(item.metadata || '{}');
          return meta.product_id === product_id;
        } catch {
          return false;
        }
      });
    } catch (error) {
      console.error('❌ Failed to fetch product images:', error.message);
      return [];
    }
  }
}

module.exports = new MediaService();