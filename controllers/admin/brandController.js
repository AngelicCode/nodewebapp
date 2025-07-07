const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

const getBrandPage = async (req,res)=>{
  try{
    const search = req.query.search ? req.query.search.trim() : "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page-1)*limit;
    const brandData = await Brand.find({}).sort({createAt:-1}).skip(skip).limit(limit);
    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands/limit);
    const reverseBrand = brandData.reverse();
    res.render("brands",{
      data:reverseBrand,
      currentPage:page,
      totalPages:totalPages,
      totalBrands:totalBrands,
      search
    })

  }catch(error){
    res.redirect("/pageerror");
  }
}

const addBrand = async (req, res) => {
   try {
    const brand = req.body.name.trim();

    const findBrand = await Brand.findOne({
      brandName: { $regex: new RegExp("^" + brand + "$", "i") }
    });

    if (findBrand) {
      return res.status(409).json({ success: false, message: "Brand already exists" });

    }

    const image = req.file.filename;

    const newBrand = new Brand({
      brandName: brand,
      brandImage: image,
    });

    await newBrand.save();
    res.status(201).json({ success: true, message: "Brand added successfully", brand: newBrand });
  } catch (error) {
    console.error("Error adding brand:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const blockBrand = async (req, res) => {
  try {
    const id = req.body.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.json({ success: true, message: "Brand blocked successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const unBlockBrand = async (req, res) => {
  try {
    const id = req.body.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({ success: true, message: "Brand unblocked successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const deleteBrand = async (req, res) => {
  try {
    const id = req.body.id;
    await Brand.deleteOne({ _id: id });
    res.json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
  





module.exports = {
  getBrandPage,addBrand,blockBrand,unBlockBrand,deleteBrand,
};