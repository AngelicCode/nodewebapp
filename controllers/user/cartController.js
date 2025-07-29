const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongodb = require("mongodb");
const Cart = require("../../models/cartSchema");



const getCartPage = async (req, res) => {
  try {
    const id = req.session.user._id;
    if (!id) {
      return res.redirect('/login');
    }

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

    if (cart) {
      cart.items.sort((a, b) => b.addedAt - a.addedAt);  
    }

    const totalItems = cart.items.length;
    const totalPages = Math.ceil(totalItems / limit);

    const paginatedItems = cart.items.slice(skip, skip + limit);

    const data = paginatedItems.map(item => ({
      ...item.productId,
      cartQuantity: item.quantity,
      cartTotal: item.totalPrice,
      itemId: item._id,
    }));

    const quantity = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    const grandTotal = cart.items.reduce((sum, i) => sum + (i.totalPrice || 0), 0);

    req.session.grandTotal = grandTotal;

    res.render("cart", {
      user: req.session.user,
      data,
      quantity,
      grandTotal,
      currentPage: page,
      totalPages,
      query: req.query || {}, 
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
      // } else {
      //   if (cart.items[existingItemIndex].quantity < product.quantity) {
      //     cart.items[existingItemIndex].quantity += 1;
      //     cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].price;
      //   } else {
      //     return res.json({ status: "Product out of stock" });
      //   }
       }
    }

    await cart.save();

    res.json({ status: true, cartLength: cart.items.length });

  } catch (error) {
    console.error("Add to Cart error:", error);
    res.status(500).json({ status: false, error: "Server error" });
  }
};


const changeQuantity = async (req, res) => {
  try {
    const id = req.body.productId;
    const user = req.session.user;
    const count = req.body.count;
    // count(-1,+1)
    const findUser = await User.findOne({ _id: user });
    const findProduct = await Product.findOne({ _id: id });
    const oid = new mongodb.ObjectId(user);
    if (findUser) {
      const productExistinCart = findUser.cart.find(
        (item) => item.productId === id
      );
      let newQuantity;
      if (productExistinCart) {
        if (count == 1) {
          newQuantity = productExistinCart.quantity + 1;
        } else if (count == -1) {
          newQuantity = productExistinCart.quantity - 1;
        } else {
          return res
            .status(400)
            .json({ status: false, error: "Invalid count" });
        }
      } else {
      }
      if (newQuantity > 0 && newQuantity <= findProduct.quantity) {
        let quantityUpdated = await User.updateOne(
          { _id: user, "cart.productId": id },
          {
            $set: {
              "cart.$.quantity": newQuantity,
            },
          }
        );
        const totalAmount = findProduct.salePrice * newQuantity;
        const grandTotal = await User.aggregate([
          { $match: { _id: oid } },
          { $unwind: "$cart" },
          {
            $project: {
              proId: { $toObjectId: "$cart.productId" },
              quantity: "$cart.quantity",
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "proId",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          {
            $unwind: "$productDetails", 
          },

          {
            $group: {
              _id: null,
              totalQuantity: { $sum: "$quantity" },
              totalPrice: {
                $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
              }, 
            },
          },
        ]);
        if (quantityUpdated) {
          res.json({
            status: true,
            quantityInput: newQuantity,
            count: count,
            totalAmount: totalAmount,
            grandTotal: grandTotal[0].totalPrice,
          });
        } else {
          res.json({ status: false, error: "cart quantity is less" });
        }
      } else {
        res.json({ status: false, error: "out of stock" });
      }
    }
  } catch (error) {
    res.redirect("/pageNotFound");
    return res.status(500).json({ status: false, error: "Server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cartIndex = user.cart.findIndex((item) => item.productId == id);
    user.cart.splice(cartIndex, 1);
    await user.save();
    res.redirect("/cart");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};
