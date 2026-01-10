const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");

const salesreportPage = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    let dateFilter = {};
    const currentDate = new Date();

    if (reportType) {
      switch (reportType) {
        case 'daily':
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);
          dateFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
          break;

        case 'weekly':
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          dateFilter.createdAt = { $gte: oneWeekAgo, $lte: currentDate };
          break;

        case 'monthly':
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          dateFilter.createdAt = { $gte: startOfMonth, $lte: currentDate };
          break;

        case 'yearly':
          const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
          dateFilter.createdAt = { $gte: startOfYear, $lte: currentDate };
          break;

        case 'custom':
          if (startDate && endDate) {
            const customStart = new Date(startDate);
            const customEnd = new Date(endDate);
            customEnd.setHours(23, 59, 59, 999);
            dateFilter.createdAt = { $gte: customStart, $lte: customEnd };
          }
          break;
      }
    }

    const statusFilter = {
      status: { $in: ["delivered", "confirmed", "processing", "shipped", "return rejected"] },
      paymentStatus: { $in: ["paid", "success"] }
    };

    const filter = { ...dateFilter, ...statusFilter };

    const orders = await Order.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const totalSalesAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const totalCouponDeduction = orders.reduce((sum, order) => sum + (order.couponDetails?.discountAmount || 0), 0);

    const totalOfferSavings = orders.reduce((sum, order) => {
      const offerSavings = (order.total || 0) - (order.discountedTotal || order.total);
      return sum + Math.max(0, offerSavings);
    }, 0);

    const totalOriginalRevenue = orders.reduce((sum, order) => {
      return sum + (order.total || 0);
    }, 0);

    // Pagination Logic
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const totalPages = Math.ceil(totalOrders / limit);

    const paginatedOrders = orders.slice(startIndex, endIndex);

    const salesData = paginatedOrders.map(order => {
      const orderOfferSavings = Math.max(0, (order.total || 0) - (order.discountedTotal || order.total));

      const cancelledDeduction = order.orderItems.reduce((acc, item) => {
        return item.itemStatus === 'cancelled' ? acc + (item.price * item.quantity) : acc;
      }, 0);

      const returnDeduction = order.orderItems.reduce((acc, item) => {
        return item.itemStatus === 'returned' ? acc + (item.price * item.quantity) : acc;
      }, 0);

      return {
        orderId: order.orderId,
        orderDate: order.createdAt,
        customerName: order.userId?.name || 'Guest',
        customerEmail: order.userId?.email || 'N/A',
        paymentMethod: order.paymentMethod,
        totalAmount: order.total || 0,
        discountedTotal: order.discountedTotal || order.total || 0,
        totalSavings: order.totalSavings || 0,
        discount: order.discount || 0,
        couponCode: order.couponDetails?.couponCode || 'None',
        couponAmount: order.couponDetails?.discountAmount || 0,
        finalAmount: order.finalAmount || 0,
        offerSavings: orderOfferSavings,
        shipping: order.shipping || 0,
        cancelledDeduction: cancelledDeduction,
        returnDeduction: returnDeduction
      };
    });

    res.render('sales-report', {
      salesData,
      totalOrders,
      totalSalesAmount: totalSalesAmount.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalCouponDeduction: totalCouponDeduction.toFixed(2),
      totalOfferSavings: totalOfferSavings.toFixed(2),
      totalOriginalRevenue: totalOriginalRevenue.toFixed(2),
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
      search: '',
      currentFilters: {
        reportType: reportType || 'daily',
        startDate: startDate || '',
        endDate: endDate || ''
      }
    });

  } catch (error) {
    console.error('Error fetching sales report:', error);
    res.render('sales-report', {
      error: 'Failed to generate sales report',
      salesData: [],
      totalOrders: 0,
      totalSalesAmount: 0,
      totalDiscount: 0,
      totalCouponDeduction: 0,
      totalOfferSavings: 0,
      totalOriginalRevenue: 0,
      search: '',
      currentFilters: {
        reportType: 'daily',
        startDate: '',
        endDate: ''
      }
    });
  }
};

