const express = require("express");
const router = express.Router();
const multer = require("multer");

const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const brandController = require("../controllers/admin/brandController");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");
const salesreportController = require("../controllers/admin/salesreportController");
const dashboardController = require("../controllers/admin/dashboardController");

const { userAuth, adminAuth } = require("../middlewares/auth");
const { storage, fileFilter } = require("../helpers/multer");
const offerController = require("../controllers/admin/offerController");

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } 
});

router.get("/pageerror", adminController.pageerror);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

// Customer management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);

// Product management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/blockProduct", adminAuth, productController.blockProduct);
router.post("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);

// Brand Management
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, upload.single("logo"), brandController.addBrand);
router.post("/blockBrand", adminAuth, brandController.blockBrand);
router.post("/unBlockBrand", adminAuth, brandController.unBlockBrand);
router.post("/deleteBrand", adminAuth, brandController.deleteBrand);

//Order Management
router.get("/orderList",adminAuth,orderController.orderList);
router.post('/updateOrderStatus',orderController.updateOrderStatus);
router.get('/getOrderDetails/:orderId',adminAuth,orderController.getOrderDetails);
router.get('/returnRequests',adminAuth,orderController.getReturnRequests);
router.post('/handleReturnAction',adminAuth,orderController.handleReturnAction);
router.post('/addToInventory', adminAuth, orderController.addToInventory);

//Coupon Management
router.get("/coupon",adminAuth,couponController.couponList);
router.post("/coupon/add",adminAuth,couponController.addCoupon);
router.post('/coupon/toggle-status/:id',adminAuth,couponController.toggleCouponStatus);

//Sales report Management
router.get("/sales-report",adminAuth,salesreportController.salesreportPage);
router.get("/sales-report/download/pdf",adminAuth,salesreportController.downloadSalesReportPDF);
router.get('/sales-report/download/excel',adminAuth,salesreportController.downloadSalesReportExcel);

//Offer Management
router.post("/add-product-offer", adminAuth, offerController.addProductOffer);
router.post("/remove-product-offer/:productId", adminAuth, offerController.removeProductOffer);
router.post("/add-category-offer", adminAuth, offerController.addCategoryOffer);
router.post("/remove-category-offer/:categoryId", adminAuth, offerController.removeCategoryOffer);
router.get("/offer-details/:productId", adminAuth, offerController.getProductOfferDetails);

//Dashboard Management
router.get("/dashboard", adminAuth, dashboardController.getDashboard);
router.get("/dashboard/data", adminAuth, dashboardController.getDashboardData);


module.exports = router;