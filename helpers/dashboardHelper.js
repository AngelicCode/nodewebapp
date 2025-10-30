const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");
const User = require("../models/userSchema");
const Order = require("../models/orderSchema");


async function getSalesData(filter) {
  const today = new Date();
  let startDate, groupFormat;

  switch (filter) {
    case 'daily':
      startDate = new Date(today.setDate(today.getDate() - 30));
      groupFormat = '%Y-%m-%d';
      break;
    case 'weekly':
      startDate = new Date(today.setDate(today.getDate() - 28));
      groupFormat = '%Y-%m-%d'; 
      break;
    case 'yearly':
      startDate = new Date(today.getFullYear() - 3, 0, 1);
      groupFormat = '%Y-%m';
      break;
    case 'monthly':
    default:
      startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
      groupFormat = '%Y-%m';
  }

  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupFormat,
            date: "$createdAt"
          }
        },
        totalSales: { $sum: "$finalAmount" },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return salesData.map(item => ({
    date: item._id,
    sales: item.totalSales,
    orders: item.orderCount
  }));
}


async function getTopSellingProducts() {
  const topProducts = await Order.aggregate([
    {
      $match: {
        status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
      }
    },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.productId",
        totalSold: { $sum: "$orderItems.quantity" },
        totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" }
  ]);

  return topProducts.map(item => ({
    name: item.product.productName,
    sold: item.totalSold,
    revenue: item.totalRevenue,
    image: item.product.productImage?.[0] || '/images/default-product.png'
  }));
}


async function getTopSellingCategories() {
  const topCategories = await Order.aggregate([
    {
      $match: {
        status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
      }
    },
    { $unwind: "$orderItems" },
    {
      $lookup: {
        from: "products",
        localField: "orderItems.productId",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category._id",
        name: { $first: "$category.name" },
        totalSold: { $sum: "$orderItems.quantity" },
        totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 }
  ]);

  return topCategories;
}


async function getTopSellingBrands() {
  const topBrands = await Order.aggregate([
    {
      $match: {
        status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
      }
    },
    { $unwind: "$orderItems" },
    {
      $lookup: {
        from: "products",
        localField: "orderItems.productId",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "brands",
        localField: "product.brand",
        foreignField: "_id",
        as: "brand"
      }
    },
    { $unwind: "$brand" },
    {
      $group: {
        _id: "$brand._id",
        name: { $first: "$brand.brandName" },
        totalSold: { $sum: "$orderItems.quantity" },
        totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 }
  ]);

  return topBrands;
}

async function getCustomerGrowthData(filter) {
  const today = new Date();
  let startDate, groupFormat;

  switch (filter) {
    case 'daily':
      startDate = new Date(today.setDate(today.getDate() - 7));
      groupFormat = '%Y-%m-%d';
      break;
    case 'weekly':
      startDate = new Date(today.setDate(today.getDate() - 28));
      groupFormat = '%Y-%U'; 
      break;
    case 'yearly':
      startDate = new Date(today.getFullYear() - 3, 0, 1);
      groupFormat = '%Y';
      break;
    case 'monthly':
    default:
      startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
      groupFormat = '%Y-%m';
  }

  const customerData = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        isAdmin: false
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupFormat,
            date: "$createdAt"
          }
        },
        newCustomers: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return customerData.map(item => ({
    date: item._id,
    newCustomers: item.newCustomers
  }));
}

async function getCategoryPerformanceData() {
  const categoryPerformance = await Order.aggregate([
    {
      $match: {
        status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
      }
    },
    { $unwind: "$orderItems" },
    {
      $lookup: {
        from: "products",
        localField: "orderItems.productId",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category._id",
        name: { $first: "$category.name" },
        totalRevenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  const totalRevenue = categoryPerformance.reduce((sum, category) => sum + category.totalRevenue, 0);
  
  return categoryPerformance.map(category => ({
    name: category.name,
    percentage: totalRevenue > 0 ? Math.round((category.totalRevenue / totalRevenue) * 100) : 0,
    revenue: category.totalRevenue
  }));
}

async function getDashboardStats() {
  const totalOrders = await Order.countDocuments({
    status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
  });
  
  const totalCustomers = await User.countDocuments({ isAdmin: false });
  
  const totalProducts = await Product.countDocuments({ isBlocked: false });
  
  const totalRevenue = await Order.aggregate([
    {
      $match: {
        status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$finalAmount" }
      }
    }
  ]);

  const pendingOrders = await Order.countDocuments({
    status: { $in: ['pending', 'confirmed', 'processing'] }
  });

  return {
    totalOrders,
    totalCustomers,
    totalProducts,
    totalRevenue: totalRevenue[0]?.total || 0,
    pendingOrders
  };
}


module.exports = {
  getSalesData,
  getTopSellingProducts,
  getTopSellingCategories,
  getTopSellingBrands,
  getCustomerGrowthData,
  getCategoryPerformanceData,
  getDashboardStats,

};