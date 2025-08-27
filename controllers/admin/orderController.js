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
      filter.orderDate = {$gte: startDate};
    }

    if(req.query.search){
      filter.$or =[
        {orderId: {$regex: req.query.search, $options: "i"}},
        {customerName: {$regex: req.query.search, $options:"i"}}
      ];
    }

    let orders = await Order.find(filter)
      .sort({orderDate:-1})
      .skip(skip)
      .limit(limit);

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
        currentPage: page,
        totalPages,
        title: "Order Management"
      });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/pageNotFound');
  }
}

module.exports = {
  orderList,
}