const express = require("express");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'product-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  try {
    fs.chmodSync(uploadDir, 0o755);
  } catch (chmodError) {
    console.log('Could not set directory permissions:', chmodError.message);
  }
}

const uploadsMiddleware = express.static(path.join(__dirname, '..', "public", "uploads"));

const productImagesMiddleware = express.static(uploadDir, {
  fallthrough: false,
  setHeaders: (res, filePath) => {
    res.set('Cache-Control', 'public, max-age=31536000');
  }
});

const imageErrorMiddleware = (err, req, res, next) => {
  if (err.status === 404) {
    console.log('Missing image requested:', req.path);
    res.status(404).send();
  } else {
    next(err);
  }
};

module.exports = {
  uploadsMiddleware,
  productImagesMiddleware,
  imageErrorMiddleware
};