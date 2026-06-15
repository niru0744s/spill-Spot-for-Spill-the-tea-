const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & JSON Request Body Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount Wallet Routes
const walletRoutes = require('./routes/walletRoutes');
app.use('/api/v1/wallet', walletRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred on the server.',
  });
});

// Start Server listening
app.listen(PORT, () => {
  console.log('===================================================');
  console.log(`🚀 Spill Backend Server is running on port: ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('===================================================');
});
