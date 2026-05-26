/**
 * Global Error Handler Middleware
 */

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  // Prisma/Database errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Resource already exists',
      field: err.meta?.target
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Resource not found'
    });
  }

  // Axios errors (from data service proxy)
  if (err.isAxiosError) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.detail || err.message;
    
    return res.status(status).json({
      error: 'Data Service Error',
      message: message
    });
  }

  // Default server error
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
};

/**
 * Async handler wrapper to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  asyncHandler
};
