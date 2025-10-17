const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const { getCartCount } = require('../../helpers/cartHelper');
const Razorpay = require('razorpay');
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
const crypto = require('crypto');
const Coupon = require("../../models/couponSchema");

const loadCheckout = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    if(!userId){
     return res.status(401).json({status:false,message:"User not authenticated"})
    }

    const cartCount = await getCartCount(userId);

    const addressDoc = await Address.findOne({userId:userId});
    const addresses = addressDoc?addressDoc.address :[];

    const cart = await Cart.findOne({userId:userId})
    .populate("items.productId");
    if(!cart || cart.items.length == 0){
      return res.redirect("/cart");
    }

    res.render("checkout",{
      addresses,
      cartItems: cart.items,
      cartCount: cartCount,
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
}

const checkoutAddAddress = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    if (!userId) {
      return res.status(401).json({ status: false, message: 'User not authenticated' });
        }

      const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;
      if(!name || !city || !state || !pincode || !phone){
        return res.status(400).json({status:false,message:"Missing required fields"});
      }

      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ status: false, message: 'Phone number must be 10 digits' });
      }

      if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ status: false, message: 'Pincode must be 6 digits' });
      }

      if (altPhone && !/^\d{10}$/.test(altPhone)) {
        return res.status(400).json({ status: false, message: 'Alternate phone must be 10 digits' });
      }

      const addressData = {
        addressType: addressType || "Home",
        name,
        city,
        landMark,
        state,
        pincode,
        phone,
        altPhone: altPhone || undefined,
        
      };

      const userAddress = await Address.findOne({userId:userId});
      if(!userAddress){
        const newAddress = new Address({
          userId:userId,
          address:[addressData]
        });
        await newAddress.save();
        
      }else{
        userAddress.address.push(addressData);
        await userAddress.save();
      }
      return res.json({ status: true, message: 'Address added successfully'});
     
    } catch (error) {
      console.error("Error adding address:",error)
      return res.status(500).json({ status: false, message: 'Internal server error' });
      
    }
}

const checkoutEditAddress = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    const addressId = req.params.id;
    if(!userId){
      return res.status(401).json({status:false,message:"User is not authenticated"});
    }

    const {name,city,state,pincode,phone,altPhone,addressType,landMark} = req.body;
    if(!name || !city || !state || !pincode || !phone || !addressType || !landMark){
      return res.status(400).json({status:false,message:"Missing required fields"});
    }

     if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ status: false, message: 'Phone number must be 10 digits' });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ status: false, message: 'Pincode must be 6 digits' });
    }

    if (altPhone && !/^\d{10}$/.test(altPhone)) {
      return res.status(400).json({ status: false, message: 'Alternate phone must be 10 digits' });
    }

    const result = await Address.findOneAndUpdate(
      {userId:userId, "address._id" : addressId},
      {
        $set:{
          "address.$.name": name,
          "address.$.city": city,
          "address.$.state": state,
          "address.$.pincode": pincode,
          "address.$.phone": phone,
          "address.$.altPhone": altPhone || undefined,
          "address.$.addressType": addressType,
          "address.$.landMark": landMark
        }
      },
      {new:true}
    );

    if (!result) {
      return res.status(404).json({ status: false, message: 'Address not found' });
    }

    return res.json({ status: true, message: 'Address updated successfully' });

  } catch (error) {
    console.error("Error editing address:", error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  
  }
};

