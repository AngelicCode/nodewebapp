const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
;
const loadCheckout = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    if(!userId){
     return res.status(401).json({status:false,message:"User not authenticated"})
    }

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

    if (!addressId || !paymentMethod || !cartItems || !cartItems.length) {
        return res.status(400).json({ 
            status: false,
            message: 'Missing required order data' 
        });
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

    const cart = await Cart.findOne({ userId: userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
        return res.status(400).json({ 
            status: false,
            message: 'Cart is empty' 
        });
    }

    for (const item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (!product || product.stock < item.quantity) {
            return res.status(400).json({
                status: false,
                message: `Product ${product?.productName || 'Unknown'} is out of stock`
            });
        }
    }

     const orderItems = cart.items.map(item => ({
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
      

        for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
            $inc: { stock: -item.quantity }
        });
    }

        await Cart.findOneAndUpdate(
            { userId: userId },
            { $set: { items: [] } }
        );

         return res.json({
            status: true,
            message: 'Order placed successfully',
            orderId:  newOrder._id
        });        

  } catch (error) {
    console.error('Error placing order:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to place order'
        });
  }
}


module.exports = {
  loadCheckout,checkoutAddAddress,checkoutEditAddress,placeOrder,
}
