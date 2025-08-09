const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");

const orderSuccess = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user._id;

        if (!orderId) {
            return res.redirect('/');
        }

        const order = await Order.findOne({
            _id: orderId,
            userId: userId
        });

        if (!order) {
            return res.redirect('/');
            
        }

        res.render('order-success', {
            order
        });

    } catch (error) {
        console.error('Error loading order success page:', error);
        res.redirect('/');
    }
}

const getOrders = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    const orders = await Order.find({userId})
        .sort({createdAt:-1})
        .populate({
          path: "orderItems.productId",
          select:"images"
        });

        res.render("profile",{
          orders,
          user:req.session.user,
          userAddress:req.session.userAddress || {}
        });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/profile');
  }
}


module.exports = {
  orderSuccess,getOrders,
}