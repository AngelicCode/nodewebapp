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

    // Apply category filter (from query or session)
    const categoryFilter = req.query.category || req.session.filterCategory;
    if (categoryFilter) {
      query.category = categoryFilter;
    }

    // Apply brand filter (from query or session)
    const brandFilter = req.query.brand || req.session.filterBrand;
    if (brandFilter) {
      query.brand = brandFilter;
    }

    // Apply price range filter (from query or session)
    const priceFilter = {
      $gte: parseFloat(req.query.minPrice) || 
            parseFloat(req.session.priceFilter?.min) || 0,
      $lte: parseFloat(req.query.maxPrice) || 
            parseFloat(req.session.priceFilter?.max) || 999999
    };
    query.salePrice = priceFilter;

    // Get products with animations-ready structure
    const products = await Product.find(query)
      .populate('category brand')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    // Add animation classes to each product
    products.forEach((product, index) => {
      product.animationClass = "product-item";
      product.delay = index * 0.1; // More consistent staggered animation
    });

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Check if any filters are active
    const isFiltered = !!(categoryFilter || brandFilter || 
                         req.query.minPrice || req.query.maxPrice ||
                         req.session.priceFilter);

    res.render("shop", {
      user: user,
      products: products,
      category: categories,
      brand: brands,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages,
      query: {
        ...req.query,
        category: categoryFilter,
        brand: brandFilter,
        minPrice: req.query.minPrice || req.session.priceFilter?.min,
        maxPrice: req.query.maxPrice || req.session.priceFilter?.max
      },
      isSearch: !!req.query.search,
      isFiltered: isFiltered, // This fixes your original error
      searchTerm: req.query.search || '',
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

const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;

    const [categories, brands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false })
    ]);

    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const query = {
      isBlocked: false,
      quantity: { $gt: 0 }
    };

    if (req.query.search && req.query.search.trim() !== "") {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      query.$or = [
        { productName: { $regex: searchRegex } },
        { description: { $regex: searchRegex } }
      ];
    }

    // Category filter
    if (req.query.category && req.query.category !== "all") {
      query.category = req.query.category;
    }

    // Brand filter
    if (req.query.brand && req.query.brand !== "all") {
      query.brand = req.query.brand;
    }

    // Price filter
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
    query.salePrice = { $gte: minPrice, $lte: maxPrice };

    // Count total products for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch matching products
    const products = await Product.find(query)
      .populate("category brand")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add animation props to products
    products.forEach(product => {
      product.animationClass = "product-item";
      product.delay = Math.random() * 0.5;
    });

res.render("shop", {
  user,
  products,
  category: categories,
  brand: brands,
  totalProducts,
  currentPage: page,
  totalPages,
  query: req.query,
  isFiltered: !!(req.query.category || req.query.brand || req.query.minPrice || req.query.maxPrice),
  isSearch: !!req.query.search, 
  searchTerm: req.query.search || '', 
  animationSettings: {
    stagger: 0.1,
    duration: 0.8,
    ease: "power2.out"
  }
});

  } catch (error) {
    console.error("Error filtering products:", error);
    res.status(500).render("error", {
      message: "Unable to filter products",
      user: req.session.user
    });
  }
};

const filterByPrice = async (req, res) => {
  try {
    const { gt, lt } = req.query;
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });

    let priceFilter = {};
    
    if (gt !== undefined && lt !== undefined) {
      priceFilter = { 
        salePrice: { 
          $gt: parseInt(gt), 
          $lt: parseInt(lt) 
        } 
      };
    } else if (gt !== undefined) {
      priceFilter = { salePrice: { $gt: parseInt(gt) } };
    } else if (lt !== undefined) {
      priceFilter = { salePrice: { $lt: parseInt(lt) } };
    }

    const filteredProducts = await Product.find({
      isBlocked: false,
      ...priceFilter
    }).populate('brand').populate('category');

    const categories = await Category.find({ isBlocked: false });
    const brands = await Brand.find({ isBlocked: false });

    res.render("shop", {
      user: userData,
      products: filteredProducts,
      category: categories,
      brand: brands,
      totalPages: 1,
      currentPage: 1,
      query: req.query,
      isFiltered: !!(gt || lt), 
      isSearch: false, 
      searchTerm: '' 
    });

  } catch (err) {
    console.error("Error filtering by price:", err);
    res.status(500).send("Internal Server Error");
  }
};

