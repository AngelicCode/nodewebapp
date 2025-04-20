const Category = require("../../models/categorySchema");


const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const search = req.query.search ? req.query.search.trim() : "";

    // If search is active, use a regex filter
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
      search, // ✅ now this will not throw error
    });
  } catch (error) {
    console.error("Error in categoryInfo:", error);
    res.redirect("/pageerror");
  }
};


const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || !description) {
      return res.status(400).json({ error: "Name and description are required" });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    // Optional: Validate name format
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(trimmedName)) {
      return res.status(400).json({ error: "Category name should contain only letters and spaces" });
    }

    // Check for duplicate
    const existingCategory = await Category.findOne({ name: trimmedName });
    if (existingCategory) {
      return res.status(409).json({ error: "Category already exists" });
    }

    // Create and save new category
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

const getListCategory = async (req,res)=>{
  try{
    let id = req.query.id;
    await Category.updateOne({_id:id},{$set:{isListed:false}});
    res.redirect("/admin/category");
  }catch(error){
    res.redirect("/pageerror");
  }
}

const getUnlistCategory = async (req,res)=>{
  try{
    let id = req.query.id;
    await Category.updateOne({_id:id},{$set:{isListed:true}});
    res.redirect("/admin/category");
  }catch(error){
    res.redirect("/pageerror");
  }
}

module.exports = {
  categoryInfo,addCategory,getListCategory,getUnlistCategory,
};