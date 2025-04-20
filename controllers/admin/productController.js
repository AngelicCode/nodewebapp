const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }); // Fetch listed categories
    res.render("product-add", {
      categories, 
      
    });
  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};



module.exports = {
  getProductAddPage,
}