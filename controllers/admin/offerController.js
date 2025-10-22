const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const { getLargestOffer } = require("../../helpers/offerHelper");

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage, startDate, endDate } = req.body;

     if(percentage >100){
      return res.status(404).json({error:"Adding offer exceeds the limit"});
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    product.productOffer = {
      percentage: parseFloat(percentage),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true
    };
    
    await product.save();
    res.status(200).json({ message: "Product offer added successfully" });
  } catch (error) {
    console.error("Error adding product offer:", error);
    res.status(500).json({ error: "Failed to add product offer" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    
    await Product.findByIdAndUpdate(productId, {
      $set: {
        "productOffer.percentage": 0,
        "productOffer.isActive": false
      }
    });

    res.status(200).json({ message: "Product offer removed successfully" });
  } catch (error) {
    console.error("Error removing product offer:", error);
    res.status(500).json({ error: "Failed to remove product offer" });
  }
};

const addCategoryOffer = async (req, res) => {
  try {
    const { categoryId, percentage, startDate, endDate } = req.body;

    if(percentage >100){
      return res.status(404).json({error:"Adding offer exceeds the limit"});
    }
    
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    category.categoryOffer = {
      percentage: parseFloat(percentage),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true
    };

    await category.save();
    res.status(200).json({ message: "Category offer added successfully" });
  } catch (error) {
    console.error("Error adding category offer:", error);
    res.status(500).json({ error: "Failed to add category offer" });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    await Category.findByIdAndUpdate(categoryId, {
      $set: {
        "categoryOffer.percentage": 0,
        "categoryOffer.isActive": false
      }
    });

    res.status(200).json({ message: "Category offer removed successfully" });
  } catch (error) {
    console.error("Error removing category offer:", error);
    res.status(500).json({ error: "Failed to remove category offer" });
  }
};

const getProductOfferDetails = async (req, res) => {
  try {
    const { productId } = req.params;
    const offerDetails = await getLargestOffer(productId);
    res.status(200).json(offerDetails);
  } catch (error) {
    console.error("Error getting offer details:", error);
    res.status(500).json({ error: "Failed to get offer details" });
  }
};

module.exports = {
  addProductOffer,
  removeProductOffer,
  addCategoryOffer,
  removeCategoryOffer,
  getProductOfferDetails
};