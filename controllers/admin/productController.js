const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }); // Fetch listed categories
    const brand = await Brand.find({isBlocked:false});
    res.render("product-add", {
      categories, 
      brand:brand

    });
  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({ productName: products.productName });

    if (productExists) {
      return res.redirect("/admin/addProducts?error=Product already exists, please try with another name");
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join("public", "uploads", "product-images", req.files[i].filename);
        await sharp(originalImagePath).resize({ width: 400, height: 440 }).toFile(resizedImagePath);
        images.push(req.files[i].filename);
      }
    }

    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: products.category,
      regularPrice: products.regularPrice,
      salePrice: products.salePrice,
      createdOn: new Date(),
      quantity: products.quantity,
      size: products.size,
      color: products.color,
      productImage: images,
      status: "Available",
    });

    await newProduct.save();
    return res.redirect("/admin/addProducts?success=Product added successfully!");
    
  } catch (error) {
    console.error("Error saving product", error);
    return res.redirect("/admin/addProducts?error=Failed to add product");
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ]
    })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate("category")
    .exec();

    const count = await Product.countDocuments({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ]
    });

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand
      });
    } else {
      return res.redirect("/admin/products?error=Failed to load products");
    }
  } catch (error) {
    console.error("Error loading products:", error);
    return res.redirect("/admin/products?error=Failed to load products");
  }
};

module.exports = {
  getProductAddPage,addProducts,getAllProducts,
}
