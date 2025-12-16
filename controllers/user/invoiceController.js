const PDFDocument = require('pdfkit');
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const path = require('path');
const fs = require('fs');


const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user._id;

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
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

         const user = await User.findById(order.userId).select("phone name");

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        
        doc.pipe(res);

        let currentY = 50;

        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor('#2c3e50')
           .text('QUICK SIP', 50, currentY);

        currentY += 30;

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#7f8c8d')
           .text('Your Favorite Water Bottle Store', 50, currentY);
        
        currentY += 15;
        doc.text('Email: support@quicksip.com | Phone: +91 9876543210', 50, currentY);
        
        currentY += 15;
        doc.text('Address: 123 Kochin Street, Drink City, DC 12345', 50, currentY);
        
        currentY += 40;

        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor('#2c3e50')
           .text(`INVOICE - ${order.orderId}`, 50, currentY);

        currentY += 40;

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#34495e')
           .text('Order Information:', 50, currentY);

        currentY += 20;
        
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#2c3e50')
           .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, currentY)
           .text(`Order ID: ${order.orderId}`, 200, currentY)
           .text(`Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`, 350, currentY);

        currentY += 15;

        doc.text(`Payment Method: ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 
                  order.paymentMethod === 'razorpay' ? 'Razorpay' :
                  order.paymentMethod === 'wallet' ? 'Wallet' : 'Card'}`, 50, currentY)
           .text(`Payment Status: ${order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}`, 200, currentY);

        currentY += 40;

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#34495e')
           .text('Customer Information:', 50, currentY);

        currentY += 20;

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#2c3e50')
           .text(`Name: ${order.shippingAddress.name}`, 50, currentY)
           .text(`Phone: ${user?.phone || 'N/A'}`, 200, currentY);

        currentY += 15;

        if (order.shippingAddress.altPhone) {
         doc.text(`Alternate Phone: ${order.shippingAddress.altPhone}`, 50, currentY);
         currentY += 15;
         }

        const addressText = `Address: ${order.shippingAddress.landMark}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`;
        doc.text(addressText, 50, currentY, { width: 400 });

        currentY += 30;

        if (currentY > 600) {
            doc.addPage();
            currentY = 50;
        }

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#ffffff')
           .rect(50, currentY, 500, 20)
           .fill('#3498db');

        doc.text('Product', 60, currentY + 5)
           .text('Qty', 300, currentY + 5)
           .text('Price', 350, currentY + 5)
           .text('Total', 450, currentY + 5);

        currentY += 25;

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#2c3e50');

        order.orderItems.forEach((item, index) => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
                
                doc.fontSize(10)
                   .font('Helvetica-Bold')
                   .fillColor('#ffffff')
                   .rect(50, currentY, 500, 20)
                   .fill('#3498db');

                doc.text('Product', 60, currentY + 5)
                   .text('Qty', 300, currentY + 5)
                   .text('Price', 350, currentY + 5)
                   .text('Total', 450, currentY + 5);

                currentY += 25;
            }

            if (index % 2 === 0) {
                doc.fillColor('#f8f9fa')
                   .rect(50, currentY, 500, 20)
                   .fill();
            }

            const status = item.itemStatus === 'cancelled' ? ' (Cancelled)' : 
                          item.itemStatus === 'returned' ? ' (Returned)' : '';

            doc.fillColor('#2c3e50')
               .text(item.productName.substring(0, 35) + status, 60, currentY + 5)
               .text(item.quantity.toString(), 300, currentY + 5)
               .text(`₹${item.price.toFixed(2)}`, 350, currentY + 5)
               .text(`₹${(item.price * item.quantity).toFixed(2)}`, 450, currentY + 5);

            currentY += 20;
        });

        currentY += 30;

        if (currentY > 550) {
            doc.addPage();
            currentY = 50;
        }

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#34495e')
           .text('Order Summary:', 350, currentY);

        currentY += 20;

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#2c3e50');

        const subtotal = order.total;
        const shipping = order.status !== 'cancelled' ? 50 : 0;
        const offerSavings = order.discountedTotal && order.discountedTotal < order.total ? order.total - order.discountedTotal : 0;
        const couponDiscount = order.couponDetails?.discountAmount || 0;

        let adjustmentTotal = 0;
        order.orderItems.forEach(item => {
            if (item.itemStatus === 'cancelled' || item.itemStatus === 'returned') {
                adjustmentTotal += item.price * item.quantity;
            }
        });

        doc.text(`Subtotal:`, 350, currentY)
           .text(`₹${subtotal.toFixed(2)}`, 450, currentY);
        currentY += 15;

        if (shipping > 0) {
            doc.text(`Shipping:`, 350, currentY)
               .text(`₹${shipping.toFixed(2)}`, 450, currentY);
            currentY += 15;
        }

        if (offerSavings > 0) {
            doc.text(`Offer Savings:`, 350, currentY)
               .text(`-₹${offerSavings.toFixed(2)}`, 450, currentY)
               .fillColor('#27ae60');
            currentY += 15;
            doc.fillColor('#2c3e50');
        }

        if (couponDiscount > 0) {
            doc.text(`Coupon Discount:`, 350, currentY)
               .text(`-₹${couponDiscount.toFixed(2)}`, 450, currentY)
               .fillColor('#27ae60');
            currentY += 15;
            doc.fillColor('#2c3e50');
        }

        if (adjustmentTotal > 0) {
            const label = order.paymentMethod === 'cod' ? 'Amount Reduced:' : 'Refunded:';
            doc.text(`${label}`, 350, currentY)
               .text(`-₹${adjustmentTotal.toFixed(2)}`, 450, currentY)
               .fillColor('#e74c3c');
            currentY += 15;
            doc.fillColor('#2c3e50');
        }

        currentY += 10;

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text(`Total ${order.paymentMethod === 'cod' ? 'Payable' : 'Amount'}:`, 350, currentY)
           .text(`₹${order.finalAmount.toFixed(2)}`, 450, currentY);

        currentY += 40;

        if (currentY > 700) {
            doc.addPage();
            currentY = 50;
        }

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#7f8c8d');

        doc.text('Thank you for shopping with Quick Sip!', 50, currentY);
        currentY += 15;

        doc.text('We hope to see you again soon.', 50, currentY);
        currentY += 15;

        doc.text(`Invoice generated on: ${new Date().toLocaleDateString()}`, 50, currentY);

        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ success: false, message: 'Failed to generate invoice' });
    }
};


module.exports = {
    downloadInvoice
};