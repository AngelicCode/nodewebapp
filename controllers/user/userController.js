const User = require('../../models/userSchema');
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const Brand = require("../../models/brandSchema");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const { getCartCount } = require('../../helpers/cartHelper');
const { getLargestOffer } = require('../../helpers/offerHelper');
const { generateReferralCode, addReferralBonus } = require('../../helpers/referelCodeHelper');

const pageNotFound = async (req,res)=>{

  try{
    res.render("page_404");

  }catch(error){
    res.redirect("/pageNotFound");

  }
};


const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user;
    const cartCount = await getCartCount(userId);

    const categories = await Category.find({ isListed: true });

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((cat) => cat._id) },
      quantity: { $gt: 0 }
    })
      .sort({ createdAt: -1 }) 
      .limit(4)                
      .lean();

      const productsWithOffers = await Promise.all(
      productData.map(async (product) => {
        const offer = await getLargestOffer(product._id);
        return {
          ...product,
          bestOffer: offer
        };
      })
    );

    if (userId) {
      const userData = await User.findById(userId).lean();
      return res.render("home", {
        user: userData,
        products: productsWithOffers,
        cartCount: cartCount,
        
      });
    } else {
      return res.render("home", {
                  user: null,
                  products: productsWithOffers,

              });
    }

  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).send("Server Error");
  }
};

const loadSignup = async (req, res) => {
    try {
        
        const referralCode = req.session.referelCode;
        
        return res.render("signup", { 
            referralCode: referralCode 
        });
        
    } catch (error) {
        console.log("Signup page not loading:", error.message);
        res.status(500).send("Server Error");
    }
};

const loadShopping = async (req,res)=>{
  try{
    return res.render("shop");

  }catch(error){
    console.log("Shopping page not loading :",error.message);
    res.status(500).send("Server Error");

  }

};

function generateOtp(){
  return Math.floor(100000 + Math.random()*900000).toString();

};

async function sendVerificationEmail(email,otp) {
  try {

    console.log("Sending to:", email);
    console.log("OTP to send:", otp);
    
    const transporter = nodemailer.createTransport({

      service: "gmail",
      port:587,
      secure:false,
      requireTLS:true,
      auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD
      }

    });

    const info = await transporter.sendMail({

      from:process.env.NODEMAILER_EMAIL,
      to:email,
      subject:"Verify your account",
      text:`Your OTP is ${otp}`,
      html:`<b>Your OTP: ${otp}</b>`

    });


    return info.accepted.length>0;

  } catch (error) {
    console.error("Error sending email",error);
    return false;
  }
  
};

const signup = async (req,res)=>{
  
  try{
    const { name,phone,email,password,confirmPassword } = req.body;

    const referelCode = req.session.referelCode;
    let referringUser = null;

    if(referelCode){
      referringUser = await User.findOne({referelCode:referelCode});
    }

   if(password !== confirmPassword){
    return res.render("signup",{message:"Password do not match"});

   }
   const findUser = await User.findOne({email});

   if(findUser){
    return res.render("signup",{message:"User with this email already exists"});
   }

   const otp = generateOtp();

   console.log("Generated:",otp);

   const emailSent = await sendVerificationEmail(email,otp);
    
   if(!emailSent){
    console.log("Failed to send email");
    return res.status(500).json({ success: false, message: "Failed to send verification email" });
   }

   req.session.userOtp = otp;
   req.session.userData = {
    name,
    phone,
    email,
    password,
    referelCode:generateReferralCode(),
    referredBy: referringUser ? referringUser._id : null,
  };

  if (referringUser) {
      req.session.referringUserId = referringUser._id;
    }

   res.render("verify-otp");

   }catch(error){
    console.error("Signup error",error);
    return res.redirect("/pageNotFound");
  }

};

const securePassword = async(password)=>{
  try{
    const passwordHash = await bcrypt.hash(password,10);
    return passwordHash;

  }catch(error){
    console.error("Password hashing error:", error);
    throw error;
  }
}