const placeOrder = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    if (!userId) {
        return res.status(401).json({ status: false, message: 'User not authenticated' });
    }

     const { addressId, paymentMethod, cartItems, subtotal, shipping, tax, total, coupon } = req.body;

     const validatedItems = req.validatedCartItems;
    
    if (!validatedItems || validatedItems.length === 0) {
      return res.status(400).json({ 
        status: false, 
        message: "No valid items to order" 
      });
    }

    if (!addressId || !paymentMethod) {
        return res.status(400).json({ 
            status: false,
            message: 'Missing required order data' 
        });
    }

     if (paymentMethod === 'wallet') {
        const user = await User.findById(userId);
        if (user.wallet < total) {
            return res.status(400).json({
                status: false,
                message: 'Insufficient wallet balance'
            });
        }
    }

    if (paymentMethod === 'razorpay') {
            try {
                const razorpayOrder = await createRazorpayOrder(total);
                
                return res.json({
                    status: true,
                    message: 'Razorpay order created',
                    razorpayOrder: razorpayOrder,
                    orderData: {
                        addressId,
                        paymentMethod,
                        cartItems: validatedItems,
                        subtotal,
                        shipping,
                        tax,
                        total
                    }
                });
            } catch (error) {
                return res.status(500).json({
                    status: false,
                    message: 'Failed to create Razorpay order'
                });
            }
        }

     const addressDoc = await Address.findOne({ 
        userId: userId,
        "address._id": addressId 
    });

    if (!addressDoc) {
        return res.status(404).json({ 
            status: false,
            message: 'Address not found' 
        });
    }

    const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);

     const orderItems = validatedItems.map(item => ({
      productId: item.productId._id,
      productName: item.productId.productName,
      price: item.productId.salePrice,
      quantity: item.quantity
    }));

    const newOrder = new Order({
            userId: userId,
            addressId: addressId,
            shippingAddress: {
                addressType: selectedAddress.addressType,
                name: selectedAddress.name,
                city: selectedAddress.city,
                landMark: selectedAddress.landMark,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
                phone: selectedAddress.phone,
                altPhone: selectedAddress.altPhone
            },
            paymentMethod: paymentMethod,
            orderItems: orderItems,
            total: parseFloat(subtotal),
            shipping: parseFloat(shipping),
            tax: parseFloat(tax),
            finalAmount: parseFloat(total),
            status: paymentMethod === 'cod' ? 'pending' : 'confirmed',
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
            couponDetails: coupon ? {
              couponCode: coupon.code,
              couponType: coupon.type,
              couponDiscount: coupon.discount,
              discountAmount: coupon.discountAmount
            } : null,
            discount: coupon ? coupon.discountAmount : 0
        });

        await newOrder.save();

        if (paymentMethod === 'wallet') {
        const user = await User.findById(userId);
        
        user.wallet -= parseFloat(total);
        await user.save();

        await Wallet.create({
            userId,
            type: "debit",
            amount: parseFloat(total),
            description: `Payment for order ${newOrder.orderId}`
        });
    }
      
        for (const item of validatedItems) {
          await Product.findByIdAndUpdate(
            item.productId._id,
            { $inc: { quantity: -item.quantity } }
          );
        }

        await Cart.findOneAndUpdate(
            { userId: userId },
            { $set: { items: [] } }
        );

         return res.json({
            status: true,
            message: 'Order placed successfully',
            orderId:  newOrder._id,
      
        });        

  } catch (error) {
    console.error('Error placing order:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to place order'
        });
  }
}

