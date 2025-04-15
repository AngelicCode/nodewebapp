const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");

router.get("/pageNotFound",userController.pageNotFound);

router.get("/",userController.loadHomepage);

router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);

router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));

router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    // Save to session manually
    req.session.user = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
    };
    res.redirect("/");
  }
);


router.get("/login",userController.loadLogin);
router.post("/login",userController.login);


router.get("/shop",userController.loadShopping);


module.exports = router;