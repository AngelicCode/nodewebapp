const nocache = require("nocache");

const nocacheMiddleware = nocache();

const cacheControlMiddleware = (req, res, next) => {
  res.set("cache-control", "no-store");
  next();
};

module.exports = {
  nocacheMiddleware,
  cacheControlMiddleware
};