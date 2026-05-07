const app = require('../server');

// Vercel serverless handler with explicit promise handling
module.exports = async (req, res) => {
  // Ensure app handles the request properly
  await new Promise((resolve, reject) => {
    app(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};