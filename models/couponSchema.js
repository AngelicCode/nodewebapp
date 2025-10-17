const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  couponCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  couponType: {
    type: String,
    enum: ["percentage", "fixed"], 
    required: true
  },
  couponDiscount: {
    type: Number,
    required: true
  },
  couponValidity: {
    type: Date,
    required: true
  },
  couponMinAmount: {
    type: Number,
    required: true
  },
  couponMaxAmount: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  limit: {
    type: Number,
    required: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model("Coupon", couponSchema);