const createRazorpayOrder = async (amount, currency = 'INR') => {
    try {
      if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Invalid amount provided');
        }

        const amountInPaise = Math.round(amount * 100);
        
        if (amountInPaise < 100) {
            throw new Error('Amount must be at least 1 INR');
        }

        const options = {
            amount: amountInPaise, 
            currency: currency,
            receipt: `receipt_${Date.now()}`
        };
        
        const order = await razorpayInstance.orders.create(options);
        return order;
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        throw new Error('Failed to create payment order');
    }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData
    } = req.body;

    const userId = req.session.user._id;
    
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');
    
    if (generatedSignature !== razorpay_signature) {
      return res.json({
        status: false,
        message: 'Payment verification failed',
        redirectUrl: `/order-failure?reason=verification_failed&amount=${orderData.total}&orderData=${encodeURIComponent(JSON.stringify(orderData))}`
      });
    }
    
    const { addressId, subtotal, shipping, tax, total, coupon } = orderData;
    
    const addressDoc = await Address.findOne({ 
      userId: userId,
      "address._id": addressId 
    });

    if (!addressDoc) {
      return res.status(404).json({ 
        status: false,
        message: 'Address not found' 
      });
    }

    const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);

    const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ 
        status: false,
        message: 'Cart is empty' 
      });
    }

    const validatedItems = [];
    for (const item of cart.items) {
      const product = item.productId;
      if (product && product.quantity >= item.quantity) {
        validatedItems.push(item);
      }
    }

    if (validatedItems.length === 0) {
      return res.status(400).json({ 
        status: false,
        message: 'No valid items to order' 
      });
    }

    const orderItems = validatedItems.map(item => ({
      productId: item.productId._id,
      productName: item.productId.productName,
      price: item.productId.salePrice,
      quantity: item.quantity
    }));

    let order = await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (order) {
      order.orderItems = orderItems;
      order.shippingAddress = {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone
      };
      order.total = parseFloat(subtotal);
      order.shipping = parseFloat(shipping);
      order.tax = parseFloat(tax);
      order.finalAmount = parseFloat(total);
      order.status = 'confirmed';
      order.paymentStatus = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.paidAt = new Date();
      
      order.couponDetails = coupon ? {
        couponCode: coupon.code,
        couponType: coupon.type,
        couponDiscount: coupon.discount,
        discountAmount: coupon.discountAmount
      } : null;
      order.discount = coupon ? coupon.discountAmount : 0;
      
      await order.save();

    } else {
      order = new Order({
        userId: userId,
        addressId: addressId,
        shippingAddress: {
          addressType: selectedAddress.addressType,
          name: selectedAddress.name,
          city: selectedAddress.city,
          landMark: selectedAddress.landMark,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          phone: selectedAddress.phone,
          altPhone: selectedAddress.altPhone
        },
        paymentMethod: 'razorpay',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        orderItems: orderItems,
        total: parseFloat(subtotal),
        shipping: parseFloat(shipping),
        tax: parseFloat(tax),
        finalAmount: parseFloat(total),
        status: 'confirmed',
        paymentStatus: 'paid',
        paidAt: new Date(),

        couponDetails: coupon ? {
          couponCode: coupon.code,
          couponType: coupon.type,
          couponDiscount: coupon.discount,
          discountAmount: coupon.discountAmount
        } : null,
        discount: coupon ? coupon.discountAmount : 0
      });

      await order.save();
    }

    for (const item of validatedItems) {
      await Product.findByIdAndUpdate(
        item.productId._id,
        { $inc: { quantity: -item.quantity } }
      );
    }

    await Cart.findOneAndUpdate(
      { userId: userId },
      { $set: { items: [] } }
    );

    return res.json({
      status: true,
      message: 'Order placed successfully',
      orderId: order._id,
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to verify payment'
    });
  }
};

const orderFailure = async (req, res) => {
  try {
    const reason = req.query.reason || 'unknown';    

    const reasonMessages = {
      'payment_failed': 'Your payment could not be processed.',
      'verification_failed': 'Payment verification failed.',
      'server_error': 'A server error occurred during payment processing.',
      'insufficient_funds': 'Insufficient funds in your account.',
      'card_declined': 'Your card was declined by the bank.',
      'unknown': 'An unknown error occurred during payment.'
    };

    const errorMessage = reasonMessages[reason] || reasonMessages['unknown'];

    const orderAmount = req.query.amount ? parseFloat(req.query.amount) : 0;

    let orderData = null;
    if (req.query.orderData) {
      try {
        orderData = JSON.parse(req.query.orderData);
      } catch (err) {
        console.warn('Invalid orderData JSON:', err);
      }
    }

    console.log('Received orderData:', orderData);

    res.render("order-failure", {
      errorMessage,
      errorReason: reason,
      orderAmount,
      orderData,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      user: req.session.user || {}
    });

  } catch (error) {
    console.error('Error rendering order failure page:', error);
    res.redirect("/pageNotFound");
  }
};

