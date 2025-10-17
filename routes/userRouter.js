const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const {userAuth,isBlocked} = require("../middlewares/auth");
const productController = require("../controllers/user/productController");
const profileController = require("../controllers/user/profileController");
const wishlistController = require("../controllers/user/wishlistController");
const cartController = require("../controllers/user/cartController");
const checkoutController = require("../controllers/user/checkoutController");
const orderController = require("../controllers/user/orderController");
const walletController = require("../controllers/user/walletController");
const { validateCheckoutItems } = require("../middlewares/inventoryValidation");
const upload = require("../helpers/multer");


router.get("/pageNotFound",userController.pageNotFound);

//Product Management
router.get("/productDetails",isBlocked,productController.productDetails);
router.post("/detailspageAddToCart",userAuth,productController.detailspageAddToCart);

//Home page & Shopping page
router.get("/",userController.loadHomepage);
router.get("/shop",isBlocked,userController.loadShoppingPage);
router.get('/clear-filters', userAuth, (req, res) => {
    req.session.filterCategory = null;
    req.session.filterBrand = null;
    req.session.priceFilter = null;
    res.redirect('/shop');
});

//Profile Management
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/change-email",userAuth,profileController.changeEmail);
router.post("/change-email",userAuth,profileController.changeEmailValid);
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp);
router.post("/update-email",userAuth,profileController.updateEmail);
router.get("/change-password",userAuth,profileController.changePassword);
router.post("/change-password",userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePasswordOtp);
router.get("/new-email", userAuth, profileController.getNewEmailPage);
router.get("/edit-profile", userAuth, profileController.getEditProfilePage);
router.post("/update-profile-photo", userAuth, upload.single('profilePhoto'), profileController.updateProfilePhoto);
router.post("/remove-profile-photo", userAuth, profileController.removeProfilePhoto);
router.post("/update-profile",userAuth,profileController.updateProfile);

router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);

router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));

router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
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
router.get("/logout",userController.logout);
router.get("/shop",userController.loadShopping);

//Address Management
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);

//Wishlist Management
router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/removeFromWishlist",userAuth,wishlistController.removeProduct);
router.post("/wishlistAddToCart",userAuth,wishlistController.wishlistAddToCart);

// Cart Management
router.get("/cart", userAuth, cartController.getCartPage);
router.post("/addToCart",userAuth, cartController.addToCart);
router.post("/changeQuantity", userAuth,cartController.changeQuantity);
router.get("/deleteItem", userAuth, cartController.deleteProduct);

//Checkout Management
router.get("/checkout",userAuth,checkoutController.loadCheckout);
router.post("/checkoutAddAddress",userAuth,checkoutController.checkoutAddAddress);
router.put("/checkoutEditAddress/:id",userAuth,checkoutController.checkoutEditAddress);
router.post("/place-order",userAuth,validateCheckoutItems, checkoutController.placeOrder);
router.post("/verify-payment", userAuth, checkoutController.verifyRazorpayPayment);
router.get("/order-failure", userAuth,checkoutController.orderFailure);
router.post("/retry-payment", userAuth, checkoutController.handleFailedPayment);
router.post("/apply-coupon", userAuth, checkoutController.applyCoupon);
router.post("/remove-coupon", userAuth, checkoutController.removeCoupon);
router.get("/get-available-coupons", userAuth, checkoutController.getAvailableCoupons);

//Order Management
router.get("/order-success/:id",userAuth,orderController.orderSuccess);
router.get("/orders",userAuth,orderController.getOrders);
router.get("/order-details/:id",userAuth,orderController.getOrderDetails);
router.post("/order/:id/cancel", userAuth, orderController.cancelOrder);
router.post("/order/:id/cancel-item", userAuth, orderController.cancelOrderItem);
router.post("/order/:id/return",userAuth,orderController.returnOrder);
router.post("/order/:id/return-item", userAuth, orderController.returnOrderItem);

//Wallet Management
router.get("/wallet-history",userAuth,walletController.getWalletHistory);
router.get("/wallet-history-data", userAuth, walletController.getWalletHistoryData);
router.post("/add-to-wallet",userAuth,walletController.addToWallet);

module.exports = router;