const searchProducts = async (req, res) => {
    try {
        const { query: search, sort, minPrice, maxPrice, category, brand } = req.body;
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });

        // Get all listed categories and brands for sidebar
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isListed: true });

        // Base query conditions
        const queryConditions = {
            $and: [
                { isBlocked: false },
                { quantity: { $gt: 0 } },
                { 
                    $or: [
                        { productName: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ]
                }
            ]
        };

        // Apply category filter if exists in session or request
        if (req.session.filterCategory || category) {
            const filterCategory = category || req.session.filterCategory;
            queryConditions.$and.push({ category: filterCategory });
        } else {
            // Only apply category filter if not already filtered
            const categoryIds = categories.map(cat => cat._id.toString());
            queryConditions.$and.push({ category: { $in: categoryIds } });
        }

        // Apply brand filter if exists in session or request
        if (req.session.filterBrand || brand) {
            const filterBrand = brand || req.session.filterBrand;
            queryConditions.$and.push({ brand: filterBrand });
        }

        // Apply price range filter
        if (req.session.priceFilter || minPrice || maxPrice) {
            const priceFilter = {
                salePrice: {
                    ...(minPrice ? { $gte: parseFloat(minPrice) } : 
                        req.session.priceFilter?.min ? { $gte: req.session.priceFilter.min } : {}),
                    ...(maxPrice ? { $lte: parseFloat(maxPrice) } : 
                        req.session.priceFilter?.max ? { $lte: req.session.priceFilter.max } : {})
                }
            };
            queryConditions.$and.push(priceFilter);
        }

        // Sort options
        let sortOption = { createdOn: -1 }; // Default
        if (sort === 'price-low-high') sortOption = { salePrice: 1 };
        else if (sort === 'price-high-low') sortOption = { salePrice: -1 };
        else if (sort === 'name-a-z') sortOption = { productName: 1 };
        else if (sort === 'name-z-a') sortOption = { productName: -1 };

        // Execute search
        const searchResult = await Product.find(queryConditions)
            .populate('brand')
            .populate('category')
            .sort(sortOption);

        // Pagination
        const itemsPerPage = 10;
        const currentPage = parseInt(req.query.page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProducts = searchResult.slice(startIndex, endIndex);

        // Store active filters in session
        if (category) req.session.filterCategory = category;
        if (brand) req.session.filterBrand = brand;
        if (minPrice || maxPrice) {
            req.session.priceFilter = {
                min: minPrice || req.session.priceFilter?.min,
                max: maxPrice || req.session.priceFilter?.max
            };
        }

        res.render("shop", {
            user: userData,
            products: currentProducts.length > 0 ? currentProducts : null,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            count: searchResult.length,
            query: { 
              ...req.query,
                query: search,
                sort,
                minPrice: minPrice || req.session.priceFilter?.min,
                maxPrice: maxPrice || req.session.priceFilter?.max,
                category: category || req.session.filterCategory,
                brand: brand || req.session.filterBrand
            },
            isSearch: true,
            searchTerm: search,
            currentSort: sort || 'newest',
            isFiltered: !!(req.session.filterCategory || req.session.filterBrand || req.session.priceFilter),
    
        });

    } catch (error) {
        console.error("Search error:", error);
        res.status(500).render('error', {
            message: "Search failed",
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

module.exports = {loadHomepage,pageNotFound,loadSignup,loadShopping,signup,verifyOtp,resendOtp,loadLogin,login,logout,loadShoppingPage,filterProduct,filterByPrice,searchProducts,}