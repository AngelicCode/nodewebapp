const express = require("express");
const path = require("path");
const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://87976f38786a.ngrok-free.app");
  next();
});


const {
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
} = require("./middlewares");

const env = require("dotenv").config();

const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const { pageerror } = require("./controllers/admin/adminController");

const fs = require("fs");


// Use middlewares
app.use(corsMiddleware);
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

// Middleware moved to specific routes
app.use(nocacheMiddleware);
app.use(cacheControlMiddleware);

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin')
]);

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads/profile-photos", express.static(path.join(__dirname, "public/uploads/profile-photos")));
app.use("/admin", adminSession, adminRouter);
app.use("/", userSession, passport.initialize(), passport.session(), userSessionMiddleware, userRouter);

app.use("/uploads", uploadsMiddleware);
app.use('/uploads/product-images', productImagesMiddleware);
app.use('/uploads/product-images', imageErrorMiddleware);

app.get("/pageerror", pageerror);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server Running...");
});

module.exports = app;
