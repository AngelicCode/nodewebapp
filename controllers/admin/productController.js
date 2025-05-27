const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("product-add", {
      categories,
      brand
    });
  } catch (error) {
    console.error("Error loading add product page:", error);
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
      // Ensure destination directory exists
      const destDir = path.resolve("public", "uploads", "product-images");
      await fs.mkdir(destDir, { recursive: true }).catch(() => {});

      for (const file of req.files) {
        const originalPath = path.resolve(file.path);
        const filename = file.filename;
        const resizedPath = path.resolve(destDir, filename);

        // Verify original file exists
        if (!await fs.access(originalPath).then(() => true).catch(() => false)) {
          console.error(`Original file not found: ${originalPath}`);
          continue;
        }

        // Process image using buffer method to avoid Sharp input/output conflict
        try {
          console.log(`Processing file: ${filename}`);
          console.log(`Original path: ${originalPath}`);
          console.log(`Resized path: ${resizedPath}`);

          // Read the original image into a buffer
          const imageBuffer = await fs.readFile(originalPath);
          
          // Process the image and get the result as a buffer
          const processedBuffer = await sharp(imageBuffer)
            .resize({ width: 800, height: 800, fit: "cover" })
            .jpeg({ quality: 90 })
            .toBuffer();
          
          // Write the processed buffer to the destination
          await fs.writeFile(resizedPath, processedBuffer);
          
          images.push(filename);
          console.log(`Image processed successfully via buffer method: ${filename}`);
        } catch (sharpError) {
          console.error(`Sharp error for ${filename}:`, sharpError);
          continue;
        }

        // Remove original file if different from resized path
        if (originalPath !== resizedPath) {
          await fs.unlink(originalPath).catch(err => 
            console.error(`Failed to delete ${originalPath}:`, err)
          );
        }
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
      productImage: images,
      status: "Available",
    });

    await newProduct.save();
    return res.redirect("/admin/addProducts?success=Product added successfully!");
  } catch (error) {
    console.error("Error saving product:", error);
    return res.redirect("/admin/addProducts?error=Failed to add product");
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const [category, brand] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
    ]);

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
    const totalCount = await Product.countDocuments(query);

    res.render("products", {
      data: filteredProducts,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      cat: category,
      brand,
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

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});
    const brand = await Brand.find({});

    // Verify existing images - use consistent path structure
    const verifiedImages = [];
    for (const image of product.productImage) {
      const imagePath = path.resolve("public", "uploads", "product-images", image);
      const exists = await fs.access(imagePath).then(() => true).catch(() => false);
      if (exists) {
        verifiedImages.push(image);
      } else {
        console.log(`Image not found on server: ${image}`);
      }
    }

    // Update product if images were removed
    if (verifiedImages.length !== product.productImage.length) {
      product.productImage = verifiedImages;
      await product.save();
    }

    res.render("edit-product", {
      product,
      cat: category,
      brand,
    });
  } catch (error) {
    console.error("Error loading edit product page:", error);
    res.redirect("/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    // Check for duplicate product name
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id }
    });

    if (existingProduct) {
      return res.status(400).json({
        error: "Product with this name already exists. Please try with another name"
      });
    }

    const updateFields = {
      productName: data.productName,
      description: data.description,
      brand: data.brand,
      category: data.category,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      quantity: data.quantity,
      productImage: []
    };

    // Handle existing images
    if (data.existingImages) {
      updateFields.productImage = Array.isArray(data.existingImages)
        ? data.existingImages
        : [data.existingImages];
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      // Ensure destination directory exists with consistent path
      const destDir = path.resolve("public", "uploads", "product-images");
      await fs.mkdir(destDir, { recursive: true }).catch(() => {});

      const newImages = [];
      for (const file of req.files) {
        const originalPath = path.resolve(file.path);
        const filename = file.filename;
        const resizedPath = path.resolve(destDir, filename);

        console.log(`Processing file: ${filename}`);
        console.log(`Original path: ${originalPath}`);
        console.log(`Resized path: ${resizedPath}`);

        // Verify original file exists
        if (!await fs.access(originalPath).then(() => true).catch(() => false)) {
          console.error(`Original file not found: ${originalPath}`);
          continue;
        }

        // Process image using buffer method to avoid Sharp input/output conflict
        try {
          // Read the original image into a buffer
          const imageBuffer = await fs.readFile(originalPath);
          
          // Process the image and get the result as a buffer
          const processedBuffer = await sharp(imageBuffer)
            .resize({ width: 800, height: 800, fit: "cover" })
            .jpeg({ quality: 90 })
            .toBuffer();
          
          // Write the processed buffer to the destination
          await fs.writeFile(resizedPath, processedBuffer);
          
          newImages.push(filename);
          console.log(`Image processed successfully via buffer method: ${filename}`);
        } catch (sharpError) {
          console.error(`Sharp error for ${filename}:`, sharpError);
          continue;
        }

        // Remove original file if different
        if (originalPath !== resizedPath) {
          await fs.unlink(originalPath).catch(err => 
            console.error(`Failed to delete ${originalPath}:`, err)
          );
        }
      }
      updateFields.productImage = [...updateFields.productImage, ...newImages];
    }

    // Update product
    await Product.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
    res.redirect("/admin/products?success=Product updated successfully!");

  } catch (error) {
    console.error("Error updating product:", error);
    res.redirect("/pageerror");
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

    // Remove image reference from product
    await Product.findByIdAndUpdate(
      productIdToServer,
      { $pull: { productImage: imageNameToServer } }
    );

    // Delete actual image file - use consistent path
    const imagePath = path.resolve("public", "uploads", "product-images", imageNameToServer);
    const exists = await fs.access(imagePath).then(() => true).catch(() => false);
    if (exists) {
      await fs.unlink(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }

    res.send({ status: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};