const calculateItemRefund = (order, item) => {

  const couponShare = order.couponDistribution?.find(c => 
    c.productId.toString() === item.productId.toString()
  );

  const couponDiscount = couponShare?.couponDiscount || 0;
  
  const itemTotalAfterOffers = item.price * item.quantity;

  const refundAmount = Math.max(0, itemTotalAfterOffers - couponDiscount);

  return Math.round(refundAmount); 
};

const shouldRefundShipping = (order) => {

  const activeItems = order.orderItems.filter(
    i => !['cancelled', 'returned'].includes(i.itemStatus)
  );

  return activeItems.length === 0;
};

module.exports = { calculateItemRefund, shouldRefundShipping };