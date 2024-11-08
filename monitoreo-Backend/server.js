// server.js
require('dotenv').config();
const app = require('./src/app');
const { sequelize, initializeDatabase } = require('./src/models');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('Database connection established');

    // Inicializar base de datos
    await initializeDatabase(false);
    console.log('Database initialized');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Available routes:');
      console.log('  GET  /api/test');
      console.log('  GET  /api/machines');
      console.log('  POST /api/machines');
      console.log('  POST /api/machine-state');
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();