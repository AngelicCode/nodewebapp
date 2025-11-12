const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongodb = require("mongodb");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const { getCartCount } = require('../../helpers/cartHelper');
const { getLargestOffer } = require('../../helpers/offerHelper');

const testCart = async(req,res)=>{
  try {
    res.json({ 
        status: true, 
        message: "All cart items are valid" 
    });

  } catch (error) {
    console.error(error);
    
  }
}

const getCartPage = async (req, res) => {
  try {
    const id = req.session.user._id;
    if (!id) {
      return res.redirect('/login');
    }

    const cartCount = await getCartCount(id);

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const cart = await Cart.findOne({ userId: id })
      .populate({
        path: "items.productId",
        populate: [
          { path: "category" },
          { path: "brand" }
        ]
      })
      .lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.render("cart", {
        user: req.session.user,
        data: [],
        quantity: 0,
        grandTotal: 0,
        discountedTotal: 0,
        totalSavings: 0,
        currentPage: page,
        totalPages: 1,
        query: {}
      });
    }

    const filteredItems = (cart.items || []).filter(item => {
      const product = item.productId;
      return product &&
        !product.isBlocked &&
        product.category && product.category.isListed !== false &&
        product.brand && !product.brand.isBlocked;
    });

    const itemsWithOffers = await Promise.all(
      filteredItems.map(async (item) => {
        const offer = await getLargestOffer(item.productId._id);
        return {
          ...item,
          offer: offer
        };
      })
    );

    const validItems = itemsWithOffers.filter(item=> item.productId.quantity > 0);
    const outOfStockItems = itemsWithOffers.filter(item => item.productId.quantity <= 0);

    const totalItems = itemsWithOffers.length;
    const totalPages = Math.ceil(totalItems / limit);

    const paginatedItems = itemsWithOffers
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(skip, skip + limit);

    const data = await Promise.all(
      paginatedItems.map(async (item) => {
        const offer = await getLargestOffer(item.productId._id);
        const originalPrice = item.price;
        const finalPrice = offer.percentage > 0 ? offer.finalPrice : originalPrice;
        const itemTotal = finalPrice * item.quantity;
        const originalTotal = originalPrice * item.quantity;
        const savings = originalTotal - itemTotal;

        return {
          ...item.productId,
          cartQuantity: item.quantity,
          cartTotal: itemTotal,
          originalTotal: originalTotal,
          finalPrice: finalPrice,
          savings: savings,
          offer: offer,
          itemId: item._id,
          inStock: item.productId.quantity > 0,
        };
      })
    );

    const quantity = validItems.reduce((sum, i) => sum + i.quantity, 0);
    const grandTotal = validItems.reduce((sum, item) => {
      const originalTotal = item.price * item.quantity;
      return sum + originalTotal;
    }, 0);
    const discountedTotal = validItems.reduce((sum, item) => {
      const offer = item.offer;
      const finalPrice = offer.percentage > 0 ? offer.finalPrice : item.price;
      return sum + (finalPrice * item.quantity);
    }, 0);

    const totalSavings = grandTotal - discountedTotal;

    req.session.grandTotal = discountedTotal;

    res.render("cart", {
      user: req.session.user,
      data,
      quantity,
      grandTotal: grandTotal,
      discountedTotal: discountedTotal,
      totalSavings: totalSavings,
      currentPage: page,
      totalPages,
      query: req.query || {},
      cartCount , 
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};


const addToCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const productId = req.body.productId;

    if (!userId) {
      return res.status(401).json({ status: "User not authenticated" });
    }

    const product = await Product.findById(productId)
      .populate('category')
      .populate('brand');

    if (!product) {
      return res.json({ status: "Product not found" });
    }

    if (product.isBlocked) {
      return res.json({
        status: false,
        type: "blocked",
        message: "This product is currently blocked by the admin."
      });
    }

    if (!product.category || product.category.isListed === false) {
      return res.json({
        status: false,
        type: "category_unlisted",
        message: "This product's category is not available at the moment."
      });
    }

    if (!product.brand || product.brand.isBlocked) {
      return res.json({
        status: false,
        type: "brand_blocked",
        message: "This product's brand is currently blocked."
      });
    }

    if (product.quantity <= 0) {
      return res.json({
        status: false,
        type: "out_of_stock",
        message: "This product is currently out of stock."
      });
    }

    const currentOffer = await getLargestOffer(productId);
    const finalPrice = currentOffer.percentage > 0 ? currentOffer.finalPrice : product.salePrice;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{
          productId,
          quantity: 1,
          price: finalPrice,
          originalPrice: product.salePrice,
          totalPrice: finalPrice,
          addedAt: new Date()
          
        }]
      });
    } else {
      const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

      if (existingItemIndex === -1) {
        cart.items.push({
          productId,
          quantity: 1,
          price: finalPrice,
          originalPrice: product.salePrice,
          totalPrice: finalPrice,
          addedAt: new Date()
          
        });
       } else {
        const existingItem = cart.items[existingItemIndex];
        existingItem.price = finalPrice;
        existingItem.originalPrice = product.salePrice;
        existingItem.totalPrice = finalPrice * existingItem.quantity;
      }
    }

    await cart.save();
    const cartCount = await getCartCount(userId);
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: productId } } }
    );

    res.json({ 
      status: true,
      cartCount:cartCount,
    });

  } catch (error) {
    console.error("Add to Cart error:", error);
    res.status(500).json({ status: false, error: "Server error" });
  }
};


