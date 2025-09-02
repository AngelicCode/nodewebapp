const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order =  require("../../models/orderSchema");
const { customerInfo } = require("./customerController");

const orderList = async (req,res)=>{
  try {
    const page = parseInt(req.query.page)|| 1;
    const limit = 10;
    const skip = (page - 1)*limit;

    let filter = {};
    if(req.query.status){
      filter.status = req.query.status;
    }

    if(req.query.date){
      const today = new Date();
      let startDate;

      if(req.query.date === "today"){
        startDate = new Date(today.setHours(0,0,0,0));
      }else if(req.query.date === "week"){
        startDate = new Date(today.setDate(today.getDate()-7));
      }else if(req.query.date === "month"){
        startDate = new Date(today.setMonth(today.getMonth()-1));
      }
      filter.createdAt = {$gte: startDate};
    }

    const searchQuery = req.query.search || '';
    if(searchQuery){
      const isPhoneSearch = /^\d+$/.test(searchQuery);
      filter.$or =[
        {orderId: {$regex: searchQuery, $options: "i"}},
        {"shippingAddress.name": {$regex: searchQuery, $options:"i"}}, 
        {"user.email": {$regex: searchQuery, $options: "i"}},
      ];

      if (isPhoneSearch) {
        filter.$or.push({"shippingAddress.phone": parseInt(searchQuery)});
      }
    }

    let sortOption = {createdAt: -1};
    if(req.query.sort){
      switch (req.query.sort){
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
      .populate('userId', 'name email phone');

      orders = orders.map(order => {
    if (!order.totalAmount || isNaN(order.totalAmount)) {
        order.totalAmount = 0;
    }
    return order;
    });

      const totalOrders = await Order.countDocuments(filter);
      const totalPages = Math.ceil(totalOrders/limit);

      res.render("orders",{
        orders,
        search: searchQuery,
        currentPage: page,
        totalPages,
        status: req.query.status || '',
        date: req.query.date || '',
        sort: req.query.sort || '',
        title: "Order Management"
      });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/pageerror');
  }
}

const updateOrderStatus = async (req,res)=>{
  try {
    const {orderId, status} = req.body;

    const validStatuses = ["pending","processing","shipped","out of delivery","delivered","cancelled", "Return requested", "Return approved", "Return rejected", "refunded"];

    if(!validStatuses.includes(status)){
      return res.status(400).json({success:false,message:"Invalid status"});
    }

    const updateData = { status };
    
    if (status === "delivered") {
      const currentOrder = await Order.findOne({ orderId });
      
      if (currentOrder && currentOrder.paymentStatus === "pending") {
        updateData.paymentStatus = "paid";
      }
    }
    
    if (status === "refunded") {
      updateData.paymentStatus = "refunded";
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId },
      updateData,
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.redirect('/pageerror');
  }
}

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

const getReturnRequests = async (req, res) => {
  try {
    const returnRequests = await Order.find({
      $or: [
        { adminReturnStatus: "pending" },
        { adminReturnStatus: "Return Required" },
        { status: "Return requested" }
      ]
    })
    .populate('userId', 'name email')
    .sort({ returnRequestedAt: -1 });
    
    res.json({ success: true, returnRequests });
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.json({ success: false, message: error.message });
  }
};

const handleReturnAction = async (req, res) => {
  try {
    const { orderId, action, notes } = req.body;
    
    const updateData = {
      adminReturnStatus: action === 'approve' ? 'approved' : 'rejected',
      returnActionDate: new Date(),
      adminReturnNotes: notes || ''
    };
    
    if (action === 'approve') {
      updateData.status = 'refunded';
    } else if (action === 'reject') {
      updateData.status = 'Return rejected';
    }
    
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId },
      updateData,
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ success: true, message: `Return ${action === 'approve' ? 'approved' : 'rejected'} successfully` });
  } catch (error) {
    console.error('Error handling return action:', error);
    res.json({ success: false, message: error.message });
  }
};


module.exports = {
  orderList,updateOrderStatus,getOrderDetails,getReturnRequests,handleReturnAction,
}