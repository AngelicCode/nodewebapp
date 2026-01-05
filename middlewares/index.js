const corsMiddleware = require('./corsMiddleware');
const { nocacheMiddleware, cacheControlMiddleware } = require('./cacheControlMiddleware');
const { userSession, adminSession } = require('./sessionMiddleware');
const userSessionMiddleware = require('./userSessionMiddleware');
const { uploadsMiddleware, productImagesMiddleware, imageErrorMiddleware } = require('./staticFilesMiddleware');
const { setLocals } = require('./localsMiddleware');

module.exports = {
  corsMiddleware,
  nocacheMiddleware,
  cacheControlMiddleware,
  userSession,
  adminSession,
  userSessionMiddleware,
  uploadsMiddleware,
  productImagesMiddleware,
  imageErrorMiddleware,
  setLocals
};