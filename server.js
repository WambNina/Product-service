// server.js
require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/config/database');
const initDatabase = require('./src/config/initDatabase');

const USE_SEQUELIZE_SYNC = process.env.USE_SEQUELIZE_SYNC === 'true';

// Always export for Vercel
module.exports = app;

// Local development only
if (require.main === module) {
  const startServer = async () => {
    try {
      if (USE_SEQUELIZE_SYNC) {
        await sequelize.authenticate();
        console.log('✅ MySQL Database connected successfully.');
      } else {
        await initDatabase();
        await sequelize.authenticate();
        console.log('✅ MySQL Database connected successfully.');
      }

      const PORT = process.env.PORT || 3002;
      app.listen(PORT, () => {
        console.log(`🚀 Product Service running on port ${PORT}`);
        console.log(`📚 Swagger Docs: http://localhost:${PORT}/api-docs`);
        console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
      });
    } catch (error) {
      console.error('❌ Unable to start server:', error);
      process.exit(1);
    }
  };
  startServer();
}