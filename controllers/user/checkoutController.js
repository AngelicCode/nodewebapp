const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const { getCartCount } = require('../../helpers/cartHelper');
const Razorpay = require('razorpay');
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

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

     const { addressId, paymentMethod, cartItems, subtotal, shipping, tax, total } = req.body;

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
            status: paymentMethod === 'cod' ? 'pending' : 'processing',
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'processing'
        });

        await newOrder.save();
      
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
        const options = {
            amount: amount * 100, 
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
    
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');
    
    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        status: false,
        message: 'Payment verification failed'
      });
    }
    
    const { addressId, paymentMethod, subtotal, shipping, tax, total } = orderData;
    
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
      paymentMethod: 'razorpay',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      orderItems: orderItems,
      total: parseFloat(subtotal),
      shipping: parseFloat(shipping),
      tax: parseFloat(tax),
      finalAmount: parseFloat(total),
      status: 'confirmed',
      paymentStatus: 'paid'
    });

    await newOrder.save();

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
      orderId: newOrder._id,
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to verify payment'
    });
  }
};

const orderFailure = async(req,res)=>{
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
    
    res.render("order-failure", {
        errorMessage: errorMessage,
        errorReason: reason
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.redirect("/pageNotFound");

  }
}


module.exports = {
  loadCheckout,checkoutAddAddress,checkoutEditAddress,placeOrder,verifyRazorpayPayment,createRazorpayOrder,orderFailure,
}
