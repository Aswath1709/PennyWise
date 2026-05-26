/**
 * Authentication Middleware
 * Handles JWT token verification and user existence checks
 */

const jwt = require('jsonwebtoken');
const db = require('../services/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Primary Authentication Middleware (Strict)
 * Used by routes/auth.js as 'authenticateToken'
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists in DB (Forces logout if DB was wiped)
    const userResult = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1', 
      [decoded.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists. Please re-register.' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userResult = await db.query('SELECT id, email FROM users WHERE id = $1', [decoded.id]);
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
      }
    }
    next();
  } catch (error) {
    next(); 
  }
};

// EXPORT ALL FUNCTIONS NEEDED BY YOUR ROUTES
module.exports = {
  authenticateToken,
  generateToken,
  optionalAuth,
  auth: authenticateToken // Alias in case other routes use 'auth'
};