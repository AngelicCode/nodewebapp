const Product = require("../models/productSchema");
const Brand = require("../models/brandSchema");
const Category = require("../models/categorySchema");
const Cart = require("../models/cartSchema");

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

      validItems.push(item);
    }

    if (validationErrors.length > 0) {
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
    next();
  } catch (error) {
    console.error("Inventory validation error:", error);
    res.status(500).json({ 
      status: false, 
      message: "Server error during inventory validation" 
    });
  }
};

module.exports = { validateCheckoutItems };