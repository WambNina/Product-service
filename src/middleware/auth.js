const jwt = require('jsonwebtoken');
const ApiError = require('../utils/apiError');

/**
 * Verify JWT token middleware
 */
const authenticate = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

/**
 * Optional: Verify internal service token OR JWT
 * For service-to-service communication
 */
const verifyInternalOrAuth = (req, res, next) => {
  const internalToken = req.headers['x-internal-token'];
  const authHeader = req.headers.authorization;

  // Check internal token first
  if (internalToken === process.env.SERVICE_INTERNAL_TOKEN) {
    req.isInternal = true;
    return next();
  }

  // If no internal token, require JWT
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

/**
 * Optional: Role-based authorization
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Permissions insuffisantes'
      });
    }
    next();
  };
};

module.exports = {
  authenticate,
  verifyInternalOrAuth,
  authorize
};