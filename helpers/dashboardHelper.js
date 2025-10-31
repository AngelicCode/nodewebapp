const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");
const Brand = require("../models/brandSchema");
const User = require("../models/userSchema");
const Order = require("../models/orderSchema");


async function getSalesData(filter) {
  try {
    const today = new Date();
    let startDate, groupFormat, step;

    switch (filter) {
      case 'daily':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30); 
        groupFormat = '%Y-%m-%d';
        step = 'day';
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 28); 
        groupFormat = '%Y-%m-%d'; 
        step = 'week';
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear() - 3, 0, 1);
        groupFormat = '%Y';
        step = 'year';
        break;
      case 'monthly':
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
        groupFormat = '%Y-%m';
        step = 'month';
        break;
    }

    let salesData;

    if (filter === 'weekly') {
      
      salesData = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
          }
        },
        {
          $addFields: {
            weekStart: {
              $dateFromParts: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: {
                  $subtract: [
                    { $dayOfMonth: "$createdAt" },
                    { $mod: [{ $subtract: [{ $dayOfWeek: "$createdAt" }, 2] }, 7] }
                  ]
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: "$weekStart"
              }
            },
            totalSales: { $sum: "$finalAmount" },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else {
      salesData = await Order.aggregate([
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
    }

    const dataMap = new Map(
      salesData.map(item => [item._id, { sales: item.totalSales, orders: item.orderCount }])
    );

    const filledData = [];
    let current = new Date(startDate);

    while (current <= today) {
      let label;

      switch (step) {
        case 'day':
          label = current.toISOString().slice(0, 10); 
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          label = getMondayOfWeek(current);
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          label = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          current.setMonth(current.getMonth() + 1);
          break;
        case 'year':
          label = `${current.getFullYear()}`;
          current.setFullYear(current.getFullYear() + 1);
          break;
      }

      const data = dataMap.get(label) || { sales: 0, orders: 0 };
      
      filledData.push({
        date: label,
        sales: data.sales,
        orders: data.orders
      });
    }

    return filledData;
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return [];
  }
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}


async function getTopSellingProducts(filter) {
  try {
    const today = new Date();
    let startDate;
    
    switch (filter) {
      case 'daily':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7); 
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 28); 
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear() - 3, 0, 1); 
        break;
      case 'monthly':
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1); 
        break;
    }
    
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }, 
          status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
        }
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.itemStatus": { 
            $in: ['confirmed', 'processing', 'shipped', 'out for delivery', 'delivered'] 
          }
        }
      },
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
    
  } catch (error) {
    console.error("Error fetching top selling products:", error);
    return [];
  }
}


async function getTopSellingCategories(filter) {
  try {
    const today = new Date();
    let startDate;
    
    switch (filter) {
      case 'daily':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7); 
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 28); 
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear() - 3, 0, 1); 
        break;
      case 'monthly':
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1); 
        break;
    }
    
    const topCategories = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }, 
          status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
        }
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.itemStatus": { 
            $in: ['confirmed', 'processing', 'shipped', 'out for delivery', 'delivered'] 
          }
        }
      },
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
    
  } catch (error) {
    console.error("Error fetching top selling categories:", error);
    return [];
  }
}


async function getTopSellingBrands(filter) {
  try {
    const today = new Date();
    let startDate;
    
    switch (filter) {
      case 'daily':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7); 
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 28); 
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear() - 3, 0, 1); 
        break;
      case 'monthly':
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1); 
        break;
    }
    
    const topBrands = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }, 
          status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
        }
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.itemStatus": { 
            $in: ['confirmed', 'processing', 'shipped', 'out for delivery', 'delivered'] 
          }
        }
      },
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
    
  } catch (error) {
    console.error("Error fetching top selling brands:", error);
    return [];
  }
}

