const app = require('../server');

// Vercel serverless handler
module.exports = (req, res) => {
  return app(req, res);
};