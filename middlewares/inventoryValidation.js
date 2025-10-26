const Product = require("../models/productSchema");
const Brand = require("../models/brandSchema");
const Category = require("../models/categorySchema");
const Cart = require("../models/cartSchema");
const { getLargestOffer } = require('../helpers/offerHelper');

const validateCheckoutItems = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [
        { path: "category" },
        { path: "brand" }
      ]
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ 
        status: false, 
        message: "Cart is empty" 
      });
    }

    const validationErrors = [];
    const validItems = [];

    for (const item of cart.items) {
      const product = item.productId;
      
      if (!product) {
        validationErrors.push({
          productId: item.productId._id,
          productName: "Unknown Product",
          message: "Product not found"
        });
        continue;
      }

      if (product.isBlocked) {
        validationErrors.push({
          productId: product._id,
          productName: product.productName,
          message: "Product is unavailable"
        });
        continue;
      }

      if (!product.brand || product.brand.isBlocked) {
        validationErrors.push({
          productId: product._id,
          productName: product.productName,
          message: "Brand is unavailable"
        });
        continue;
      }

      if (!product.category || product.category.isListed === false) {
        validationErrors.push({
          productId: product._id,
          productName: product.productName,
          message: "Category is unavailable"
        });
        continue;
      }

      if (product.quantity < item.quantity) {
        validationErrors.push({
          productId: product._id,
          productName: product.productName,
          message: `Only ${product.quantity} units available`,
          available: product.quantity,
          requested: item.quantity
        });
        continue;
      }

      const offer = await getLargestOffer(product._id);
      const finalPrice = offer.percentage > 0 ? offer.finalPrice : product.salePrice;

      validItems.push({
        ...item.toObject(),
        offerPrice: finalPrice,
        offer: offer
      });
    }

    if (validationErrors.length > 0) {
      
      if (req.method === 'GET') {
        return res.json({
          status: false,
          message: "Some items in your cart are no longer available",
          errors: validationErrors,
          validItems: validItems.map(item => ({
            productId: item.productId._id,
            productName: item.productId.productName,
            quantity: item.quantity
          }))
        });
      }
      
      return res.status(400).json({
        status: false,
        message: "Some items in your cart are unavailable",
        errors: validationErrors,
        validItems: validItems.map(item => ({
          productId: item.productId._id,
          productName: item.productId.productName,
          quantity: item.quantity
        }))
      });
    }

    req.validatedCartItems = validItems;

     if (req.method === 'GET') {
      return res.json({ 
        status: true, 
        message: "All cart items are valid",
        validItemsCount: validItems.length
      });
    }

    next();
  } catch (error) {
    console.error("Inventory validation error:", error);

    if (req.method === 'GET') {
      return res.status(500).json({ 
        status: false, 
        message: "Server error during cart validation" 
      });
    }

    res.status(500).json({ 
      status: false, 
      message: "Server error during inventory validation" 
    });
  }
};

module.exports = { validateCheckoutItems };