import jwt from 'jsonwebtoken';
import config from '../config/env.js';

/**
 * Validates the JWT issued by the main MetaGauge app.
 * Attaches decoded user payload to req.user.
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { userId, email, roles, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
