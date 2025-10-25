const Product = require("../models/productSchema");
const User = require("../models/userSchema");


function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function addReferralBonus(referringUserId, newUserId) {
  try {
    const referralBonus = 50; 
    
    await User.findByIdAndUpdate(referringUserId, {
      $inc: { wallet: referralBonus },
      $push: { redeemedUsers: newUserId } 
    });

    console.log(`₹${referralBonus} added to wallet for user ${referringUserId} for referring ${newUserId}`);
    
  } catch (error) {
    console.error("Error adding referral bonus:", error);
  }
}

module.exports = {
  generateReferralCode,
  addReferralBonus
};