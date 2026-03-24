const ServiceClient = require("../utils/serviceClient");

class StoreService {
  constructor() {
    this.client = new ServiceClient("PRODUCT-SERVICE");
  }

  /**
   * Verify store exists and belongs to merchant
   */
  async validateStore(store_id, merchant_id) {
    try {
      const store = await this.client.get("STORE", `/api/stores/${store_id}`);

      if (!store.data) {
        throw new Error("Store not found");
      }
      console.log("Store found:", store.data); // Debug log
      console.log("Store merchant_id:", store.data.merchant_id);
      console.log("Provided merchant_id:", merchant_id);

         // Check if merchant_id matches (handle type conversion)
    if (String(store.data.merchant_id) !== String(merchant_id)) {
      throw new Error('Store does not belong to this merchant');
    }
    
    return store.data;
  } catch (error) {
    console.error('Store validation failed:', error.message);
    throw error;
  }
}

  /**
   * Get store details
   */
  async getStore(store_id) {
    try {
      const store = await this.client.get("STORE", `/api/stores/${store_id}`);
      return store.data;
    } catch (error) {
      console.error("❌ Failed to fetch store:", error.message);
      return null;
    }
  }

  /**
   * Check if store is active
   */
  async isStoreActive(store_id) {
    try {
      const store = await this.getStore(store_id);
      return store && store.status === "active";
    } catch {
      return false;
    }
  }
}

module.exports = new StoreService();
