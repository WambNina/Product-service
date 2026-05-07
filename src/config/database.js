const mysql2 = require('mysql2'); // Force Vercel to include mysql2 in bundle
const { Sequelize } = require('sequelize');

// Parse DATABASE_URL if provided (Aiven/Vercel), otherwise use individual env vars
const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (databaseUrl) {
  // Production/Vercel mode with Aiven connection string
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    dialectModule: mysql2, // Explicitly tell Sequelize to use this instance
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,          // Lower max for serverless (Vercel has connection limits)
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true,
        // ca: process.env.AIVEN_CA_CERT // Uncomment if Aiven requires CA cert
      }
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  });
} else {
  // Local development mode with individual env vars
  sequelize = new Sequelize(
    process.env.DB_NAME || 'product_service_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      dialectModule: mysql2, // Still explicitly required
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
      }
    }
  );
}

module.exports = { sequelize, Sequelize };