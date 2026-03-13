const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const initDatabase = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    console.log('🔄 Initializing database...');
    
    const schemaPath = path.join(__dirname, '../../database_schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    
    for (let statement of statements) {
      statement = statement.trim();
      if (statement && !statement.startsWith('--') && !statement.startsWith('/*')) {
        await connection.query(statement);
      }
    }
    
    console.log('✅ Database schema created successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

module.exports = initDatabase;