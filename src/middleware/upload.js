const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/apiError');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/products/'); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limite à 2MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype) return cb(null, true);
        cb(new Error("File format not supported !"));
    }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, GIF allowed`), false);
  }
};

exports.uploadProductImages = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    files: 5
  }
});

exports.handleWhatsAppMedia = async (req, res, next) => {
  if (req.body.source === 'whatsapp' && req.body.media_urls) {
    try {
      const axios = require('axios');
      const mediaUrls = Array.isArray(req.body.media_urls) 
        ? req.body.media_urls.slice(0, 5) 
        : [req.body.media_urls];
      
      req.files = [];
      
      for (const url of mediaUrls) {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
        req.files.push({
          buffer: Buffer.from(response.data),
          originalname: `whatsapp-${Date.now()}.jpg`,
          mimetype: 'image/jpeg',
          size: response.data.length,
          source: 'whatsapp'
        });
      }
    } catch (error) {
      return next(new ApiError(400, 'Failed to process WhatsApp media'));
    }
  }
  next();
};

module.exports = upload;