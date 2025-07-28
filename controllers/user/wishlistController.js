const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect('/login');

    let wishlist = await Wishlist.findOne({ userId })
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

    const sortedProducts = (wishlist?.products || [])
      .filter(item => item.productId)
      .sort((a, b) => new Date(b.addedOn) - new Date(a.addedOn)) 
      .map(item => {
        return {
          ...item.productId,
        };
      });

    res.render("wishlist", {
      user: req.session.user,
      wishlist: sortedProducts 
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


module.exports = {
  loadWishlist,addToWishlist,removeProduct,
}