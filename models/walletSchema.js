const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    default: null
  },
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["success", "pending", "failed"],
    default: "success"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;