const verifyOtp = async (req,res)=>{
  try{
    const {otp} = req.body;
    console.log(otp);

    if(otp===req.session.userOtp){
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name:user.name,
        email:user.email,
        phone:user.phone,
        password:passwordHash,
        referelCode: user.referelCode, 
        referredBy: user.referredBy,

      })

      await saveUserData.save();

       if (req.session.referringUserId) {
        await addReferralBonus(req.session.referringUserId, saveUserData._id);
      }

     req.session.userOtp = null;
     req.session.userData = null;
     req.session.referringUserId = null;
     req.session.referelCode = null;
     
     return res.json({ success:true, redirectUrl:"/login" })

    }else{
     return res.status(400).json({success:false, message:"Invalid OTP, Please try again"});
    }

  }catch(error){
    console.error("Error Verifying OTP",error);
    return res.status(500).json({success:false, message:"An error occured"});

  }
  };

const refCode = async (req, res) => {
    try {

        const referelCode = req.params.code;
        
        req.session.referelCode = referelCode;
        
        res.redirect("/signup");
        
    } catch (error) {
        console.error("Error in refCode:", error);
        res.redirect("/signup");
    }
};

const resendOtp = async (req,res)=>{
  try{
    const {email} = req.session.userData;

    if(!email){
      return res.status(400).json({success:false,message:"Email not found in session"})

    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email,otp);

    if(emailSent){
      console.log("Resend OTP:",otp);
      res.status(200).json({success:true,message:"OTP resend successfully."});
    }

  }catch(error){
    console.error("Error resending OTP",error);
    res.status(500).json({success:false,message:"Internal Server Error. Please try again"});
}
  
};

const loadLogin = async (req,res)=>{
  try{
    if(!req.session.user){
      return res.render("login")
    }else{
      res.redirect("/");
    }

  }catch(error){
    res.redirect("/pageNotFound");
  }
};

const login = async (req,res)=>{
  try{
    const {email,password} = req.body;
    const findUser = await User.findOne({isAdmin:false,email:email});

    if(!findUser){
      return res.render("login",{message:"User not found"});
    }

    if(findUser.isBlocked){
      return res.render("login",{message:"User is blocked by admin"});
    }

    const passwordMatch = await bcrypt.compare(password,findUser.password);

    if(!passwordMatch){
      return res.render("login",{message:"Incorrect Password"});
    }

    req.session.user = {
      _id: findUser._id,
      name: findUser.name,
      email: findUser.email,
      phone: findUser.phone,
    };

    res.redirect("/");

  }catch(error){
    console.error("login error",error);
    res.render("login",{message:"Login failed. Please try again later"});
  }
};