const changeQuantity = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId, count } = req.body;

    if (!userId) return res.status(401).json({ status: false, message: "Unauthorized" });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ status: false, message: "Cart not found" });

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ status: false, message: "Product not in cart" });

    const product = await Product.findById(productId)
      .populate('category')
      .populate('brand');

    if (!product) return res.status(404).json({ status: false, message: "Product not found" });

    if (
      product.isBlocked || 
      !product.category || 
      product.category.isListed === false || 
      !product.brand || 
      product.brand.isBlocked
    ) {
      return res.status(400).json({ 
        status: false, 
        message: "This product is no longer available" 
      });
    }

    let newQuantity = cart.items[itemIndex].quantity + parseInt(count);
    if (newQuantity < 1) newQuantity = 1;

    if (newQuantity > 5) {
      return res.status(400).json({ status: false, message: "Maximum quantity per item in cart is 5" });
    }

    const availability = await checkProductAvailability(productId, newQuantity);
    if (!availability.available) {
      return res.status(400).json({
        status: false,
        message: availability.message,
        availableQuantity: availability.availableQuantity
      });
    }

    const currentOffer = await getLargestOffer(productId);
    const finalPrice = currentOffer.percentage > 0 ? currentOffer.finalPrice : product.salePrice;

    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].price = finalPrice;
    cart.items[itemIndex].originalPrice = product.salePrice;
    cart.items[itemIndex].totalPrice = finalPrice * newQuantity;

    await cart.save();
    const cartCount = await getCartCount(userId);

    const productIds = cart.items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate('category')
      .populate('brand');

    const grandTotal = cart.items.reduce((sum, item) => {
      const product = products.find(p => p._id.toString() === item.productId.toString());

      if (
        product &&
        !product.isBlocked &&
        product.category && product.category.isListed !== false &&
        product.brand && !product.brand.isBlocked &&
        product.quantity > 0
      ) {
        return sum + (item.originalPrice * item.quantity);
      }
      return sum;
    }, 0);

    const discountedTotal = cart.items.reduce((sum, item) => {
      const product = products.find(p => p._id.toString() === item.productId.toString());
      if (
        product &&
        !product.isBlocked &&
        product.category && product.category.isListed !== false &&
        product.brand && !product.brand.isBlocked &&
        product.quantity > 0
      ) {
        return sum + item.totalPrice; 
      }
      return sum;
    }, 0);

    const totalSavings = grandTotal - discountedTotal;

    res.json({
      status: true,
      productId,
      quantity: newQuantity,
      totalPrice: cart.items[itemIndex].totalPrice,
      finalPrice: finalPrice,
      grandTotal: grandTotal,
      discountedTotal: discountedTotal,
      totalSavings: totalSavings,
      stock: product.quantity,
      cartCount: cartCount,
      offer: currentOffer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

const deleteProduct = async(req,res)=>{
  try {
    const productId = req.query.id;
    const userId = req.session.user._id;
    if(!userId){
      res.redirect("/login");
    }

    const cart = await Cart.findOne({userId});
    const itemIndex = cart.items.findIndex((item)=>item.productId.toString() === productId);

    cart.items.splice(itemIndex,1);
    await cart.save();
    const cartCount = await getCartCount(userId);

    if (req.headers['content-type'] === 'application/json' || 
        req.headers.accept?.includes('application/json')) {
      return res.json({ 
        success: true, 
        cartCount: cartCount,
      });
    } else {
    return res.redirect("/cart");
    }

  } catch (error) {
    console.error('Error removing product from cart:', error);
    if (req.headers['content-type'] === 'application/json') {
      return res.status(500).json({ success: false, error: "Server error" });
    } else {
    return res.redirect('/pageNotFound');  
    }
  }
};

const checkProductAvailability = async (productId, requestedQuantity) => {
  const product = await Product.findById(productId)
    .populate('category')
    .populate('brand');
  
  if (!product) {
    return { available: false, message: "Product not found" };
  }
  
  if (product.isBlocked) {
    return { available: false, message: "Product is unavailable" };
  }
  
  if (!product.brand || product.brand.isBlocked) {
    return { available: false, message: "Brand is unavailable" };
  }
  
  if (!product.category || product.category.isListed === false) {
    return { available: false, message: "Category is unavailable" };
  }
  
  if (product.quantity < requestedQuantity) {
    return { 
      available: false, 
      message: `Only ${product.quantity} units available`,
      availableQuantity: product.quantity
    };
  }
  
  return { available: true, product };
};

module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
  testCart,
};
