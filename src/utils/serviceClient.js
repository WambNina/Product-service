const axios = require('axios');

class ServiceClient {
  constructor() {
    this.services = {
      store: process.env.STORE_SERVICE_URL || 'http://localhost:3000',
      product: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
      media: process.env.MEDIA_SERVICE_URL || 'http://localhost:4002'
    };
  }

  async call(serviceName, method, endpoint, data = undefined, headers = {}) {
    const baseURL = this.services[serviceName];
    if (!baseURL) {
      throw new Error(`Service ${serviceName} non configuré`);
    }

    try {
      const config = {
        method,
        url: `${baseURL}${endpoint}`,
        timeout: 5000,
        headers: {
          'x-internal-service': 'true',
          ...headers
        }
      };

      // N'ajouter le body que si nécessaire
      if (data !== undefined && data !== null && method !== 'GET' && method !== 'HEAD') {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Erreur appel ${serviceName}:`, error.response?.data || error.message);
      throw new Error(`Service ${serviceName} indisponible: ${error.message}`);
    }
  }

  async getStore(storeId, token) {
    return this.call('store', 'GET', `/api/v1/stores/${storeId}`, undefined, {
      Authorization: token
    });
  }

  async getProduct(productId, token) {
    return this.call('product', 'GET', `/api/v1/products/${productId}`, undefined, {
      Authorization: token
    });
  }

  async getMedia(entityType, entityId) {
    return this.call('media', 'GET', `/api/v1/media/${entityType}/${entityId}`);
  }
}

module.exports = new ServiceClient();