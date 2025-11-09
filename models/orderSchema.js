const mongoose = require('mongoose');
const { Schema } = mongoose
const Product = require('./productSchema');
const shortid = require('shortid');

function generateOrderId() {
  return 'OD' + shortid.generate().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
}

const orderSchema = new Schema({
   orderId: {
      type: String,
      default: generateOrderId,
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
      originalPrice: {  
         type: Number,
         required: true
      },
      quantity: {
         type: Number,
         required: true
      },
      itemStatus: {
         type: String,
         enum: ["confirmed","processing", "shipped", "out for delivery", "delivered", "cancelled", "return requested", "returned", "return rejected"],
         default: "confirmed"
      },
      inventoryAdded: {
         type: Boolean,
         default: false
      },
      offerApplied: {  
         percentage: {
            type: Number,
            default: 0
         },
         type: {
            type: String,
            enum: ["product", "category", null],
            default: null
         }
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
   discountedTotal: {  
      type: Number,
      required: true
   },
   totalSavings: {  
      type: Number,
      default: 0
   },
   shipping: {  
      type: Number,
      default: 0
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
   enum: [
      "pending", "confirmed", "processing", "shipped", "out for delivery", "delivered", "cancelled", "partially cancelled", "return requested", "return approved","return rejected", "partially returned", "refunded", "partially refunded", "failed"
   ],
   default: "pending"
   },

   paymentStatus: {
   type: String,
   enum: ["paid", "cancelled", "pending", "success", "failed", "refunded", "partially refunded"],
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

   invoiceDate: {
      type: Date,
      default: Date.now
   },
   
   couponApplied: {
      type: Boolean,
      default: false
   },

   couponDetails: {
   couponCode: {
      type: String,
      default: null
   },
   couponType: {
      type: String,
      enum: ["percentage", "fixed", null],
      default: null
   },
   couponDiscount: {
      type: Number,
      default: 0
   },
   discountAmount: {
      type: Number,
      default: 0
   }
   },
     
   razorpayOrderId: {
      type: String,
      default: null
   },
   razorpayPaymentId: {
      type: String,
      default: null
   },
   couponDistribution: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    couponDiscount: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    itemTotalAfterOffers: { 
      type: Number,
      default: 0
    },
    priceAfterCoupon: {  
      type: Number,
      default: 0
    }

  }]
   
}, { timestamps: true });



orderSchema.methods.calculateOrderStatus = function() {
  const items = this.orderItems;
  
  const statusCount = {};
  items.forEach(item => {
    statusCount[item.itemStatus] = (statusCount[item.itemStatus] || 0) + 1;
  });

  const totalItems = items.length;

  if (statusCount.cancelled === totalItems) {
    return { status: "cancelled", paymentStatus: this.paymentStatus === "paid" ? "refunded" : "cancelled" };
  }

  if (statusCount.cancelled > 0 && statusCount.cancelled < totalItems) {
    return { status: "partially cancelled", paymentStatus: this.paymentStatus };
  }

  if (statusCount.returned === totalItems) {
    return { status: "refunded", paymentStatus: "refunded" };
  }

  if (statusCount["return rejected"] === totalItems) {
    return { status: "return rejected", paymentStatus: this.paymentStatus };
  }

  if (statusCount["return requested"] === totalItems) {
    return { status: "return requested", paymentStatus: this.paymentStatus };
  }

  const returnedCount = statusCount.returned || 0;
  const returnRejectedCount = statusCount["return rejected"] || 0;
  const returnRequestedCount = statusCount["return requested"] || 0;

   const hasReturnRelatedItems = returnedCount > 0 || returnRejectedCount > 0 || returnRequestedCount > 0;
  const hasNonReturnItems = totalItems > (returnedCount + returnRejectedCount + returnRequestedCount);
  
  if (returnedCount > 0 && returnRejectedCount > 0 && !hasNonReturnItems) {
    return { status: "partially refunded", paymentStatus: "partially refunded" };
  }

  if (returnRejectedCount > 0 && returnedCount === 0 && returnRejectedCount < totalItems && !hasNonReturnItems) {
    return { status: "partially returned", paymentStatus: this.paymentStatus };
  }

  const activeItems = items.filter(item => !["cancelled", "returned"].includes(item.itemStatus));
  if (activeItems.length === 0) return { status: this.status, paymentStatus: this.paymentStatus };

  const statusPriority = {
     "delivered": 8, "out for delivery": 7, "shipped": 6, "processing": 5, 
    "confirmed": 4, "return requested": 3, "return rejected": 2, "pending": 1
  };

  let highestStatus = "pending";
  activeItems.forEach(item => {
    if (statusPriority[item.itemStatus] > statusPriority[highestStatus]) {
      highestStatus = item.itemStatus;
    }
  });

  return { status: highestStatus, paymentStatus: this.paymentStatus };
};


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;