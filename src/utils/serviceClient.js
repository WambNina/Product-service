const axios = require('axios');

class ServiceClient {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.clients = {};
  }

  getClient(targetService) {
    if (!this.clients[targetService]) {
      const baseURL = process.env[`${targetService}_SERVICE_URL`];
      if (!baseURL) {
        throw new Error(`Service URL not configured for: ${targetService}`);
      }
      
      this.clients[targetService] = axios.create({
        baseURL,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': this.serviceName
        }
      });

      // Request interceptor for logging
      this.clients[targetService].interceptors.request.use(
        (config) => {
          console.log(`[${this.serviceName}] → [${targetService}] ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => Promise.reject(error)
      );

      // Response interceptor for error handling
      this.clients[targetService].interceptors.response.use(
        (response) => response,
        (error) => {
          console.error(`[${this.serviceName}] ← [${targetService}] Error: ${error.message}`);
          if (error.code === 'ECONNREFUSED') {
            console.error(`❌ ${targetService} is not running on ${error.config?.baseURL}`);
          }
          throw error;
        }
      );
    }
    
    return this.clients[targetService];
  }

  async get(targetService, endpoint, params = {}) {
    const client = this.getClient(targetService);
    const response = await client.get(endpoint, { params });
    return response.data;
  }

  async post(targetService, endpoint, data = {}, config = {}) {
    const client = this.getClient(targetService);
    const response = await client.post(endpoint, data, config);
    return response.data;
  }

  async put(targetService, endpoint, data = {}) {
    const client = this.getClient(targetService);
    const response = await client.put(endpoint, data);
    return response.data;
  }

  async delete(targetService, endpoint) {
    const client = this.getClient(targetService);
    const response = await client.delete(endpoint);
    return response.data;
  }

  // File upload helper (for multipart/form-data)
  async uploadFile(targetService, endpoint, formData, headers = {}) {
    const client = this.getClient(targetService);
    const response = await client.post(endpoint, formData, {
      headers: {
        ...formData.getHeaders?.(),
        ...headers
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return response.data;
  }
}

// ✅ EXPORT THE CLASS (not an instance)
module.exports = ServiceClient;