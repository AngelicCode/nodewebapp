const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const { getCartCount } = require('../../helpers/cartHelper');
const { refundToWallet } = require("../../helpers/walletHelper");
const { HTTP_STATUS, getMessage } = require('../../helpers/httpStatus');

const orderSuccess = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user._id;
        const cartCount = await getCartCount(userId);

        if (!orderId) {
            return res.redirect('/');
        }

        const order = await Order.findOne({
            _id: orderId,
            userId: userId
        });

        if (!order) {
            return res.redirect('/');

        }

        res.render('order-success', {
            order,
            cartCount,
        });

    } catch (error) {
        console.error('Error loading order success page:', error);
        res.redirect('/');
    }
}

const getOrders = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    const cartCount = await getCartCount(userId);
    const orders = await Order.find({userId})
        .sort({createdAt:-1})
        .populate({
          path: "orderItems.productId",
          select:"images"
        });

        res.render("profile",{
          orders,
          user:req.session.user,
          userAddress:req.session.userAddress || {},
          cartCount: cartCount,
        });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/profile');
  }
}

const getOrderDetails = async (req,res)=>{
  try {
    const orderId = req.params.id;
    const userId = req.session.user._id;
    const cartCount = await getCartCount(userId);

    const order = await Order.findOne({
      _id:orderId,
      userId:userId
    })
    .populate({
      path: "orderItems.productId",
      select: "productImage description brand category",
      populate: [
        {
          path: "brand",
          select: "brandName" 
        },
        {
          path: "category", 
          select: "name" 
        }
      ]
    })
    .populate("addressId");

    if(!order){
      return res.redirect("/userProfile?tab=orders");
    }

    const statusSummary = calculateOrderStatus(order.orderItems, order.status);
    

    res.render("order-details",{
      order,
      user:req.session.user,
      statusSummary,
      cartCount: cartCount,
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.redirect('/userProfile?tab=orders');
  }
}

function calculateOrderStatus(orderItems, currentStatus) {
  const totalItems = orderItems.length;
  
  const statusCount = {};
  orderItems.forEach(item => {
    statusCount[item.itemStatus] = (statusCount[item.itemStatus] || 0) + 1;
  });

  if (statusCount.cancelled === totalItems) {
    return { overallStatus: "cancelled" };
  }

  if (statusCount.cancelled > 0 && statusCount.cancelled < totalItems) {
    return { overallStatus: "partially cancelled" };
  }

  if (statusCount.returned === totalItems) {
    return { overallStatus: "refunded" };
  }

  const returnedCount = statusCount.returned || 0;
  const returnRejectedCount = statusCount["return rejected"] || 0;
  
  if (returnedCount > 0 && returnRejectedCount > 0) {
    return { overallStatus: "partially refunded" };
  }

  if (returnRejectedCount > 0 && returnedCount === 0 && returnRejectedCount < totalItems) {
    return { overallStatus: "partially returned" };
  }

  if (returnRejectedCount === totalItems) {
    return { overallStatus: "return rejected" };
  }

  if (statusCount["return requested"] === totalItems) {
    return { overallStatus: "return requested" };
  }

  const activeItems = orderItems.filter(item => !["cancelled", "returned", "return rejected"].includes(item.itemStatus));
  if (activeItems.length === 0) return { overallStatus: currentStatus };

  const statusPriority = {
    "delivered": 7, "out for delivery": 6, "shipped": 5, "processing": 4, 
    "confirmed": 3, "return requested": 2, "pending": 1
  };

  let highestStatus = "pending";
  activeItems.forEach(item => {
    if (statusPriority[item.itemStatus] > statusPriority[highestStatus]) {
      highestStatus = item.itemStatus;
    }
  });

  return { overallStatus: highestStatus };
}


const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason, cancelType } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!['pending','confirmed', 'processing'].includes(order.status) || order.status === 'out for delivery') {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    if (cancelType === 'entire') {
      order.status = 'cancelled';

      const refundAmount = order.finalAmount;

      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'cancelled';
      } else if (order.paymentMethod === 'razorpay' || order.paymentMethod === 'wallet') {
        order.paymentStatus = 'refunded';
        
        await refundToWallet(orderId, refundAmount, `Refund for cancelled order ${order.orderId} (with offers applied)`);
      }

      order.cancellationReason = reason;
      order.cancelledBy = 'user';

      order.finalAmount = 0;
       if (order.discountedTotal) {
        order.discountedTotal = 0;
      }

      for (const item of order.orderItems) {
        if (item.itemStatus !== 'cancelled') {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { quantity: item.quantity } }
          );
          item.itemStatus = 'cancelled';
          item.cancellationReason = reason;
          item.cancelledBy = 'user';
          item.cancelledAt = new Date();
        }
      }
    }

    await order.save();
    res.json({ 
      success: true, 
      message: 'Order cancelled successfully',
      finalAmount: order.finalAmount,
      paymentStatus: order.paymentStatus,
      newFinalAmount: order.finalAmount
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
};

const cancelOrderItem = async(req,res)=>{
  try {
    const orderId = req.params.id;
    const { reason, itemIndex, productId, quantity } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({_id: orderId, userId})

    if(!order){
      return res.status(404).json({success:false,message:"Order not Found"});
    }

    const item = order.orderItems[itemIndex];
    if(!item || item.itemStatus === "cancelled"){
      return res.status(400).json({success:false,message:"Item not found or already cancelled"});
    }

    if (!['pending',"confirmed","processing"].includes(item.itemStatus)) {
      return res.status(400).json({success:false,message:"Items cannot be cancelled at this stage"});
    }
    if (order.status === 'out for delivery') {
      return res.status(400).json({success:false,message:"Items cannot be cancelled when order is out for delivery"});
    }

    const itemTotal = item.price * item.quantity;
    order.total -= item.originalPrice * item.quantity;
    if (order.discountedTotal) {
      order.discountedTotal -= itemTotal; 
    }
    order.finalAmount -= itemTotal;

    item.itemStatus = "cancelled";
    item.cancellationReason = reason;
    item.cancelledBy = "user";
    item.cancelledAt = new Date();

    await Product.findByIdAndUpdate(productId, { $inc: { quantity: quantity } });

    if (order.paymentMethod !== 'cod') {
      await refundToWallet(orderId, itemTotal, `Refund for cancelled item in order ${order.orderId} (${item.offerApplied?.percentage || 0}% offer applied)`);
    }

    const newStatus = order.calculateOrderStatus();
    order.status = newStatus.status;
    order.paymentStatus = newStatus.paymentStatus;

    await order.save();
    
    const refundMessage = order.paymentMethod === 'cod' 
      ? 'Item cancelled successfully. Your payable amount has been updated.' 
      : `Item cancelled successfully. Refund amount: ₹${itemTotal.toFixed(2)}`;

    res.json({
      success: true,
      message: refundMessage,
      refundAmount: itemTotal,
      paymentMethod: order.paymentMethod,
      newFinalAmount: order.finalAmount
    });

  } catch (error) {
    console.error("Error cancelling item:",error);
    res.status(500).json({success:false,message:"Failed to cancel item"});
  }
};

const returnOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;
        const userId = req.session.user._id;

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        order.status = 'return requested';
        order.returnReason = reason;

        order.orderItems.forEach(item=>{
          if(item.itemStatus === "delivered"){
            item.itemStatus = "return requested";
             item.returnReason = reason;
          }
        });
        
        await order.save();

        res.json({ success: true, message: 'Return request submitted successfully' });

  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({ success: false, message: 'Failed to process return request' });
  }
};

const returnOrderItem = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason, itemIndex, productId, quantity } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    const item = order.orderItems[itemIndex];
    if (!item || item.itemStatus === "returned" || item.itemStatus === "return requested") {
      return res.status(400).json({ success: false, message: "Item not found or already returned" });
    }

    item.itemStatus = "return requested";
    item.returnReason = reason;
    
    if (order.status === 'delivered') {
      order.status = 'return requested';
    }
    
    order.returnReason = reason;

    await order.save();

    res.json({ 
      success: true, 
      message: 'Return request submitted successfully for this item' 
    });

  } catch (error) {
    console.error('Error processing item return request:', error);
    res.status(500).json({ success: false, message: 'Failed to process return request' });
  }
};


module.exports = {
  orderSuccess,getOrders,getOrderDetails,cancelOrder,cancelOrderItem,returnOrder,returnOrderItem,
}