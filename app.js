const express = require("express");
const path = require("path");
const app = express();
const env = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const { pageerror } = require("./controllers/admin/adminController");
const nocache = require("nocache");
const fs = require("fs");
const {setLocals} = require('./middlewares/localsMiddleware');

app.use(setLocals);

const uploadDir = path.join(__dirname, 'public', 'uploads', 'product-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  try {
    fs.chmodSync(uploadDir, 0o755);
  } catch (chmodError) {
    console.log('Could not set directory permissions:', chmodError.message);
  }
}

db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000,
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(nocache());
app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin')
]);

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

const uploadsDir = path.join(__dirname, 'public', 'uploads', 'product-images');

app.use('/uploads/product-images', express.static(uploadsDir, {
  fallthrough: false,
  setHeaders: (res, filePath) => {
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

app.use('/uploads/product-images', (err, req, res, next) => {
  if (err.status === 404) {
    console.log('Missing image requested:', req.path);
    res.status(404).send();
  } else {
    next(err);
  }
});

app.get("/pageerror", pageerror);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server Running...");
});

module.exports = app;