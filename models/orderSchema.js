const mongoose = require('mongoose');
const { Schema } = mongoose
const { v4: uuidv4 } = require('uuid');
const Product = require('./productSchema');

const orderSchema = new Schema({
   orderId: {
      type: String,
      default: () => uuidv4(),
      unique: true
   },
   userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
   },
   addressId: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true
   },
   shippingAddress: {
      addressType: {
          type: String,
          required: true
      },
      name: {
          type: String,
          required: true
      },
      city: {
          type: String,
          required: true
      },
      landMark: {
          type: String,
          required: true
      },
      state: {
          type: String,
          required: true
      },
      pincode: {
          type: Number,
          required: true
      },
      phone: {
          type: Number,
          required: true
      },
      altPhone: { 
          type: Number,
          required: false
      }
  },
   paymentMethod: {
      type: String,
      enum: ["cod", "razorpay","card","wallet"],
      required: true
   },
   cancellationReason: {
    type: String,
    default: null   
  },
  cancelledBy: {
    type: String,
    enum: ["user", "admin", "system"],
    default: null
  },
   orderItems: [{
      productId: {
         type: Schema.Types.ObjectId,
         ref: "Product",
         required: true
      },
      productName: {
         type: String,
         required: true,
      },
      price: {
         type: Number,
         required: true
      },
      quantity: {
         type: Number,
         required: true
      },
      itemStatus: {
         type: String,
         enum: ["confirmed", "shipped", "delivered", "cancelled", "returned"],
         default: "confirmed"
      },
      returnReason: { 
         type: String, 
         default: null 
      },
      cancellationReason: { 
      type: String, 
      default: null 
    },
    cancelledBy: { 
      type: String, 
      enum: ["user", "admin", "system"],
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
      
   }],
   total: {
      type: Number,
      required: true
   },
   createdAt: {
      type: Date,
      default: Date.now
   },
   discount: {
      type: Number,
      default: 0
   },
   finalAmount: {
      type: Number,
      required: true
   },
   status: {
      type: String,
      enum: ["pending","confirmed", "processing", "shipped", "delivered", "cancelled","Return requested", "Return approved","Return rejected", "refunded","failed"],
      default: "pending"
   },
   paymentStatus: {
      type: String,
      enum: ["cancelled","pending", "success", "failed"],
      default: "pending"
   },
   
   returnRequestedAt: {
      type: Date,
      default: null
   },

   returnReason: {
      type: String,
      default: null   
   },

   adminReturnStatus: {
      type: String,
      enum: [null, "Return Required", "Approved", "Rejected"],
      default: null
   },

   returnActionDate: {
      type: Date,
      default: null
   },

   adminReturnNotes: {
      type: String,
      default: null
   },

   adminReturnStatus:{
      type:String,
      default:null
   },

   invoiceDate: {
      type: Date,
      default: Date.now
   },
   
   couponApplied: {
      type: Boolean,
      default: false
   },
   
}, { timestamps: true });



const Order = mongoose.model('Order', orderSchema);
module.exports = Order;