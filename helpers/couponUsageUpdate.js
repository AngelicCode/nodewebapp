const Coupon = require("../models/couponSchema");
const User = require("../models/userSchema");


const updateCouponUsage = async (couponCode, userId) => {
  try {
    const coupon = await Coupon.findOne({ couponCode: couponCode });
    
    if (coupon) {
      coupon.usageCount += 1;
      
      coupon.usedBy.push({
        userId: userId,
        usedAt: new Date()
      });
      
      await coupon.save();
    }
  } catch (error) {
    console.error('Error updating coupon usage:', error);
  }
};

module.exports = {
  updateCouponUsage,
}