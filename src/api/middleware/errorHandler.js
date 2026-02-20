/**
 * Global error handling middleware
 */

export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // RPC/Blockchain timeout errors
  if (err.message.includes('timeout') || err.code === 'TIMEOUT' || err.name === 'AbortError') {
    return res.status(504).json({
      error: 'Gateway Timeout',
      message: 'Blockchain network request timed out. Please try again.',
      code: 'TIMEOUT',
      retryable: true
    });
  }

  // Network errors
  if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND') || err.message.includes('Network')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Unable to connect to blockchain network. Please try again later.',
      code: 'NETWORK_ERROR',
      retryable: true
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      error: 'Duplicate Error',
      message: `${field} already exists`,
      field: field
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Token expired'
    });
  }

  // Cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
      message: 'Invalid resource ID format'
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Error',
    message: statusCode >= 500 ? 'Something went wrong' : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

export default errorHandler;