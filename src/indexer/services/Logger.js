/**
 * Structured logging with winston
 */

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'streaming-indexer' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export class Logger {
  static info(message, meta = {}) {
    logger.info(message, meta);
  }

  static error(message, meta = {}) {
    logger.error(message, meta);
  }

  static warn(message, meta = {}) {
    logger.warn(message, meta);
  }

  static debug(message, meta = {}) {
    logger.debug(message, meta);
  }

  static logIndexerEvent(userId, contractAddress, chainId, event, data = {}) {
    logger.info('Indexer Event', {
      userId,
      contractAddress,
      chainId,
      event,
      ...data
    });
  }

  static logRPCRequest(chainId, endpoint, method, duration, success) {
    logger.debug('RPC Request', {
      chainId,
      endpoint,
      method,
      duration,
      success
    });
  }

  static logChunkProcessed(userId, chunkIndex, totalChunks, metrics) {
    logger.info('Chunk Processed', {
      userId,
      chunkIndex,
      totalChunks,
      progress: ((chunkIndex / totalChunks) * 100).toFixed(2),
      ...metrics
    });
  }
}

export default logger;
