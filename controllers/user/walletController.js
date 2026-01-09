const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const { refundToWallet } = require("../../helpers/walletHelper");

const getWalletHistory = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const user = await User.findById(userId).select('wallet');
    const transactions = await Wallet.find({ userId })
      .populate('orderId', 'orderId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      walletBalance: typeof user.wallet === "number" ? user.wallet : 0,
      transactions
    });

  } catch (error) {
    console.error('Error fetching wallet history:', error);
    res.status(500).json({ success: false, message: 'Failed to load wallet history' });
  }
};

const getWalletHistoryData = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalTransactions = await Wallet.countDocuments({ userId });
    const transactions = await Wallet.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      transactions,
      totalPages: Math.ceil(totalTransactions / limit),
      currentPage: page
    });
  } catch (error) {
    console.error("Error fetching wallet history:", error);
    res.status(500).json({ success: false, message: "Error loading wallet history" });
  }
};


const addToWallet = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const user = await User.findById(userId);

    if (typeof user.wallet !== "number") {
      user.wallet = 0;
    }

    user.wallet += parseFloat(amount);
    await user.save();

    await Wallet.create({
      userId,
      type: "credit",
      amount: parseFloat(amount),
      description: "Money added to wallet"
    });

    res.json({
      success: true,
      message: `₹${amount} added to wallet successfully`,
      newBalance: user.wallet
    });

  } catch (error) {
    console.error('Error adding to wallet:', error);
    res.status(500).json({ success: false, message: 'Failed to add money to wallet' });
  }
};


module.exports = {
  getWalletHistory,
  addToWallet,
  getWalletHistoryData,

};