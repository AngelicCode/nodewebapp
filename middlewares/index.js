const corsMiddleware = require('./corsMiddleware');
const { nocacheMiddleware, cacheControlMiddleware } = require('./cacheControlMiddleware');
const sessionMiddleware = require('./sessionMiddleware');
const userSessionMiddleware = require('./userSessionMiddleware');
const { uploadsMiddleware, productImagesMiddleware, imageErrorMiddleware } = require('./staticFilesMiddleware');
const { setLocals } = require('./localsMiddleware');

module.exports = {
  corsMiddleware,
  nocacheMiddleware,
  cacheControlMiddleware,
  sessionMiddleware,
  userSessionMiddleware,
  uploadsMiddleware,
  productImagesMiddleware,
  imageErrorMiddleware,
  setLocals
};