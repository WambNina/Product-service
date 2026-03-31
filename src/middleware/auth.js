const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// Middleware pour autoriser les appels internes entre services
const verifyInternalOrAuth = (req, res, next) => {
  const isInternal = req.headers['x-internal-service'] === 'true';
  const token = req.headers.authorization?.split(' ')[1];

  if (isInternal) {
    // Vérifier un secret interne si nécessaire
    const internalSecret = req.headers['x-internal-secret'];
    if (internalSecret === process.env.INTERNAL_SECRET) {
      return next();
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Token invalide' });
    }
  }

  res.status(401).json({ error: 'Authentification requise' });
};

module.exports = { 
  authenticate,        // ✅ Now exported as authenticate
  verifyInternalOrAuth 
};