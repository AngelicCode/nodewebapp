const Product = require("../../models/productSchema"); 
const Category = require("../../models/categorySchema"); 
const User = require("../../models/userSchema"); 
const Wishlist = require("../../models/wishlistSchema");

const productDetails = async (req, res) => { 
    try {    
       const userId = req.session.user;  
        const userData = await User.findById(userId);

            let wishlistProductIds = [];  
            if (userId) {
            const wishlistData = await Wishlist.findOne({ userId }).lean();

              if (wishlistData && Array.isArray(wishlistData.products)) {
              wishlistProductIds = wishlistData.products.map(item => item.productId.toString());
            }
          }
        
         const productId = req.query.id;     
         const product = await Product.findById(productId)
         .populate("category")
         .populate("brand");  
         

          if (
            !product ||
            product.isBlocked ||
            // product.quantity === 0 ||
            product.status !== "Available"
          ) {
            return res.redirect('/shop');
          }

         const findCategory = product.category;     
         const categoryOffer = findCategory?.categoryOffer || 0;     const productOffer = product.productOffer || 0;     
         const totalOffer = categoryOffer + productOffer;      
         const brand = product.brand ? {...product.brand.toObject(),name: product.brand.brandName} : null;  

         const relatedProducts = await Product.find({category:product.category._id,
            _id:{$ne:productId},
             isBlocked:false,
             status:"Available",
             quantity: { $gt: 0 }
          }).limit(4).populate("brand");
         
         res.render("product-details", {
          user: userData,
          product: product,       
          quantity: product.quantity,       
          totalOffer: totalOffer,       
          category: findCategory,       
          brand: brand,
          relatedProducts:relatedProducts,
          wishlistProductIds,

        });
            

        } catch (error) {     
          console.error("Error fetching product details:", error);     
          res.status(500).redirect('/shop');   
        } 
};  
      
      module.exports={   
        productDetails, 
      
    }