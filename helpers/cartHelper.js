const Cart = require("../models/cartSchema");

const getCartCount = async (userId) => {
  try {
    if (!userId) return 0;
    const cart = await Cart.findOne({ userId });
    return cart ? cart.items.length : 0;
  } catch (error) {
    console.error('Error getting cart count:', error);
    return 0;
  }
};

module.exports = { getCartCount };