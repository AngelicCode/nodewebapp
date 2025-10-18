const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");

const getLargestOffer = async (productId) => {
  try {
    const product = await Product.findById(productId).populate("category");
    
    if (!product) {
      return { percentage: 0, type: null };
    }

    const currentDate = new Date();
    let productOfferPercentage = 0;
    let categoryOfferPercentage = 0;

    if (product.productOffer && product.productOffer.isActive) {
      const startDate = product.productOffer.startDate;
      const endDate = product.productOffer.endDate;
      
      if (startDate && endDate && currentDate >= startDate && currentDate <= endDate) {
        productOfferPercentage = product.productOffer.percentage || 0;
      }
    }

    if (product.category && product.category.categoryOffer && product.category.categoryOffer.isActive) {
      const startDate = product.category.categoryOffer.startDate;
      const endDate = product.category.categoryOffer.endDate;
      
      if (startDate && endDate && currentDate >= startDate && currentDate <= endDate) {
        categoryOfferPercentage = product.category.categoryOffer.percentage || 0;
      }
    }

    if (productOfferPercentage > categoryOfferPercentage) {
      return { 
        percentage: productOfferPercentage, 
        type: 'product',
        finalPrice: calculateDiscountedPrice(product.salePrice, productOfferPercentage)
      };
    } else {
      return { 
        percentage: categoryOfferPercentage, 
        type: 'category',
        finalPrice: calculateDiscountedPrice(product.salePrice, categoryOfferPercentage)
      };
    }
  } catch (error) {
    console.error("Error in getLargestOffer:", error);
    return { percentage: 0, type: null, finalPrice: 0 };
  }
};

const calculateDiscountedPrice = (originalPrice, discountPercentage) => {
  const discountAmount = (originalPrice * discountPercentage) / 100;
  return Math.max(0, originalPrice - discountAmount);
};

module.exports = {
  getLargestOffer,
  calculateDiscountedPrice
};