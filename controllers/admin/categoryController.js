const Category = require("../../models/categorySchema");
const mongoose = require("mongoose");

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const search = req.query.search ? req.query.search.trim() : "";

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const categoryData = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      categories: categoryData,
      currentPage: page,
      totalPages,
      totalCategories,
      search,
    });
  } catch (error) {
    console.error("Error in categoryInfo:", error);
    res.redirect("/pageerror");
  }
};

const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: "Name and description are required" });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(trimmedName)) {
      return res.status(400).json({ error: "Category name should contain only letters and spaces" });
    }
    
    const existingCategory = await Category.findOne({ name: trimmedName })
      .collation({ locale: "en", strength: 2 });
    
    if (existingCategory) {
      return res.status(409).json({ error: "Category already exists" });
    }

    const newCategory = new Category({
      name: trimmedName,
      description: trimmedDescription,
    });

    await newCategory.save();
    return res.status(201).json({ message: "Category added successfully" });

  } catch (error) {
    console.error("Error in addCategory:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getListCategory = async (req, res) => {
  try {
    const id = req.query.id;
    
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.status(200).json({ message: "Category listed successfully" });
  } catch (error) {
    console.error("Error in getListCategory:", error);
    res.status(500).json({ error: "Failed to list category" });
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    const id = req.query.id;
    
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.status(200).json({ message: "Category unlisted successfully" });
  } catch (error) {
    console.error("Error in getUnlistCategory:", error);
    res.status(500).json({ errorOrmatResponse: "Failed to unlist category" });
  }
};


const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.render("edit-category", { category: category });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    const trimmedName = categoryName.trim();
    const trimmedDescription = description.trim();

    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(trimmedName)) {
      return res.status(400).json({ error: "Category name should contain only letters and spaces" });
    }

    const duplicateCategory = await Category.findOne({
      name: trimmedName,
      _id: { $ne: id },
    }).collation({ locale: "en", strength: 2 });

    if (duplicateCategory) {
      return res.status(400).json({ error: "Category already exists, please choose another name" });
    }

    const existing = await Category.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (
      existing.name === trimmedName &&
      existing.description === trimmedDescription
    ) {
      return res.status(200).json({ status: "no_change" });
    }

const updateCategory = await Category.findByIdAndUpdate(
  id,
  {
    name: trimmedName,
    description: trimmedDescription,
  },
  { new: true }
  );

    if (updateCategory) {
      return res.status(200).json({ status: "updated" });
    } else {
      return res.status(500).json({ error: "Failed to update category" });
    }

  } catch (error) {
    console.error("Error in editCategory:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports = {
  categoryInfo,
  addCategory,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
};
