const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Set global appRoot variable (similar to APTIS)
global.appRoot = path.resolve(__dirname);

// Initialize database connection (auto-detects MySQL or MSSQL)
const sqldb = require('./config/db.config.auto');

const app = express();

// Middleware
app.use(cors());
// Capture the raw body bytes so gateway webhook signatures can be verified exactly.
app.use(bodyParser.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes (APTIS-style structure)
app.use('/api', require('./api/routes/apiRoutes'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    status: 500, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

// Start server with database connection
async function startServer() {
  try {
    // Test database connection
    console.log('\n📊 Initializing database connection...');
    await sqldb.connect();
    
    // Create an explicit HTTP server so the OCPP WebSocket server can attach to it
    const server = http.createServer(app);

    // Attach the OCPP 2.0.1 WebSocket server (charge points connect at /ocpp/<id>)
    const { attachOcpp } = require('./api/ocpp/ocppServer');
    attachOcpp(server);

    server.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📱 Auth API available at http://localhost:${PORT}/api/auth`);
      console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
      console.log(`🔌 OCPP WebSocket at ws://localhost:${PORT}/ocpp/<chargePointId>`);
      console.log(`💾 Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST}\n`);
    });
  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message);
    console.error('Please check your database configuration in .env file\n');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Shutting down gracefully...');
  try {
    await sqldb.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();

module.exports = app;
