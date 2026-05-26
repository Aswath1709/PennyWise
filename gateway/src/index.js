/**
 * PennyWise API Gateway
 * Main entry point for the Node.js/Express application
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const accountsRoutes = require('./routes/accounts');
const dataServiceProxy = require('./routes/dataServiceProxy');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============ Security Middleware ============
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // increased limit to prevent blocking local development
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// ============ General Middleware ============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ============ Health Check ============
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'gateway',
    timestamp: new Date().toISOString()
  });
});

// ============ API Routes ============
// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/transactions', authenticateToken, transactionRoutes);
app.use('/api/budgets', authenticateToken, budgetRoutes);
app.use('/api/accounts', authenticateToken, accountsRoutes);

// Proxy to Python data service (auth required)
app.use('/api/data', authenticateToken, dataServiceProxy);

// ============ API Documentation ============
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ============ Root Route ============
app.get('/', (req, res) => {
  res.json({
    service: 'PennyWise API Gateway',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      transactions: '/api/transactions',
      budgets: '/api/budgets',
      dataService: '/api/data',
      docs: '/api/docs'
    }
  });
});

// ============ Error Handling ============
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`🚀 PennyWise Gateway running on port ${PORT}`);
  console.log(`📚 API Docs available at http://localhost:${PORT}/api/docs`);
});

module.exports = app;
