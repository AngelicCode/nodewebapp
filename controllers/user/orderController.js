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

module.exports = {
  orderSuccess,
}