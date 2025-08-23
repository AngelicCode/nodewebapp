const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");

const orderSuccess = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user._id;

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
            order
        });

    } catch (error) {
        console.error('Error loading order success page:', error);
        res.redirect('/');
    }
}

const getOrders = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    const orders = await Order.find({userId})
        .sort({createdAt:-1})
        .populate({
          path: "orderItems.productId",
          select:"images"
        });

        res.render("profile",{
          orders,
          user:req.session.user,
          userAddress:req.session.userAddress || {}
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

    res.render("order-details",{
      order,
      user:req.session.user
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.redirect('/userProfile?tab=orders');
  }
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

        if (!['pending','confirmed', 'processing'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
        }

        if (cancelType === 'entire') {
            order.status = 'cancelled';
            order.cancellationReason = reason;
            order.cancelledBy = 'user';
            
            for (const item of order.orderItems) {
                if (item.itemStatus !== 'cancelled') {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { stock: item.quantity } }
                    );
                    item.itemStatus = 'cancelled';
                    item.cancellationReason = reason;
                    item.cancelledBy = 'user';
                    item.cancelledAt = new Date();
                }
            }
        }

        await order.save();
        res.json({ success: true, message: 'Order cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel order' });
    }
};

const cancelOrderItem = async(req,res)=>{
  try {
    const orderId = req.params.id;
    const { reason,itemIndex,productId,quantity} = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({_id:orderId,userId})

    if(!order){
      return res.status(404).json({success:false,message:"Order not Found"});
    }

    if(!['pending',"confirmed","processing"].includes(order.status)){
      return res.status(400).json({success:false,message:"Items cannot be cancelled at this stage"});
    }

    const item = order.orderItems[itemIndex];
    if(!item || item.itemStatus === "cancelled"){
      return res.status(400).json({success:false,message:"Item not found or already cancelled"});
    }

    item.itemStatus = "cancelled";
    item.cancellationReason = reason;
    item.cancelledBy = "user";
    item.cancelledAt = new Date();

    await Product.findByIdAndUpdate(productId,{$inc:{stock:quantity}});

    const allCancelled = order.orderItems.every(item=>item.itemStatus === "cancelled");

    if(allCancelled){
      order.status = "cancelled";
      order.cancellationReason = "All items cancelled";
      order.cancelledBy = "user";
    }

    await order.save();
    res.json({success:true,message:"Item cancelled successfully"});

  } catch (error) {
    console.error("Error cancelling item:",error);
    res.status(500).json({success:false,message:"Failed to cancel item"});
  }
};


module.exports = {
  orderSuccess,getOrders,getOrderDetails,cancelOrder,cancelOrderItem,
}