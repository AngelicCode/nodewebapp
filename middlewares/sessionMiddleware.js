const session = require("express-session");
const mongoStore = require('connect-mongo');
require('dotenv').config();
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000,
  },
  store:  mongoStore.create({
        mongoUrl:process.env.MONGODB_URI,
        ttl:14 * 24 *60 *60,
        collectionName: "sessions",
        autoRemove:'native'

    }),
});


module.exports = sessionMiddleware;