const logout = async (req,res)=>{

  try{
    req.session.destroy((err)=>{
      if(err){
        console.log("Session destruction error",err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login");
    })

  }catch(error){
    console.log("Logout error",error);
    res.redirect("/pageNotFound");
  }
}

const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const cartCount = await getCartCount(user?._id);

    let cartProductIds = [];
    let wishlistProductIds = [];
    if (user) {
      const wishlistDoc = await Wishlist.findOne({ userId: user._id }).lean();
      if (wishlistDoc && Array.isArray(wishlistDoc.products)) {
        wishlistProductIds = wishlistDoc.products.map(p => p.productId.toString());
      }

      const cartDoc = await Cart.findOne({ userId: user._id }).lean();
      if (cartDoc && Array.isArray(cartDoc.items)) {
        cartProductIds = cartDoc.items.map(p => p.productId.toString()); 
      }

    }
    
    const [categories, brands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
      
    ]);

    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    let query = {
      isBlocked: false,
      
    };

    const searchTerm = req.query.search || (req.body && req.body.search) || '';
    if (searchTerm) {
      query.$or = [
        { productName: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const categoryFilter = req.query.category || (req.body && req.body.category) || req.session.filterCategory;
    if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'undefined' && categoryFilter !== '') {
      query.category = categoryFilter;
      req.session.filterCategory = categoryFilter;
    } else if (categoryFilter === 'all') {
      delete req.session.filterCategory;
    }

    const brandFilter = req.query.brand || (req.body && req.body.brand) || req.session.filterBrand;
    if (brandFilter && brandFilter !== 'all' && brandFilter !== 'undefined' && brandFilter !== '') {
      query.brand = brandFilter;
      req.session.filterBrand = brandFilter;
    } else if (brandFilter === 'all') {
      delete req.session.filterBrand;
    }

    const minPrice = parseFloat(req.query.minPrice || (req.body && req.body.minPrice) || '');
    const maxPrice = parseFloat(req.query.maxPrice || (req.body && req.body.maxPrice) || '');

    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      query.salePrice = {
        $gte: !isNaN(minPrice) ? minPrice : 0,
        $lte: !isNaN(maxPrice) ? maxPrice : Number.MAX_SAFE_INTEGER
      };
      req.session.priceFilter = {
        min: !isNaN(minPrice) ? minPrice : undefined,
        max: !isNaN(maxPrice) ? maxPrice : undefined
      };
    } else if (req.session.priceFilter) {
      query.salePrice = {
        $gte: req.session.priceFilter.min || 0,
        $lte: req.session.priceFilter.max || Number.MAX_SAFE_INTEGER
      };
    }

    const sortOption = req.query.sort || (req.body && req.body.sort) || 'newest';
    let sortCriteria = { createdAt: -1 };

    switch (sortOption) {
      case 'price-low-high':
        sortCriteria = { salePrice: 1 };
        break;
      case 'price-high-low':
        sortCriteria = { salePrice: -1 };
        break;
      case 'name-a-z':
        sortCriteria = { productName: 1 };
        break;
      case 'name-z-a':
        sortCriteria = { productName: -1 };
        break;
    }

    let products = await Product.find(query)
      .populate('category brand')
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .lean();

      products = products.filter(product => {
      return product &&
        product.category && product.category.isListed !== false &&
        product.brand && product.brand.isBlocked === false &&
        product.isBlocked === false;
    });

    const productsWithOffers = await Promise.all(
      products.map(async (product) => {
        const offer = await getLargestOffer(product._id);
        return {
          ...product,
          bestOffer: offer
        };
      })
    );

    const totalFilteredCount = await Product.countDocuments({
      ...query,
    });

    const totalPages = Math.ceil(totalFilteredCount / limit);


    productsWithOffers.forEach((product, index) => {
      product.animationClass = "product-item";
      product.delay = index * 0.1;
    });

    const isFiltered = !!(categoryFilter || brandFilter || minPrice || maxPrice || req.session.priceFilter);

    const viewQuery = {
      search: searchTerm,
      category: categoryFilter,
      brand: brandFilter,
      minPrice: minPrice || (req.session.priceFilter && req.session.priceFilter.min),
      maxPrice: maxPrice || (req.session.priceFilter && req.session.priceFilter.max),
      sort: sortOption
    };

    res.render("shop", {
      user,
      products: productsWithOffers,
      category: categories,
      brand: brands,
      totalProducts: totalFilteredCount,
      currentPage: page,
      totalPages,
      query: viewQuery,
      isSearch: !!searchTerm,
      isFiltered,
      searchTerm: searchTerm || '',
      animationSettings: {
        stagger: 0.1,
        duration: 0.8,
        ease: "power2.out"
      },
      wishlistProductIds, 
      cartProductIds,
      cartCount: cartCount,
        
    });

  } catch (error) {
    console.error("Error loading shopping page:", error);

    res.status(500).render("shop", {
      message: "Couldn't load products",
      user: req.session.user,
      products: [],
      category: [],
      brand: [],
      totalProducts: 0,
      currentPage: 1,
      totalPages: 1,
      query: req.query || {},
      isSearch: false,
      isFiltered: false,
      searchTerm: '',
      animationSettings: {
        stagger: 0.1,
        duration: 0.8,
        ease: "power2.out"
      },
      wishlistProductIds: [],
      cartProductIds: [],

    });
  }
};
module.exports = {loadHomepage,pageNotFound,loadSignup,loadShopping,signup,verifyOtp,resendOtp,loadLogin,login,logout,loadShoppingPage,refCode,}