const serviceClient = require("../utils/serviceClient");
const FormData = require("form-data");
const axios = require("axios");

class MediaService {
  constructor() {
    this.baseURL = process.env.MEDIA_SERVICE_URL || "http://localhost:4002";
  }

  /**
   * Upload product images to Media Service
   */
  async uploadProductImages(files, { merchant_id, product_id, product_name }) {
    try {
      const formData = new FormData();

      // Files
      files.forEach((file) => {
        formData.append("files", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      });

      // ✅ IMPORTANT: Nouveau contrat
      formData.append("entity_type", "product");
      formData.append("entity_id", product_id);

      // Optionnel mais utile
      formData.append("merchant_id", merchant_id);

      formData.append(
        "metadata",
        JSON.stringify({
          product_name,
          type: "product_image",
          uploaded_at: new Date().toISOString(),
        }),
      );
      const response = await axios.post(
        `${process.env.MEDIA_SERVICE_URL}/api/media/upload`,
        formData,
        { headers: formData.getHeaders() },
      );

      return response.data;
    } catch (error) {
      console.error("❌ Product image upload failed:", error.message);
      throw new Error("Failed to upload product images");
    }
  }

  /**
   * Upload helper
   */
  async uploadToMediaService(endpoint, formData) {
    try {
      const response = await axios.post(
        `${this.baseURL}${endpoint}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        "❌ Media service error:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Get product images
   */
  async getProductImages(product_id) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v1/media/product/${product_id}`,
      );

      return response.data?.data || [];
    } catch (error) {
      console.error("❌ Failed to fetch product images:", error.message);
      return [];
    }
  }
}

module.exports = new MediaService();
