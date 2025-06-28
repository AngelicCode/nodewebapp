const Product = require("../../models/productSchema"); 
const Category = require("../../models/categorySchema"); 
const User = require("../../models/userSchema");  

const productDetails = async (req, res) => { 
    try {    
       const userId = req.session.user;  
        const userData = await User.findById(userId);    
         const productId = req.query.id;     
         const product = await Product.findById(productId)       .populate("category").populate("brand");  

         const findCategory = product.category;     
         const categoryOffer = findCategory?.categoryOffer || 0;     const productOffer = product.productOffer || 0;     
         const totalOffer = categoryOffer + productOffer;      
         const brand = product.brand ? {...product.brand.toObject(),    name: product.brand.brandName} : null;      
         res.render("product-details", {
          user: userData,
          product: product,       
          quantity: product.quantity,       
          totalOffer: totalOffer,       
          category: findCategory,       
          brand: brand});    
        } catch (error) {     
          console.error("Error fetching product details:", error);     res.redirect("/pageNotFound");   
        } 
      };  
      
      module.exports={   
        productDetails, 
      }