const handleFailedPayment = async (req, res) => {
  try {
    const { orderData } = req.body;
    const userId = req.session.user._id;

    if (!orderData) {
      return res.status(400).json({
        status: false,
        message: 'Invalid order data'
      });
    }

    const totalAmount = parseFloat(orderData.total);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        status: false,
        message: 'Invalid or missing total amount'
      });
    }

    const options = {
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `receipt_order_retry_${Date.now()}`
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    return res.json({
      status: true,
      order: {
        id: razorpayOrder.id,
        amount: options.amount,
        currency: options.currency
      },
      orderData: orderData,
      key_id: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Failed payment retry error:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to process retry payment'
    });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user._id;
    
    if (!couponCode) {
      return res.status(400).json({ 
        status: false, 
        message: 'Coupon code is required' 
      });
    }

    const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ 
        status: false, 
        message: 'Cart is empty' 
      });
    }

    const cartTotal = cart.items.reduce((total, item) => {
      return total + (item.productId.salePrice * item.quantity);
    }, 0);

    const coupon = await Coupon.findOne({ 
      couponCode: couponCode.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(400).json({ 
        status: false, 
        message: 'Invalid coupon code' 
      });
    }

    if (new Date() > coupon.couponValidity) {
      return res.status(400).json({ 
        status: false, 
        message: 'Coupon has expired' 
      });
    }

    if (cartTotal < coupon.couponMinAmount) {
      return res.status(400).json({ 
        status: false, 
        message: `Minimum cart amount of ₹${coupon.couponMinAmount} required` 
      });
    }

    if (coupon.usageCount >= coupon.limit) {
      return res.status(400).json({ 
        status: false, 
        message: 'Coupon usage limit reached' 
      });
    }

    let discountAmount = 0;
    let finalAmount = cartTotal;

    if (coupon.couponType === 'percentage') {
      discountAmount = (cartTotal * coupon.couponDiscount) / 100;

      if (coupon.couponMaxAmount > 0 && discountAmount > coupon.couponMaxAmount) {
        discountAmount = coupon.couponMaxAmount;
      }
    } else {
      discountAmount = coupon.couponDiscount;
    }

    finalAmount = cartTotal - discountAmount;

    res.json({
      status: true,
      message: 'Coupon applied successfully!',
      coupon: {
        code: coupon.couponCode,
        type: coupon.couponType,
        discount: coupon.couponDiscount,
        discountAmount: discountAmount,
        finalAmount: finalAmount
      }
    });

  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ 
      status: false, 
      message: 'Failed to apply coupon' 
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    
    const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
    if (!cart) {
      return res.status(400).json({ 
        status: false, 
        message: 'Cart not found' 
      });
    }

    const cartTotal = cart.items.reduce((total, item) => {
      return total + (item.productId.salePrice * item.quantity);
    }, 0);

    res.json({
      status: true,
      message: 'Coupon removed successfully',
      cartTotal: cartTotal
    });

  } catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({ 
      status: false, 
      message: 'Failed to remove coupon' 
    });
  }
};

const getAvailableCoupons = async (req, res) => {
  try {
    const cartTotal = parseFloat(req.query.cartTotal) || 0;
    
    const coupons = await Coupon.find({
      isActive: true,
      couponValidity: { $gte: new Date() },
      couponMinAmount: { $lte: cartTotal },
      $expr: { $lt: ['$usageCount', '$limit'] }
    }).sort({ couponDiscount: -1 });

    res.json({
      status: true,
      coupons: coupons
    });

  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to load coupons'
    });
  }
};


module.exports = {
  loadCheckout,checkoutAddAddress,checkoutEditAddress,placeOrder,verifyRazorpayPayment,createRazorpayOrder,orderFailure,handleFailedPayment ,applyCoupon,removeCoupon,getAvailableCoupons,
}
