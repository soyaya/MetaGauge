/**
 * Role-based access control middleware
 */

const ROLES = {
  ADMIN: 'admin',
  ANALYST: 'analyst',
  VIEWER: 'viewer'
};

const ROLE_HIERARCHY = {
  admin: 3,
  analyst: 2,
  viewer: 1
};

/**
 * Require specific role or higher
 * @param {string} minRole - Minimum required role
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role || 'admin'; // default to admin for existing users
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: minRole,
        current: userRole
      });
    }

    next();
  };
}

export { ROLES };
