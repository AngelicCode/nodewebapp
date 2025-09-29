const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongodb = require("mongodb");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const { getCartCount } = require('../../helpers/cartHelper');


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

    const validItems = filteredItems.filter(item=> item.productId.quantity > 0);
    const outOfStockItems = filteredItems.filter(item => item.productId.quantity <= 0);

    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / limit);

    const paginatedItems = filteredItems
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(skip, skip + limit);

    const data = paginatedItems.map(item => ({
      ...item.productId,
      cartQuantity: item.quantity,
      cartTotal: item.totalPrice,
      itemId: item._id,
      inStock: item.productId.quantity > 0,
    }));

    const quantity = validItems.reduce((sum, i) => sum + i.quantity, 0);
    const grandTotal = validItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0);

    req.session.grandTotal = grandTotal;

    res.render("cart", {
      user: req.session.user,
      data,
      quantity,
      grandTotal,
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

    const cartCount = await getCartCount(userId);

    const product = await Product.findById(productId)
      .populate('category')
      .populate('brand');

    if (!product) {
      return res.json({ status: "Product not found" });
    }

    if(
      product.isBlocked || !product.category || product.category.isListed === false || !product.brand || product.brand.isBlocked
    ){
      return res.json({redirect:"/shop",status:false,message:"This product is Blocked or Unavailable"});

    }

    if (product.quantity <= 0) {
      return res.json({ status: "Product out of stock" });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{
          productId,
          quantity: 1,
          price: product.salePrice,
          totalPrice: product.salePrice,
          
        }]
      });
    } else {
      const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

      if (existingItemIndex === -1) {
        cart.items.push({
          productId,
          quantity: 1,
          price: product.salePrice,
          totalPrice: product.salePrice,
          
        });
       }
    }

    await cart.save();
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: productId } } }
    );

    res.json({ 
      status: true,
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

    const cartCount = await getCartCount(userId);

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

    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price;

    await cart.save();

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
        return sum + item.totalPrice;
      }
      return sum;
    }, 0);

    res.json({
      status: true,
      productId,
      quantity: newQuantity,
      totalPrice: cart.items[itemIndex].totalPrice,
      grandTotal,
      stock: product.quantity,
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

    const cartCount = await getCartCount(userId);
    const cart = await Cart.findOne({userId});
    const itemIndex = cart.items.findIndex((item)=>item.productId.toString() === productId);

    cart.items.splice(itemIndex,1);
    await cart.save();

    if (req.headers['content-type'] === 'application/json' || 
        req.headers.accept?.includes('application/json')) {
      return res.json({ 
        success: true, 
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
};
