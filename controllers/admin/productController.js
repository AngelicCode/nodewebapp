const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const multer = require('multer');
const upload = require("../../helpers/multer"); 
const User = require("../../models/userSchema");

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

const addProducts = [
  upload.array("images", 4),
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      return res.redirect(`/admin/addProducts?error=${encodeURIComponent(err.message)}`);
    } else if (err) {
      console.error("Other error:", err);
      return res.redirect(`/admin/addProducts?error=${encodeURIComponent(err.message)}`);
    }
    next();
  },
  async (req, res) => {
    try {
      const products = req.body;
      const regularPrice = Number(products.regularPrice);
      const salePrice = Number(products.salePrice);

      if (isNaN(regularPrice) || isNaN(salePrice)) {
        return res.redirect("/admin/addProducts?error=Invalid price values");
      }

      if (regularPrice < salePrice) {
        return res.redirect("/admin/addProducts?error=Regular price must be greater than or equal to sale price");
      }

      const productExists = await Product.findOne({ productName: products.productName });

      if (productExists) {
        return res.redirect("/admin/addProducts?error=Product already exists, please try with another name");
      }

      const images = [];
      if (req.files && req.files.length > 0) {
        const destDir = path.resolve("public", "Uploads", "product-images");
        await fs.mkdir(destDir, { recursive: true }).catch(() => {});

        for (const file of req.files) {
          const originalPath = path.resolve(file.path);
          const ext = file.mimetype.split("/")[1];
          const filename = `product_${Date.now()}.${ext}`;
          const resizedPath = path.resolve(destDir, filename);

          if (!await fs.access(originalPath).then(() => true).catch(() => false)) {
            console.error(`Original file not found: ${originalPath}`);
            continue;
          }

          try {

            if (file.mimetype === "image/gif") {
              await fs.copyFile(originalPath, resizedPath);
              images.push(filename);
              console.log(`GIF preserved without processing: ${filename}`);
              continue;
            }

            const imageBuffer = await fs.readFile(originalPath);
            let sharpInstance = sharp(imageBuffer).resize({ width: 800, height: 800, fit: "cover" });

            if (file.mimetype === "image/png") {
              sharpInstance = sharpInstance.png({ quality: 100 });
            } else {
              sharpInstance = sharpInstance.jpeg({ quality: 90 });
            }

            const processedBuffer = await sharpInstance.toBuffer();
            await fs.writeFile(resizedPath, processedBuffer);

            images.push(filename);
            console.log(`Image processed successfully: ${filename}`);
          } catch (error) {
            console.error(`Error processing ${filename}:`, error);
            continue;
          }

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
        status: "Available"
      });

      await newProduct.save();
      return res.redirect("/admin/addProducts?success=Product added successfully!");
    } catch (error) {
      console.error("Error saving product:", error);
      return res.redirect("/admin/addProducts?error=Failed to add product");
    }
  }
];

const getAllProducts = async (req, res) => {
  try {
    
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const [category, brand] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false })
    ]);

    const query = {};
    if (search) {
      query.productName = {$regex: new RegExp(search, "i") };
    }

    const productData = await Product.find(query)
      .populate("category brand")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const filteredProducts = productData.filter(p => p.brand !== null);
    const totalCount = await Product.countDocuments(query);

    res.render("products", {
      data: filteredProducts,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      search,
      cat: category,
      brand
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
    res.status(500).json({ success: false, error: "Failed to block product" });
  }
};

const unblockProduct = async (req, res) => {
  try {
    const { id } = req.body;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.status(200).json({ success: true, isBlocked: false });
  } catch (error) {
    console.error("Unblock product error:", error);
    res.status(500).json({ success: false, error: "Failed to unblock product" });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});
    const brand = await Brand.find({});

    const verifiedImages = [];
    for (const image of product.productImage) {
      const imagePath = path.resolve("public", "Uploads", "product-images", image);
      const exists = await fs.access(imagePath).then(() => true).catch(() => false);
      if (exists) {
        verifiedImages.push(image);
      } else {
        console.log(`Image not found on server: ${image}`);
      }
    }

    if (verifiedImages.length !== product.productImage.length) {
      product.productImage = verifiedImages;
      await product.save();
    }

    res.render("edit-product", {
      product,
      cat: category,
      brand
    });
  } catch (error) {
    console.error("Error loading edit product page:", error);
    res.redirect("/pageerror");
  }
};

const editProduct = [
  upload.array("images", 4),
  async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;

      const regularPrice = Number(data.regularPrice);
      const salePrice = Number(data.salePrice);

      if (isNaN(regularPrice) || isNaN(salePrice)) {
        return res.redirect("/admin/products?error=Invalid price values");
      }

      if (regularPrice < salePrice) {
        return res.redirect("/admin/products?error=Regular price must be greater than or equal to sale price");
      }

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

      if (data.existingImages) {
        updateFields.productImage = Array.isArray(data.existingImages)
          ? data.existingImages
          : [data.existingImages];
      }

      if (req.files && req.files.length > 0) {
        const destDir = path.resolve("public", "Uploads", "product-images");
        await fs.mkdir(destDir, { recursive: true }).catch(() => {});

        const newImages = [];
        for (const file of req.files) {
          const originalPath = path.resolve(file.path);
          const ext = file.mimetype.split("/")[1];
          const filename = `product_${Date.now()}.${ext}`;
          const resizedPath = path.resolve(destDir, filename);

          console.log(`Processing file: ${filename}`);
          console.log(`Original path: ${originalPath}`);
          console.log(`Resized path: ${resizedPath}`);

          if (!await fs.access(originalPath).then(() => true).catch(() => false)) {
            console.error(`Original file not found: ${originalPath}`);
            continue;
          }

          try {
            if (file.mimetype === "image/gif") {
              await fs.copyFile(originalPath, resizedPath);
              newImages.push(filename);
              console.log(`GIF preserved without processing: ${filename}`);
              continue;
            }

            const imageBuffer = await fs.readFile(originalPath);
            let sharpInstance = sharp(imageBuffer).resize({ width: 800, height: 800, fit: "cover" });

            if (file.mimetype === "image/png") {
              sharpInstance = sharpInstance.png({ quality: 100 });
            } else {
              sharpInstance = sharpInstance.jpeg({ quality: 90 });
            }

            const processedBuffer = await sharpInstance.toBuffer();
            await fs.writeFile(resizedPath, processedBuffer);

            newImages.push(filename);
            console.log(`Image processed successfully: ${filename}`);
          } catch (error) {
            console.error(`Error processing ${filename}:`, error);
            continue;
          }

          if (originalPath !== resizedPath) {
            await fs.unlink(originalPath).catch(err =>
              console.error(`Failed to delete ${originalPath}:`, err)
            );
          }
        }
        updateFields.productImage = [...updateFields.productImage, ...newImages];
      }

      await Product.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
      res.redirect("/admin/products?success=Product updated successfully!");
    } catch (error) {
      console.error("Error updating product:", error);
      res.redirect("/pageerror");
    }
  }
];

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

    await Product.findByIdAndUpdate(
      productIdToServer,
      { $pull: { productImage: imageNameToServer } }
    );

    const imagePath = path.resolve("public", "Uploads", "product-images", imageNameToServer);
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
  deleteSingleImage
};
