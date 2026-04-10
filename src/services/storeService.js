const serviceClient = require("../utils/serviceClient");

class StoreService {
  async validateStore(store_id, merchant_id, authToken) { // Add authToken parameter
    try {
      const response = await serviceClient.call(
        "store",
        "GET",
        `/api/v1/stores/${store_id}`,
        null, // body
        { Authorization: authToken } // Pass headers
      );

      const store = response.data;

      if (!store) {
        throw new Error("Store not found");
      }

      if (String(store.merchant_id) !== String(merchant_id)) {
        throw new Error("Store does not belong to this merchant");
      }

      return store;
    } catch (error) {
      console.error("Store validation failed:", error.message);
      throw new Error("Invalid or non-existent store");
    }
  }
}

module.exports = new StoreService();