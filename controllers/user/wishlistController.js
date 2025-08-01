const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect('/login');

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page-1)*limit;

    let wishlist = await Wishlist.findOne({ userId})
      .populate({
        path: "products.productId",
        populate: [
          { path: "category" },
          { path: "brand" }
        ]
      })
      .lean();

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [] });
    }

    const filteredProducts = (wishlist?.products || [])
      .filter(item => {
        const product = item.productId;
        return product &&
               !product.isBlocked &&          
               product.category &&           
               product.category.isListed !== false && product.brand && !product.brand.isBlocked;  
      });

    const totalProducts = filteredProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);

    const sortedProducts = filteredProducts
      .sort((a, b) => new Date(b.addedOn) - new Date(a.addedOn))
      .slice(skip, skip + limit);

    const viewProducts = sortedProducts.map(item => ({
      ...item.productId,
    }));

    res.render("wishlist", {
      user: req.session.user,
      wishlist: viewProducts,
      currentPage: page,
      totalPages,
      query: req.query || {},
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const addToWishlist = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [{ productId }]
      });
      await wishlist.save();
      
      return res.status(200).json({ status: true, message: "Product added to wishlist" });
    }

      if (wishlist.products.some(item => item.productId.toString() === productId)) {
      return res.status(200).json({ status: false, message: "Product already in wishlist" });
    }

    const userCart = await Cart.findOne({ userId }).lean();
    const existInCart = userCart?.items?.some(item => item.productId.toString() === productId);

    wishlist.products.push({ productId, addedOn: new Date() });
    await wishlist.save();

    return res.status(200).json({ status: true, message: "Product added to wishlist" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

const removeProduct = async (req, res) => {
  try {
    const productId = req.query.productId;
    const userId = req.session.user;

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) return res.redirect("/wishlist");

   await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );
    await wishlist.save();
    return res.redirect("/wishlist");

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

const wishlistAddToCart = async (req,res)=>{
  try {
    const userId = req.session.user._id;
    const productId = req.body.productId;

    if (!userId) {
      return res.status(401).json({ status: "User not authenticated" });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.json({ status: "Product not found" });
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

    res.json({ status: true, cartLength: cart.items.length });

  } catch (error) {
    console.error("Add to Cart error:", error);
    res.status(500).json({ status: false, error: "Server error" });
  }
};


module.exports = {
  loadWishlist,addToWishlist,removeProduct,wishlistAddToCart,
}