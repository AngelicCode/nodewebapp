const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const { getCartCount } = require('../../helpers/cartHelper');
const { refundToWallet } = require("../../helpers/walletHelper");
const { HTTP_STATUS, getMessage } = require('../../helpers/httpStatus');
const { calculateItemRefund, shouldRefundShipping } = require("../../helpers/refundHelper");

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

const getOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cartCount = await getCartCount(userId);
    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "orderItems.productId",
        select: "images"
      });

    res.render("profile", {
      orders,
      user: req.session.user,
      userAddress: req.session.userAddress || {},
      cartCount: cartCount,
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/profile');
  }
}

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user._id;
    const cartCount = await getCartCount(userId);

    const order = await Order.findOne({
      _id: orderId,
      userId: userId
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

    if (!order) {
      return res.redirect("/userProfile?tab=orders");
    }

    const user = await User.findById(userId).select("phone");

    const statusSummary = calculateOrderStatus(order.orderItems, order.status);

    res.render("order-details", {
      order,
      user,
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

    if (!['pending', 'confirmed', 'processing'].includes(order.status) || order.status === 'out for delivery') {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    if (cancelType === 'entire') {
      order.status = 'cancelled';

      // 1️⃣ Mark all items cancelled FIRST
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

      // 2️⃣ Check if all items are cancelled
      const allItemsCancelled = order.orderItems.every(
        item => item.itemStatus === "cancelled"
      );

      // 3️⃣ Calculate item refund (coupon-safe)
      let refundAmount = 0;

      order.orderItems.forEach(item => {
        const couponShare = order.couponDistribution?.find(
          c => c.productId.toString() === item.productId.toString()
        );

        const couponDiscount = couponShare?.couponDiscount || 0;
        const itemRefund = (item.price * item.quantity) - couponDiscount;

        refundAmount += Math.max(0, itemRefund);
      });

      if (
        allItemsCancelled &&
        order.paymentMethod !== "cod" &&
        order.shipping > 0
      ) {
        refundAmount += order.shipping;
      }

      // 5️⃣ Handle payment status + refund
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'cancelled';
      } else {
        order.paymentStatus = 'refunded';
        await refundToWallet(
          order._id,
          refundAmount,
          "Order cancelled – full refund including shipping"
        );
      }

      order.cancellationReason = reason;
      order.cancelledBy = 'user';
      order.finalAmount = 0;
      order.discountedTotal = 0;
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

const cancelOrderItem = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason, itemIndex, productId, quantity } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ _id: orderId, userId })

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not Found" });
    }

    const item = order.orderItems[itemIndex];
    if (!item || item.itemStatus === "cancelled") {
      return res.status(400).json({ success: false, message: "Item not found or already cancelled" });
    }

    if (!['pending', "confirmed", "processing"].includes(item.itemStatus)) {
      return res.status(400).json({ success: false, message: "Items cannot be cancelled at this stage" });
    }

    if (order.status === 'out for delivery') {
      return res.status(400).json({ success: false, message: "Items cannot be cancelled when order is out for delivery" });
    }

    item.itemStatus = "cancelled";
    item.cancellationReason = reason;
    item.cancelledBy = "user";
    item.cancelledAt = new Date();

    let refundAmount = calculateItemRefund(order, item);

    const allItemsCancelled = order.orderItems.every(i => i.itemStatus === "cancelled");

    if (allItemsCancelled && order.shipping > 0) {
      refundAmount += order.shipping;
    }

    order.finalAmount -= refundAmount;

    await Product.findByIdAndUpdate(productId, { $inc: { quantity: quantity } });

    if (order.paymentMethod !== 'cod') {
      await refundToWallet(orderId, refundAmount, `Refund for cancelled item in order ${order.orderId}`);
    }

    const newStatus = order.calculateOrderStatus();
    order.status = newStatus.status;
    order.paymentStatus = newStatus.paymentStatus;

    await order.save();

    const refundMessage = order.paymentMethod === 'cod'
      ? `Item cancelled successfully. Amount reduced: ₹${refundAmount.toFixed(2)}. You'll pay ₹${order.finalAmount.toFixed(2)} on delivery.`
      : `Item cancelled successfully. Refund amount ₹${refundAmount.toFixed(2)} credited to your wallet.`;

    res.json({
      success: true,
      message: refundMessage,
      refundAmount: refundAmount,
      paymentMethod: order.paymentMethod,
      newFinalAmount: order.finalAmount
    });

  } catch (error) {
    console.error("Error cancelling item:", error);
    res.status(500).json({ success: false, message: "Failed to cancel item" });
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

    let refundAmount = 0;

    for (const item of order.orderItems) {
      if (item.itemStatus === "delivered") {
        refundAmount += calculateItemRefund(order, item);

        item.itemStatus = "return requested";
        item.returnReason = reason;
      }
    }

    order.status = 'return requested';
    order.returnReason = reason;
    order.paymentStatus = order.paymentMethod === 'cod' ? 'pending' : 'partially refunded';

    await order.save();

    res.json({
      success: true,
      message: 'Return request submitted successfully. Refund will be processed after admin approval.',
      refundEstimate: refundAmount
    });

  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({ success: false, message: 'Failed to process return request' });
  }
};

const returnOrderItem = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason, itemIndex, productId } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    const item = order.orderItems[itemIndex];
    if (!item || item.itemStatus !== "delivered") {
      return res.status(400).json({ success: false, message: "Item not eligible for return" });
    }

    const refundAmount = calculateItemRefund(order, item);

    item.itemStatus = "return requested";
    item.returnReason = reason;
    order.returnReason = reason;
    order.status = "return requested";

    await order.save();

    res.json({
      success: true,
      message: 'Return request submitted successfully. Refund will be processed after admin approval.',
      refundEstimate: refundAmount
    });

  } catch (error) {
    console.error('Error processing item return request:', error);
    res.status(500).json({ success: false, message: 'Failed to process return request' });
  }
};

const getOrderDataForRetry = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.json({
        status: false,
        message: "Order not found"
      });
    }

    if (order.userId.toString() !== req.session.user._id.toString()) {
      return res.json({
        status: false,
        message: "Unauthorized access"
      });
    }

    if (order.paymentStatus !== 'failed') {
      return res.json({
        status: false,
        message: "This order cannot be retried"
      });
    }

    const orderData = {
      addressId: order.addressId,
      paymentMethod: order.paymentMethod,
      cartItems: order.orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      subtotal: order.total,
      shipping: order.shipping,
      tax: order.tax || 0,
      total: order.finalAmount,
      discountedSubtotal: order.discountedTotal,
      totalSavings: order.totalSavings,
      coupon: order.couponDetails ? {
        code: order.couponDetails.couponCode,
        type: order.couponDetails.couponType,
        discount: order.couponDetails.couponDiscount,
        discountAmount: order.couponDetails.discountAmount
      } : null,
      shippingAddress: order.shippingAddress
    };

    res.json({
      status: true,
      orderData: orderData
    });

  } catch (error) {
    console.error("Error getting order data:", error);
    res.json({
      status: false,
      message: "Failed to load order data"
    });
  }
};


module.exports = {
  orderSuccess, getOrders, getOrderDetails, cancelOrder, cancelOrderItem, returnOrder, returnOrderItem, getOrderDataForRetry,
}