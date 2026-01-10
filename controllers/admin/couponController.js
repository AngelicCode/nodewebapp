const Coupon = require("../../models/couponSchema");

const couponList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalCoupons = await Coupon.countDocuments({});
    const totalPages = Math.ceil(totalCoupons / limit);

    const coupons = await Coupon.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('coupon', {
      coupons,
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
      search: ''
    });

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
  couponList, addCoupon, toggleCouponStatus,
};