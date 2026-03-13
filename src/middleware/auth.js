const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => {
    // 1. Récupérer le token dans le header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ message: "Token manquant" });
    }

    try {
        // 2. Vérifier le token avec ta clé secrète
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 3. CRUCIAL : Attacher les infos au req.user
        // Vérifie si ton token contient 'id' ou 'merchant_id'
        req.user = decoded; 
        
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token invalide ou expiré" });
    }
};