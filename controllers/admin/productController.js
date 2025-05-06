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
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    console.log(search)
    const [category, brand] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
    ]);

    // Build product query
    const query = {}; 

    if (search) {
      query.productName = { $regex: new RegExp(search, "i") };
    }
    
    const productData = await Product.find(query)
    
      .populate("category brand")
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const filteredProducts = productData.filter(p => p.brand !== null);

    const totalCount = await Product.countDocuments(query); // FIXED: match query with filtering

    res.render("products", {
      data: filteredProducts,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      cat: category,
      brand: brand,
    });
  } catch (error) {
    console.error("Error loading products:", error);
    res.redirect("/admin/products?error=Failed to load products");
  }
};


const blockProduct = async (req, res) => {
  try {
    const { id } = req.body;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.status(200).json({ success: true, isBlocked: true });
  } catch (error) {
    console.error("Block product error:", error);
    res.json({ success: false });
  }
};

const unblockProduct = async (req, res) => {
  try {
    const { id } = req.body;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.status(200).json({ success: true, isBlocked: false });
  } catch (error) {
    console.error("Unblock product error:", error);
    res.json({ success: false });
  }
};

module.exports = {
  getProductAddPage,addProducts,getAllProducts,blockProduct,unblockProduct,
}
