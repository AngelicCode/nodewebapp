const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order =  require("../../models/orderSchema");
const { refundToWallet } = require("../../helpers/walletHelper"); 
// const { customerInfo } = require("./customerController");

const orderList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.date) {
      const today = new Date();
      let startDate;

      if (req.query.date === "today") {
        startDate = new Date(today.setHours(0, 0, 0, 0));
      } else if (req.query.date === "week") {
        startDate = new Date(today.setDate(today.getDate() - 7));
      } else if (req.query.date === "month") {
        startDate = new Date(today.setMonth(today.getMonth() - 1));
      }
      filter.createdAt = { $gte: startDate };
    }

    const searchQuery = req.query.search || '';

    if (searchQuery) {
      filter.$or = [
        { orderId: { $regex: searchQuery, $options: "i" } },
        { "shippingAddress.name": { $regex: searchQuery, $options: "i" } },
        { "user.email": { $regex: searchQuery, $options: "i" } },
      ];
    }

    let sortOption = { createdAt: -1 };
    if (req.query.sort) {
      switch (req.query.sort) {
        case "date_asc":
          sortOption = { createdAt: 1 };
          break;
        case "total_asc":
          sortOption = { totalAmount: 1 };
          break;
        case "total_desc":
          sortOption = { totalAmount: -1 };
          break;
        case "status":
          sortOption = { status: 1 };
          break;
      }
    }

    let orders = await Order.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email phone')
      .lean();

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders", {
      orders,
      search: searchQuery,
      currentPage: page,
      totalPages,
      status: req.query.status || '',
      date: req.query.date || '',
      sort: req.query.sort || '',
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/pageerror');
  }
}

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status === "cancelled" || status === "partially cancelled") {
      const nonCancellableStatuses = ["shipped", "out for delivery", "delivered", "return requested", "return approved", "refunded"];
      
      if (nonCancellableStatuses.includes(order.status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot cancel order after it has been ${order.status}. Order is already ${order.status}.` 
        });
      }

      const hasShippedItems = order.orderItems.some(item => 
        ["shipped", "out for delivery", "delivered"].includes(item.itemStatus)
      );

      if (hasShippedItems) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot cancel order because some items have already been shipped or delivered.' 
        });
      }
    }

    let newPaymentStatus = order.paymentStatus;

    
    if (status === "delivered") {
      order.orderItems.forEach(item => {
        if (
          item.itemStatus === "confirmed" ||
          item.itemStatus === "processing" ||
          item.itemStatus === "shipped" ||
          item.itemStatus === "out for delivery"
        ) {
          item.itemStatus = "delivered";
        }
      });
      newPaymentStatus = "paid";
    } 
    
    else if (["processing", "shipped", "out for delivery"].includes(status)) {
      order.orderItems.forEach(item => {
        if (!["cancelled", "returned", "return rejected", "delivered"].includes(item.itemStatus)) {
          item.itemStatus = status;
        }
      });
    }

    order.status = status;
    order.paymentStatus = newPaymentStatus;

    const updatedOrder = await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      newStatus: updatedOrder.status,
      newPaymentStatus: updatedOrder.paymentStatus
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status: ' + error.message
    });
  }
};

const getOrderDetails = async (req,res)=>{
  try {
   const orderId = req.params.orderId; 
   const order = await Order.findOne({orderId:orderId})
   .populate('userId', 'name email')
   .populate('orderItems.productId', 'name images'); 
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    const formattedOrderItems = order.orderItems.map(item => {
      return {
        productName: item.productId?.name || item.productName,
        price: item.price,
        quantity: item.quantity,
        image: item.productId?.images?.[0] || null
      };
    });

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        user: order.userId ? {
          _id: order.userId._id,
          name: order.userId.name,
          email: order.userId.email
        } : null,
        shippingAddress: order.shippingAddress,
        orderItems: formattedOrderItems,
        total: order.total,
        discount: order.discount,
        finalAmount: order.finalAmount,
        paymentMethod: order.paymentMethod,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt
      }
    });
    
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.json({ success: false, message: error.message });
  }
}

const getReturnRequests = async (req,res) => {
  try {
    const ordersWithReturnRequests = await Order.find({
      $or: [
        { "orderItems.itemStatus": "return requested" },
        { 
          "orderItems.itemStatus": "returned",
          "orderItems.inventoryAdded": false
        }
      ]
    })
      .populate('userId', 'name email')
      .populate('orderItems.productId', 'name images')
      .sort({ returnRequestedAt: -1 });

    const formattedRequests = [];

    for (const order of ordersWithReturnRequests) {
      order.orderItems.forEach((item, index) => {
        if (item.itemStatus === "return requested" || item.itemStatus === "returned" && !item.inventoryAdded) {
          formattedRequests.push({
            orderId: order.orderId,
            itemIndex: index,
            user: order.userId,
            item: item,
            returnReason: item.returnReason || order.returnReason,
            returnRequestedAt: order.returnRequestedAt || order.updatedAt,
            adminReturnStatus: order.adminReturnStatus
          });
        }
      });
    }

    res.json({ success: true, returnRequests: formattedRequests });
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.json({ success: false, message: error.message });
  }
};

const handleReturnAction = async (req, res) => {
  try {
    const { orderId, itemIndex, action, notes } = req.body;
    
    const order = await Order.findOne({ orderId })
      .populate('orderItems.productId')
      .populate('userId');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    let refundAmount = 0;
    
    if (itemIndex !== undefined && itemIndex !== null) {
      const item = order.orderItems[itemIndex];
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }
      
      if (action === 'approve') {
        item.itemStatus = "returned";
        item.inventoryAdded = false;
        refundAmount = item.price * item.quantity;

        order.finalAmount -= refundAmount;
        
      } else if (action === 'reject') {
        item.itemStatus = "return rejected";
      }
      
    } else {
      if (action === 'approve') {
        for (const item of order.orderItems) {
          if (item.itemStatus === "return requested") {
            item.itemStatus = "returned";
            item.inventoryAdded = false;
            refundAmount += item.price * item.quantity;
            
          }
        }

        order.finalAmount -= refundAmount;
        
      } else if (action === 'reject') {
        for (const item of order.orderItems) {
          if (item.itemStatus === "return requested") {
            item.itemStatus = "return rejected";
          }
        }
      }
    }
    
    if (action === 'approve' && refundAmount > 0) {
      await refundToWallet(order._id, refundAmount, `Refund for returned order ${order.orderId}`);
    }
    
    const newStatus = order.calculateOrderStatus();
    order.status = newStatus.status;
    order.paymentStatus = newStatus.paymentStatus;

    order.adminReturnNotes = notes || '';
    order.returnActionDate = new Date();
    await order.save();
    
    res.json({ 
      success: true, 
      message: `Return ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      refundAmount: action === 'approve' ? refundAmount : 0,
      
    });
  } catch (error) {
    console.error('Error handling return action:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const addToInventory = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.body;
    
    const order = await Order.findOne({ orderId })
      .populate('orderItems.productId');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    let item;
    if (itemIndex !== undefined && itemIndex !== null) {
      item = order.orderItems[itemIndex];
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }
    } else {
     
      item = order.orderItems.find(item => 
        item.itemStatus === "returned" && !item.inventoryAdded
      );
      if (!item) {
        return res.status(400).json({ success: false, message: 'No eligible items found for inventory update' });
      }
    }
    
    if (item.itemStatus !== "returned") {
      return res.status(400).json({ 
        success: false, 
        message: 'Item is not in returned status' 
      });
    }
    
    if (item.inventoryAdded) {
      return res.status(400).json({ 
        success: false, 
        message: 'Inventory already added for this item' 
      });
    }
    
    await Product.findByIdAndUpdate(
      item.productId,
      { $inc: { quantity: item.quantity } }
    );
    
    item.inventoryAdded = true;
    await order.save();
    
    res.json({ 
      success: true, 
      message: `Successfully added ${item.quantity} items back to inventory`,
      productName: item.productName,
      quantity: item.quantity
    });
    
  } catch (error) {
    console.error('Error adding to inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

function checkAllItemsProcessed(orderItems) {
  const result = {
    allReturnApproved: true,
    allReturnRejected: true,
    hasMixedStatus: false
  };
  
  for (const item of orderItems) {
    if (item.itemStatus === "return requested") {
      result.allReturnApproved = false;
      result.allReturnRejected = false;
    } else if (item.itemStatus === "return approved") {
      result.allReturnRejected = false;
    } else if (item.itemStatus === "return rejected") {
      result.allReturnApproved = false;
    }
  }
  
  result.hasMixedStatus = !result.allReturnApproved && !result.allReturnRejected;
  return result;
}

module.exports = {
  orderList,updateOrderStatus,getOrderDetails,getReturnRequests,handleReturnAction,addToInventory,
}