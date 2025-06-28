const multer = require('multer');
const path = require('path');
const fs = require('fs');

const tempUploadDir = path.resolve(__dirname, '..', 'public', 'uploads', 'temp');
const productImagesDir = path.resolve(__dirname, '..', 'public', 'uploads', 'product-images');

// Create directories if they don't exist
[tempUploadDir, productImagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, 0o755);
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Check if the file is a logo (you might need to adjust this condition based on your field name)
    if (file.fieldname === 'logo' || file.fieldname.includes('logo')) {
      cb(null, productImagesDir);
    } else {
      cb(null, tempUploadDir);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif'
    };
    const ext = mimeToExt[file.mimetype] || '.jpg';
    
    // Use different prefix for logos if needed
    const prefix = (file.fieldname === 'logo' || file.fieldname.includes('logo')) ? 'logo-' : 'temp-';
    cb(null, `${prefix}${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, jpeg, png, gif) are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4
  }
});

module.exports = upload;