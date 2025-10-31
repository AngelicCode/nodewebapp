const Product = require("../../models/productSchema"); 
const Category = require("../../models/categorySchema"); 
const User = require("../../models/userSchema"); 
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");
const { getCartCount } = require('../../helpers/cartHelper');
const { getLargestOffer } = require('../../helpers/offerHelper');

const productDetails = async (req, res) => { 
    try {    
       const userId = req.session.user; 
       const cartCount = await getCartCount(userId); 
       const userData = await User.findById(userId);

            let wishlistProductIds = []; 
            let cartProductIds = []; 
            if (userId) {
            let wishlistData = await Wishlist.findOne({ userId }).lean();

              if (wishlistData && Array.isArray(wishlistData.products)) {
              wishlistProductIds = wishlistData.products.map(item => item.productId.toString());
            }

            const cartData = await Cart.findOne({userId}).lean();

            if(cartData && Array.isArray(cartData.items)){
              cartProductIds = cartData.items.map((item)=>item.productId.toString());
            }
          }
        
         const productId = req.query.id;     
         const product = await Product.findById(productId)
         .populate("category")
         .populate("brand");  
         

          if ( 
            !product ||
            product.isBlocked ||
            !product.category ||
            product.category.isListed == false ||
            !product.brand || 
            product.brand.isBlocked || 
            product.status !== "Available"
          ) {
            return res.redirect('/shop');
          }

         const bestOffer = await getLargestOffer(productId);

         const findCategory = product.category;           
         const brand = product.brand ? {...product.brand.toObject(),name: product.brand.brandName} : null;  

         const relatedProducts = await Product.find({category:product.category._id,
            _id:{$ne:productId},
             isBlocked:false,
             status:"Available",
             quantity: { $gt: 0 }
          }).limit(4).populate("brand");

        const relatedProductsWithOffers = await Promise.all(
         relatedProducts.map(async (relatedProduct) => {
           const offer = await getLargestOffer(relatedProduct._id);
           return {
             ...relatedProduct.toObject(),
             bestOffer: offer
           };
         })
       );
         
         res.render("product-details", {
          user: userData,
          product: product,       
          quantity: product.quantity,
          bestOffer: bestOffer,       
          category: findCategory,       
          brand: brand,
          relatedProducts:relatedProductsWithOffers,
          wishlistProductIds,
          cartProductIds,
          cartCount: cartCount,

        });
            

        } catch (error) {     
          console.error("Error fetching product details:", error);     
          res.status(500).redirect('/shop');   
        } 
};  

const detailspageAddToCart = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    const productId = req.body.productId;
    const quantityToAdd = parseInt(req.body.quantity)||1;

    if (!userId) {
      return res.status(401).json({ status: false,message:"User not authenticated" });
    }

    const product = await Product.findById(productId)
    .populate("category")
    .populate("brand");

    if (!product) {
      return res.json({ status: false, message:"Product not found" });
    }

    if(
      product.isBlocked || 
      !product.category || 
      product.category.isListed == false || 
      !product.brand || 
      product.brand.isBlocked
    ){
      return res.json({redirect:"/shop",
        status:false,
        message:"This product is Blocked or Unavailable"
      });

    }

    if(quantityToAdd>5){
      return res.status(400).json({ status: false, message: "Maximum quantity per item in cart is 5" });
    }
    
    if (product.quantity <= 0 || product.quantity < quantityToAdd) {
      return res.json({
        status: false,
        message: "Insufficient stock available",
        reload: true  
      });
    }

    const currentOffer = await getLargestOffer(productId);
    const finalPrice = currentOffer.percentage > 0 ? currentOffer.finalPrice : product.salePrice;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{
          productId,
          quantity: quantityToAdd,
          price: finalPrice,
          originalPrice: product.salePrice, 
          totalPrice: finalPrice * quantityToAdd,
          addedAt: new Date()
          
        },
      ],

      });
    } else {
      const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

      if (existingItemIndex === -1) {
        cart.items.push({
          productId,
          quantity: quantityToAdd,
          price: finalPrice, 
          originalPrice: product.salePrice, 
          totalPrice: finalPrice * quantityToAdd,
          addedAt: new Date()

        });
       }else {
        const existingItem = cart.items[existingItemIndex];
        const newQuantity = existingItem.quantity + quantityToAdd;

        if (newQuantity > product.quantity) {
          return res.json({ status: false,
            message:"Insufficient stock available" });
        }

        existingItem.price = finalPrice;
        existingItem.originalPrice = product.salePrice; 
        existingItem.quantity = newQuantity;
        existingItem.totalPrice = newQuantity * finalPrice;
      }
    }

    await cart.save();
    const cartCount = await getCartCount(userId);
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: productId } } }
    );

    res.json({ 
       status: true,   
       message: "Product added to cart",
       cartCount:cartCount });

  } catch (error) {
    console.error("Add to Cart error:", error);
    res.status(500).json({ status: false, error: "Server error" });
  }
}
      
      module.exports={   
        productDetails,detailspageAddToCart, 
      
    }