const downloadSalesReportPDF = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    let dateFilter = {};
    const currentDate = new Date();

    if (reportType) {
      switch (reportType) {
        case 'daily':
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);
          dateFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
          break;

        case 'weekly':
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          dateFilter.createdAt = { $gte: oneWeekAgo, $lte: currentDate };
          break;

        case 'monthly':
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          dateFilter.createdAt = { $gte: startOfMonth, $lte: currentDate };
          break;

        case 'yearly':
          const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
          dateFilter.createdAt = { $gte: startOfYear, $lte: currentDate };
          break;

        case 'custom':
          if (startDate && endDate) {
            const customStart = new Date(startDate);
            const customEnd = new Date(endDate);
            customEnd.setHours(23, 59, 59, 999);
            dateFilter.createdAt = { $gte: customStart, $lte: customEnd };
          }
          break;
      }
    }

    const statusFilter = {
      status: { $in: ["delivered", "confirmed", "processing", "shipped", "return rejected"] },
      paymentStatus: { $in: ["paid", "success"] }
    };

    const filter = { ...dateFilter, ...statusFilter };

    const orders = await Order.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const totalSalesAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const totalCouponDeduction = orders.reduce((sum, order) => sum + (order.couponDetails?.discountAmount || 0), 0);

    const totalOfferSavings = orders.reduce((sum, order) => {
      const orderOfferSavings = (order.total || 0) - (order.discountedTotal || order.total);
      return sum + Math.max(0, orderOfferSavings);
    }, 0);

    const totalOriginalRevenue = orders.reduce((sum, order) => {
      return sum + (order.total || 0);
    }, 0);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('QuickSip Sales Report', { align: 'center' });
    doc.moveDown(0.5);

    let periodText = 'All Time';
    if (reportType === 'daily') periodText = 'Daily Report';
    else if (reportType === 'weekly') periodText = 'Weekly Report';
    else if (reportType === 'monthly') periodText = 'Monthly Report';
    else if (reportType === 'yearly') periodText = 'Yearly Report';
    else if (reportType === 'custom') periodText = `Custom Report: ${startDate} to ${endDate}`;

    doc.fontSize(12).font('Helvetica').text(periodText, { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Orders: ${totalOrders}`);
    doc.text(`Total Sales: ₹${totalSalesAmount.toFixed(2)}`);
    doc.text(`Coupon Deduction: ₹${totalCouponDeduction.toFixed(2)}`);
    doc.text(`Offer Deduction: ₹${totalOfferSavings.toFixed(2)}`);
    doc.text(`Original Revenue: ₹${totalOriginalRevenue.toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(10);
    const tableTop = doc.y;
    const rowHeight = 20;

    const columns = [
      { name: 'Order ID', width: 60, x: 20 },
      { name: 'Date', width: 50, x: 80 },
      { name: 'Customer', width: 60, x: 130 },
      { name: 'Amount', width: 50, x: 190 },
      { name: 'Shipping', width: 50, x: 240 },
      { name: 'Offer Ded.', width: 50, x: 290 },
      { name: 'Coupon Ded.', width: 50, x: 340 },
      { name: 'Cancel Ded.', width: 50, x: 390 },
      { name: 'Return Ded.', width: 50, x: 440 },
      { name: 'Final Amt', width: 50, x: 490 }
    ];

    doc.font('Helvetica-Bold');
    columns.forEach(col => {
      doc.text(col.name, col.x, tableTop, { width: col.width, align: 'left' });
    });

    doc.moveTo(50, tableTop + 15).lineTo(570, tableTop + 15).stroke();

    let currentY = tableTop + rowHeight;

    doc.font('Helvetica');
    orders.forEach((order) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const orderOfferSavings = Math.max(0, (order.total || 0) - (order.discountedTotal || order.total));

      const cancelledDeduction = order.orderItems.reduce((acc, item) => {
        return item.itemStatus === 'cancelled' ? acc + (item.price * item.quantity) : acc;
      }, 0);

      const returnDeduction = order.orderItems.reduce((acc, item) => {
        return item.itemStatus === 'returned' ? acc + (item.price * item.quantity) : acc;
      }, 0);

      const rowData = [
        order.orderId,
        order.createdAt.toLocaleDateString(),
        (order.userId?.name || 'Guest').substring(0, 10),
        `₹${order.total}`,
        `₹${order.shipping || 0}`,
        `₹${orderOfferSavings}`,
        `₹${order.couponDetails?.discountAmount || 0}`,
        `₹${cancelledDeduction}`,
        `₹${returnDeduction}`,
        `₹${order.finalAmount}`
      ];

      columns.forEach((col, index) => {
        doc.text(rowData[index], col.x, currentY, {
          width: col.width,
          align: 'left'
        });
      });

      doc.moveTo(50, currentY + 15).lineTo(570, currentY + 15).stroke();
      currentY += rowHeight;
    });

    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Failed to generate PDF report');
  }
};

