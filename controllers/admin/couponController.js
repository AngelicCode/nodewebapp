const Coupon = require("../../models/couponSchema");

const couponList = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.render('coupon', { coupons });

  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");

  }
};

const addCoupon = async (req, res) => {
  try {
    const {
      couponCode,
      couponType,
      couponDiscount,
      couponValidity,
      couponMinAmount,
      couponMaxAmount,
      limit
    } = req.body;

    const newCoupon = new Coupon({
      couponCode,
      couponType,
      couponDiscount,
      couponValidity,
      couponMinAmount,
      couponMaxAmount,
      limit
    });

    await newCoupon.save();
    res.redirect('/admin/coupon');

  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);
    
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    
    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};


module.exports = {
  couponList,addCoupon,toggleCouponStatus,
};