async function getCustomerGrowthData(filter) {
  try {
    const today = new Date();
    let startDate, groupFormat, step;
    
    switch (filter) {
      case 'daily':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7); 
        groupFormat = '%Y-%m-%d';
        step = 'day';
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 28); 
        groupFormat = '%Y-%m-%d'; 
        step = 'week';
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear() - 3, 0, 1);
        groupFormat = '%Y';
        step = 'year';
        break;
      case 'monthly':
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
        groupFormat = '%Y-%m';
        step = 'month';
        break;
    }
    
    let customerData;
    
    if (filter === 'weekly') {
    
      customerData = await User.aggregate([
        {
          $match: {
            createdOn: { $gte: startDate },
            isAdmin: false
          }
        },
        {
          $addFields: {
            weekStart: {
              $dateFromParts: {
                year: { $year: "$createdOn" },
                month: { $month: "$createdOn" },
                day: {
                  $subtract: [
                    { $dayOfMonth: "$createdOn" },
                    { $mod: [{ $subtract: [{ $dayOfWeek: "$createdOn" }, 2] }, 7] }
                  ]
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: "$weekStart"
              }
            },
            newCustomers: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else {
      customerData = await User.aggregate([
        {
          $match: {
            createdOn: { $gte: startDate },
            isAdmin: false
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupFormat,
                date: "$createdOn"
              }
            },
            newCustomers: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    }
    
    const dataMap = new Map(customerData.map(item => [item._id, item.newCustomers]));
    
    const filledData = [];
    let current = new Date(startDate);
    
    while (current <= today) {
      let label;
      
      switch (step) {
        case 'day':
          label = current.toISOString().slice(0, 10); 
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          label = getMondayOfWeek(current);
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          label = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          current.setMonth(current.getMonth() + 1);
          break;
        case 'year':
          label = `${current.getFullYear()}`;
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
      
      filledData.push({
        date: label,
        newCustomers: dataMap.get(label) || 0
      });
    }
    
    return filledData;
  } catch (error) {
    console.error("Error fetching customer growth data:", error);
    return [];
  }
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}


async function getCategoryPerformanceData(filter) {
  try {
    const today = new Date();
    let startDate;
    
    switch (filter) {
      case 'daily':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7); 
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 28); 
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear() - 3, 0, 1); 
        break;
      case 'monthly':
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1); 
        break;
    }
    
    const categoryPerformance = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }, 
          status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
        }
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.itemStatus": { 
            $in: ['confirmed', 'processing', 'shipped', 'out for delivery', 'delivered'] 
          }
        }
      },
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
          totalRevenue: { 
            $sum: { 
              $multiply: ["$orderItems.price", "$orderItems.quantity"] 
            } 
          },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    const totalRevenue = categoryPerformance.reduce((sum, category) => sum + category.totalRevenue, 0);
    
    return categoryPerformance.map(category => ({
      name: category.name,
      percentage: totalRevenue > 0 ? Math.round((category.totalRevenue / totalRevenue) * 100) : 0,
      revenue: category.totalRevenue,
      orders: category.totalOrders
    }));
    
  } catch (error) {
    console.error("Error fetching category performance data:", error);
    return [];
  }
}

async function getDashboardStats(filter) {
  try {
    const today = new Date();
    let startDate;
    
    switch (filter) {
      case 'daily':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7); 
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 28); 
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear() - 3, 0, 1); 
        break;
      case 'monthly':
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1); 
        break;
    }
    
    const totalOrders = await Order.countDocuments({
      createdAt: { $gte: startDate }, 
      status: { $in: ['delivered', 'confirmed', 'processing', 'shipped', 'out for delivery'] }
    });
    
    const totalCustomers = await User.countDocuments({ 
      isAdmin: false,
      createdOn: { $gte: startDate } 
    });
    
    
    const totalProducts = await Product.countDocuments({ 
      isBlocked: false,
      createdAt: { $gte: startDate } 
    });
    
    const totalRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }, 
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
      createdAt: { $gte: startDate }, 
      status: { $in: ['pending', 'confirmed', 'processing'] }
    });

    return {
      totalOrders,
      totalCustomers,
      totalProducts,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingOrders
    };
    
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      totalOrders: 0,
      totalCustomers: 0,
      totalProducts: 0,
      totalRevenue: 0,
      pendingOrders: 0
    };
  }
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