const downloadSalesReportExcel = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    let dateFilter = {};
    const currentDate = new Date();

    if (reportType) {
      switch (reportType) {
        case 'daily':
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);
          dateFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
          break;

        case 'weekly':
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          dateFilter.createdAt = { $gte: oneWeekAgo, $lte: currentDate };
          break;

        case 'monthly':
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          dateFilter.createdAt = { $gte: startOfMonth, $lte: currentDate };
          break;

        case 'yearly':
          const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
          dateFilter.createdAt = { $gte: startOfYear, $lte: currentDate };
          break;

        case 'custom':
          if (startDate && endDate) {
            const customStart = new Date(startDate);
            const customEnd = new Date(endDate);
            customEnd.setHours(23, 59, 59, 999);
            dateFilter.createdAt = { $gte: customStart, $lte: customEnd };
          }
          break;
      }
    }

    const statusFilter = {
      status: { $in: ["delivered", "confirmed", "processing", "shipped", "return rejected"] },
      paymentStatus: { $in: ["paid", "success"] }
    };

    const filter = { ...dateFilter, ...statusFilter };

    const orders = await Order.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const totalSalesAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const totalCouponDeduction = orders.reduce((sum, order) => sum + (order.couponDetails?.discountAmount || 0), 0);

    const totalOfferSavings = orders.reduce((sum, order) => {
      const orderOfferSavings = (order.total || 0) - (order.discountedTotal || order.total);
      return sum + Math.max(0, orderOfferSavings);
    }, 0);

    const totalOriginalRevenue = orders.reduce((sum, order) => {
      return sum + (order.total || 0);
    }, 0);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Payment Method', key: 'payment', width: 15 },
      { header: 'Total Amount', key: 'total', width: 15 },
      { header: 'Shipping', key: 'shipping', width: 12 },
      { header: 'Offer Deduction', key: 'offerDeduction', width: 15 },
      { header: 'Coupon Deduction', key: 'couponDeduction', width: 15 },
      { header: 'Cancelled Deduction', key: 'cancelledDeduction', width: 18 },
      { header: 'Return Deduction', key: 'returnDeduction', width: 18 },
      { header: 'Final Amount', key: 'final', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5F4F9' }
    };

    orders.forEach(order => {
      const orderOfferSavings = Math.max(0, (order.total || 0) - (order.discountedTotal || order.total));
      const cancelledDeduction = order.orderItems.reduce((acc, item) => {
        return item.itemStatus === 'cancelled' ? acc + (item.price * item.quantity) : acc;
      }, 0);

      const returnDeduction = order.orderItems.reduce((acc, item) => {
        return item.itemStatus === 'returned' ? acc + (item.price * item.quantity) : acc;
      }, 0);

      worksheet.addRow({
        orderId: order.orderId,
        date: order.createdAt.toLocaleDateString(),
        customer: order.userId?.name || 'Guest',
        payment: order.paymentMethod,
        total: order.total,
        shipping: order.shipping || 0,
        offerDeduction: orderOfferSavings,
        couponDeduction: order.couponDetails?.discountAmount || 0,
        cancelledDeduction: cancelledDeduction,
        returnDeduction: returnDeduction,
        final: order.finalAmount
      });
    });

    const summaryRow = worksheet.rowCount + 2;

    worksheet.getCell(`A${summaryRow}`).value = 'Summary';
    worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 14 };

    worksheet.getCell(`A${summaryRow + 1}`).value = 'Total Orders:';
    worksheet.getCell(`B${summaryRow + 1}`).value = totalOrders;

    worksheet.getCell(`A${summaryRow + 2}`).value = 'Total Sales:';
    worksheet.getCell(`B${summaryRow + 2}`).value = totalSalesAmount;
    worksheet.getCell(`B${summaryRow + 2}`).numFmt = '₹#,##0.00';

    worksheet.getCell(`A${summaryRow + 3}`).value = 'Coupon Deduction:';
    worksheet.getCell(`B${summaryRow + 3}`).value = totalCouponDeduction;
    worksheet.getCell(`B${summaryRow + 3}`).numFmt = '₹#,##0.00';

    worksheet.getCell(`A${summaryRow + 4}`).value = 'Offer Deduction:';
    worksheet.getCell(`B${summaryRow + 4}`).value = totalOfferSavings;
    worksheet.getCell(`B${summaryRow + 4}`).numFmt = '₹#,##0.00';

    worksheet.getCell(`A${summaryRow + 5}`).value = 'Original Revenue:';
    worksheet.getCell(`B${summaryRow + 5}`).value = totalOriginalRevenue;
    worksheet.getCell(`B${summaryRow + 5}`).numFmt = '₹#,##0.00';

    for (let i = summaryRow; i <= summaryRow + 5; i++) {
      worksheet.getCell(`A${i}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F8FF' }
      };
      worksheet.getCell(`B${i}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F8FF' }
      };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).send('Failed to generate Excel report');
  }
};


module.exports = {
  salesreportPage, downloadSalesReportPDF, downloadSalesReportExcel,
};