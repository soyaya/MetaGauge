/**
 * Middleware to check if streaming indexer is initialized
 */
export function requireIndexer(req, res, next) {
  if (!req.app.locals.indexerInitialized) {
    return res.status(503).json({
      error: 'Indexer not ready',
      message: 'The streaming indexer is still initializing. Please try again in a moment.',
      status: 'initializing'
    });
  }
  next();
}

/**
 * Middleware to optionally use indexer if available
 */
export function optionalIndexer(req, res, next) {
  req.indexerAvailable = req.app.locals.indexerInitialized || false;
  next();
}
