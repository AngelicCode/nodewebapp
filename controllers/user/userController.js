const User = require('../../models/userSchema');
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const Brand = require("../../models/brandSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();

const pageNotFound = async (req,res)=>{

  try{
    res.render("page_404");

  }catch(error){
    res.redirect("/pageNotFound");

  }
};


const loadHomepage = async (req,res)=>{

  try{
    const user = req.session.user;
    const categories = await Category.find({isListed:true});
    let productData = await Product.find(
      {isBlocked:false,
        category: { $in: categories.map(category => category._id)},quantity:{$gt:0}

      }
    )

    productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
    productData = productData.slice(0,4);

    if(user){

      //res.render("home",{user});

      const userData = await User.findOne({_id:user._id});
      return res.render("home",{user:userData, products:productData});
      
      //req.session.user = userData;

    }else{
    return res.render("home",{products:productData});
  }

  }catch(error){
    console.log("Home page not found");
    res.status(500).send("Server Error");

  }
};

const loadSignup = async (req,res)=>{

  try{
    return res.render("signup");

  }catch(error){
    console.log("Home page not loading :",error.message);
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
   req.session.userData = {name,phone,email,password};

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
        password:passwordHash
      })

      await saveUserData.save();
     // req.session.user = saveUserData._id;

     req.session.userOtp = null;
     req.session.userData = null;
     
     return res.json({ success:true, redirectUrl:"/login" })

    }else{
     return res.status(400).json({success:false, message:"Invalid OTP, Please try again"});
    }

  }catch(error){
    console.error("Error Verifying OTP",error);
    return res.status(500).json({success:false, message:"An error occured"});

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
    
    // Get all active categories and brands for filters
    const [categories, brands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false })
    ]);

    // Pagination and filtering setup
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Products per page
    const skip = (page - 1) * limit;

    // Build query with filters
    const query = { 
      isBlocked: false,
      quantity: { $gt: 0 }
    };

    // Apply search filter
    if (req.query.search) {
      query.$or = [
        { productName: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Apply category filter
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Apply price range filter (like in the video)
    if (req.query.minPrice || req.query.maxPrice) {
      query.salePrice = {
        $gte: parseFloat(req.query.minPrice) || 0,
        $lte: parseFloat(req.query.maxPrice) || 999999
      };
    }

    // Get products with animations-ready structure
    const products = await Product.find(query)
      .populate('category brand')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain objects for GSAP animations

    // Add animation classes to each product
    products.forEach(product => {
      product.animationClass = "product-item"; // Base class for GSAP animations
      product.delay = Math.random() * 0.5; // Random delay for staggered animations
    });

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Prepare categories with IDs for the view
    const categoriesWithIds = categories.map(cat => ({
      _id: cat._id,
      name: cat.name,
      isListed: cat.isListed
    }));

    res.render("shop", {
      user: user,
      products: products,
      category: categoriesWithIds,
      brand: brands,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
      query: req.query, // Pass all query params back to view
      // GSAP animation settings
      animationSettings: {
        stagger: 0.1,
        duration: 0.8,
        ease: "power2.out"
      }
    });

  } catch (error) {
    console.error("Error loading shopping page:", error);
    res.status(500).render("error", { 
      message: "Couldn't load products",
      user: req.session.user 
    });
  }
};

module.exports = {loadHomepage,pageNotFound,loadSignup,loadShopping,signup,verifyOtp,resendOtp,loadLogin,login,logout,loadShoppingPage,}