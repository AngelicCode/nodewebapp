const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const { getSalesData,
  getTopSellingProducts,
  getTopSellingCategories,
  getTopSellingBrands,
  getCustomerGrowthData,
  getCategoryPerformanceData,
  getDashboardStats, } = require('../../helpers/dashboardHelper');


const getDashboard = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';

    const salesData = await getSalesData(filter);
    const customerData = await getCustomerGrowthData(filter);
    const topProducts = await getTopSellingProducts();
    const topCategories = await getTopSellingCategories();
    const topBrands = await getTopSellingBrands();
    const categoryPerformance = await getCategoryPerformanceData();
    const stats = await getDashboardStats(filter);

    res.render("dashboard", {
      salesData,
      customerData,
      topProducts,
      topCategories,
      topBrands,
      categoryPerformance,
      stats,
      currentFilter: filter
    });

  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.redirect("/pageerror");
  }
};

const getDashboardData = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';

    const salesData = await getSalesData(filter);
    const customerData = await getCustomerGrowthData(filter);
    const topProducts = await getTopSellingProducts();
    const topCategories = await getTopSellingCategories();
    const topBrands = await getTopSellingBrands();
    const categoryPerformance = await getCategoryPerformanceData();
    const stats = await getDashboardStats(filter);

    res.json({
      success: true,
      salesData,
      customerData,
      topProducts,
      topCategories,
      topBrands,
      categoryPerformance,
      stats
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
  }
};


module.exports = {
  getDashboard,
  getDashboardData
};