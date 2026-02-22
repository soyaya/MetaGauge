/**
 * Global error handling middleware
 * Handles all error types with consistent response format
 */

import { AppError } from './errors.js';

export function errorHandler(err, req, res, next) {
  // Log error for debugging
  if (err.isOperational === false || err.statusCode >= 500) {
    console.error('❌ Error:', {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Handle custom AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      ...(err.details && { details: err.details }),
      ...(err.retryAfter && { retryAfter: err.retryAfter }),
    });
  }

  // RPC/Blockchain timeout errors
  if (err.message?.includes('timeout') || err.code === 'TIMEOUT' || err.name === 'AbortError') {
    return res.status(504).json({
      error: 'Gateway Timeout',
      message: 'Blockchain network request timed out. Please try again.',
      code: 'TIMEOUT',
      retryable: true,
    });
  }

  // Network errors
  if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND') || err.message?.includes('Network')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Unable to connect to blockchain network. Please try again later.',
      code: 'NETWORK_ERROR',
      retryable: true,
    });
  }

  // Joi validation error
  if (err.name === 'ValidationError' && err.details) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: err.details,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      error: 'Conflict Error',
      message: `${field || 'Resource'} already exists`,
      field: field,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Token expired',
    });
  }

  // Cast error (invalid ObjectId/UUID)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
      message: 'Invalid resource ID format',
    });
  }

  // Default error - don't expose internal errors in production
  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Something went wrong';

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export default errorHandler;