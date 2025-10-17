const User = require("../models/userSchema");
const Wallet = require("../models/walletSchema");
const Order = require("../models/orderSchema");

const refundToWallet = async (orderId, refundAmount, description) => {
  try {
    const order = await Order.findById(orderId).populate('userId');
    
    if (!order) {
      throw new Error('Order not found');
    }

    const user = await User.findById(order.userId);
    user.wallet += refundAmount;
    await user.save();

    await Wallet.create({
      userId: order.userId,
      orderId: order._id,
      type: "credit",
      amount: refundAmount,
      description: description
    });

    return true;
  } catch (error) {
    console.error('Error refunding to wallet:', error);
    throw error;
  }
};


module.exports = {
  refundToWallet
};