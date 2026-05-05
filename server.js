const app = require('./src/app');
const { sequelize } = require('./src/config/database');
const initDatabase = require('./src/config/initDatabase');
const initCronJobs = require('./src/jobs/cronJobs');

const PORT = process.env.PORT || 3002;
const USE_SEQUELIZE_SYNC = process.env.USE_SEQUELIZE_SYNC === 'true';



const startServer = async () => {
  try {
    if (USE_SEQUELIZE_SYNC) {
      await sequelize.authenticate();
      console.log('✅ MySQL Database connected successfully.');
      // await sequelize.sync({ alter: true });
      console.log('✅ Database models synchronized.');
    } else {
      await initDatabase();
      await sequelize.authenticate();
      console.log('✅ MySQL Database connected successfully.');
    }

    // initCronJobs();
    // app.listen(3002, '0.0.0.0', () => {
    //   console.log("Server running on port 3002");
    //   console.log(`📚 Swagger Docs: http://localhost:${PORT}/api-docs`);
    // });
    // app.listen(PORT, () => {
    //   console.log(`🚀 Product Service running on port ${PORT}`);
    //   console.log(`📚 Swagger Docs: http://localhost:${PORT}/api-docs`);
    //   console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    // });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();