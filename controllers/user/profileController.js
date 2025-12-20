const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { getCartCount } = require('../../helpers/cartHelper');
const session = require("express-session");
const { HTTP_STATUS } = require("../../helpers/httpStatus");
const { generateReferralCode, addReferralBonus } = require('../../helpers/referelCodeHelper');



function generateOtp(){
  const digits = "1234567890";
  let otp = "";
  for(let i=0;i<6;i++){
    otp+=digits[Math.floor(Math.random()*10)]
  }
  return otp;
}

const sendVerificationEmail = async (email,otp)=>{
  try {
    const transporter = nodemailer.createTransport({
      service:"gmail",
      port:587,
      secure:false,
      requireTLS:true,
      auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD,
      }
    })

    const mailOptions = {
      from:process.env.NODEMAILER_EMAIL,
      to:email,
      subject:"Your OTP for password reset",
      text:`Your OTP is ${otp}`,
      html:`<b><h4>Your OTP: ${otp}</h4><br></b>`

    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:",info.messageId);
    return true;

  } catch (error) {
    console.error("Error sending email",error);
    return false;
  }
}

const securePassword = async(password)=>{
try {
  const passwordHash = await bcrypt.hash(password,10);
  return passwordHash;
} catch (error) {
  console.error("Error in hashing password:",error)
}
}

const getForgotPassPage = async (req,res)=>{
  try {
    res.render("forgot-password")
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const forgotEmailValid = async (req,res)=>{
  try {
    const {email} = req.body;
    const findUser = await User.findOne({email:email});
    if(findUser){
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        req.session.userOtp = otp;
        req.session.email = email;
        res.render("forgotPass-otp");
        console.log("OTP:",otp);

      }else{
        res.json({success:false,message:"Failed to send OTP. Please try again"});
      }
    }else{
      res.render("forgot-password",{
        message:"User with this email does not exist"
      });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const verifyForgotPassOtp = async (req,res)=>{
  try {
    const enteredOtp = req.body.otp;
    if(enteredOtp === req.session.userOtp){
      res.json({success:true,redirectUrl:"/reset-password"});

    }else{
      res.json({success:false,message:"OTP not matching"});
    }

  } catch (error) {
    res.status(500).json({success:false,message:"An error occured. Please try again"});
  }
}

  const getResetPassPage = async (req,res)=>{
    try {
      res.render("reset-password");
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  }

  const resendOtp = async(req,res)=>{
    try {
      const otp = generateOtp();
      req.session.userOtp = otp;
      const email = req.session.email;
      console.log("Resending OTP to email:",email);
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        console.log("Resend OTP:",otp);
        res.status(200).json({success:true,message:"Resend OTP Successfull"})
      }
    } catch (error) {
      console.error("Error in resend OTP:",error);
      res.status(500).json({success:false,message:"Internal Server Error"});
    }
  }

  const postNewPassword = async(req,res)=>{
    try {
      const {newPass1, newPass2} = req.body;
      const email= req.session.email;
      if(newPass1 === newPass2){
        const passwordHash = await securePassword(newPass1);
        await User.updateOne({email:email},{$set:{password:passwordHash}}
        )
        res.redirect("/login");
      }else{
        res.render("reset-password",{meassage:"Passwords do not match"});
      }
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  }

     const userProfile = async(req,res)=>{
    try {
      const userId = req.session.user;
      const cartCount = await getCartCount(userId);
      
      let userData = await User.findById(userId).select('name email phone profilePhoto wallet referelCode redeemedUsers');      

      const addressData = await Address.findOne({userId:userId});

      const page = parseInt(req.query.page) || 1;
      const limit = 3; 
      const skip = (page - 1) * limit;

      const totalOrders = await Order.countDocuments({userId: userId});

      const orders = await Order.find({
        userId:userId
      }).sort({createdAt:-1})
        .skip(skip)
        .limit(limit)
        .populate({
          path: "orderItems.productId",
          select: "productImage"
        });

      const totalPages = Math.ceil(totalOrders / limit);

      res.render("profile",{
        user:userData,
        userAddress:addressData,
        orders:orders,
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders,
        baseUrl: '/userProfile?tab=orders&',
        query: req.query,
        cartCount: cartCount,

      })

    } catch (error) {
      console.error("Error for retrieve profile data",error);
      res.redirect("/pageNotFound");
    }

  }

  const changeEmail = async(req,res)=>{
    try {
      res.render("change-email");
    } catch (error) {
      res.redirect("/pageNotFound");
    }

  }

  const changeEmailValid = async(req,res)=>{
    try {
      const {email} = req.body;
      const userExists = await User.findOne({email});
      if(userExists){
        const otp = generateOtp();
        console.log("otp:",otp);
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-email-otp");
        console.log("email send:",email);
        console.log("otp:",otp);
      }else{
              res.json("email-error");
            }
    }else{
      res.render("change-email",{
        emailError:"User with this email not exists"

      })
    }

    } catch (error) {
      res.redirect("/pageNotFound");
    }

  }

  const verifyEmailOtp = async (req,res)=>{
    try {
      const enteredOtp = req.body.otp;
      if(enteredOtp === req.session.userOtp){
         res.json({ 
        success: true, 
        message: "Email verified successfully!",
        redirectUrl: "/new-email" 
      })
      }else{
         res.json({ 
        success: false, 
        message: "Invalid OTP. Please try again." 
      });
      }

    } catch (error) {
      res.status(500).json({ 
      success: false, 
      message: "An error occurred. Please try again." 
    });   
   }

  }

  const getNewEmailPage = async (req, res) => {
  try {
    res.render("new-email", {
      userData: req.session.userData
    });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
 }

  const updateEmail = async (req,res)=>{
    try {
      const newEmail = req.body.newEmail;
      const userId = req.session.user;
      await User.findByIdAndUpdate(userId,{email:newEmail})
      res.redirect("/userProfile");
    } catch (error) {
      res.redirect("/pageNotFound");
    }

  }

  const postChangePassword = async(req,res)=>{
    try {
      const userId = req.session.user;

      if(!userId){
        return res.status(401).json({success:false,message:"User not authenticated"})
      }

      const {currentPassword,newPassword} = req.body;

      if (!currentPassword || !newPassword) {
        return res.json({ success: false, message: "All fields are required" });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.json({ success: false, message: "User not found" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res.json({ success: false, message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await User.updateOne(
        { _id: userId },
        { $set: { password: hashedPassword } }
      );

      return res.json({
        success: true,
        message: "Password updated successfully"
      });

    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong"
      });
    }
  }

  const addAddress = async (req,res)=>{
    try {
      const user = req.session.user;
      const cartCount = await getCartCount(user);
      res.render("add-address",{
        user:user,
        cartCount: cartCount,

      });
    } catch (error) {
      res.redirect("/pageNotFound")
    }

  }

  const postAddAddress = async (req,res)=>{
    try {
      const userId = req.session.user;
      const userData = await User.findOne({_id:userId})
      const {addressType,name,city,landMark,state,pincode,altPhone} = req.body;

      const isValidAltPhone = (num) => {
        if (!num) return false;

        if (!/^\d{10}$/.test(num)) return false;
        if (!/^[6-9]/.test(num)) return false;
        if (num === "0000000000" || num === "1000000000") return false;
        if (/^(\d)\1{9}$/.test(num)) return false;

        const counts = {};
        for (const d of num) counts[d] = (counts[d] || 0) + 1;
        if (Object.values(counts).some(count => count >= 9)) return false;

        return true;
      };

      if (!isValidAltPhone(altPhone)) {
        return res.render("add-address", {
          message: "Please enter a valid 10-digit alternate phone number"
        });
      }

      const userAddress = await Address.findOne({userId:userData._id});
      if(!userAddress){
        const newAddress = new Address({
          userId:userData._id,
          address:[{addressType,name,city,landMark,state,pincode,altPhone}]
        })
        await newAddress.save();

      }else{
        userAddress.address.push({addressType,name,city,landMark,state,pincode,altPhone,});
        await userAddress.save();
      }

      res.redirect("/userProfile");
     
    } catch (error) {
      console.error("Error adding address:",error)
      res.redirect("/pageNotFound");
      
    }

  }

  const editAddress = async (req,res)=>{
    try {
      const addressId = req.query.id;
      const userId = req.session.user;
      const cartCount = await getCartCount(userId);
      const currAddress = await Address.findOne({"address._id":addressId,});

      if(!currAddress){
        return res.redirect("/pageNotFound");
      }

      const addressData = currAddress.address.find((item)=>{
        return item._id.toString() === addressId.toString();
      });

      if(!addressData){
        return res.redirect("/pageNotFound");
      }

      const user = await User.findById(userId).select("phone");

      res.render("edit-address",{
        address:addressData,
        user:userId,
        userPhone: user.phone,
        cartCount: cartCount,

      })

    } catch (error) {
      console.error("Error in edit address:",error);
      res.redirect("/pageNotFound");
    }

  }

  const postEditAddress = async (req,res)=>{
    try {
      const data = req.body;
      const addressId = req.query.id;
      const user = req.session.user;

      const isValidAltPhone = (num) => {
        if (!num) return false;

        const phone = String(num).trim();

        if (!/^\d{10}$/.test(phone)) return false;

        if (!/^[6-9]/.test(phone)) return false;

        if (phone === "0000000000" || phone === "1000000000") return false;

        if (/^(\d)\1{9}$/.test(phone)) return false;

        const counts = {};
        for (const d of phone) counts[d] = (counts[d] || 0) + 1;
        if (Object.values(counts).some(count => count >= 9)) return false;

        return true;
      };

      const currentUser = await User.findById(user).select("phone");

      if (!isValidAltPhone(data.altPhone)) {
        return res.render("edit-address", {
          message: "Please enter a valid 10-digit alternate phone number",
          address: {
            ...data,
            _id: addressId
          },
          userPhone: currentUser?.phone || "",
        });
      }

      let phone = data.phone;
      await User.findByIdAndUpdate(user, {
        phone
      });

      const updatedUser = await User.findById(user).select("phone");
      req.session.user.phone = updatedUser.phone;

      const findAddress = await Address.findOne({"address._id":addressId});

      if(!findAddress){
        res.redirect("/pageNotFound");
      }

      await Address.updateOne({"address._id":addressId},
        {$set : {
          "address.$" :{
            _id: addressId,
            addressType: data.addressType,
            name: data.name,
            city: data.city,
            landMark: data.landMark,
            state: data.state,
            pincode: data.pincode,
            altPhone: data.altPhone,
          }
        }}
      )

      res.redirect("/userProfile");

    } catch (error) {
      console.error("Error in edit address",error);
      res.redirect("/pageNotFound");
    }
  }

  const deleteAddress = async (req,res)=>{
    try {
      const user = req.session.user;
      const addressId = req.query.id;
      const findAddress = await Address.findOne({"address._id":addressId});
      if(!findAddress){
          return res.status(400).send("Address not Found");     
         }

      await Address.updateOne({"address._id":addressId},{
        $pull:{
          address:{
            _id:addressId,
          }
        }
      });

      res.redirect("/userProfile");

    } catch (error) {
      console.error("Error occured in deleting Address:",error);
      res.redirect("/pageNotFound");
    }

  }

  const getEditProfilePage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    res.render("edit-profile", {
      user: userData
    });
  } catch (error) {
    console.error("Error loading edit profile page:", error);
    res.redirect("/pageNotFound");
  }
}

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, phone } = req.body;

     const isValidName = (name) => {
  
      if (!name) return false;
      const trimmedName = name.trim();
      if (trimmedName.length < 3) return false;
      if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(trimmedName)) return false;

      return true;
    };
    
     const isValidPhone = (num) => {
      if (!num) return true; 

      if (!/^\d{10}$/.test(num)) return false;
      if (!/^[6-9]/.test(num)) return false;
      if (num === "0000000000" || num === "1000000000") return false;
      if (/^(\d)\1{9}$/.test(num)) return false;

      return true;
    };

    if (!isValidName(name)) {
      return res.render("edit-profile", {
        user: { name, phone },
        message: "Name must be at least 3 characters and contain only letters"
      });
    }

    if (!isValidPhone(phone)) {
      return res.render("edit-profile", {
        user: { name, phone },
        message: "Please enter a valid 10-digit phone number"
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: name.trim(),
        phone },
      { new: true }
    );

    if (updatedUser) {
      req.session.user.phone = updatedUser.phone;
      req.session.user.name = updatedUser.name;
      return res.redirect("/userProfile");
    }

    return res.render("edit-profile", {
      user: { name, phone },
      message: "Failed to update profile"
    });

  } catch (error) {
    console.error("Error updating profile:", error);
    res.redirect("/pageNotFound");
  }
}


const updateProfilePhoto = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: req.file.filename },
      { new: true }
    );

    if (updatedUser) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Profile photo updated successfully",
        profilePhoto: req.file.filename
      });
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "User not found"
      });
    }
  } catch (error) {
    console.error("Error updating profile photo:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while updating profile photo"
    });
  }
};

const removeProfilePhoto = async (req, res) => {
  try {
    const userId = req.session.user;
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: null },
      { new: true }
    );

    if (updatedUser) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Profile photo removed successfully"
      });
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "User not found"
      });
    }
  } catch (error) {
    console.error("Error removing profile photo:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while removing profile photo"
    });
  }
};

module.exports = {
  getForgotPassPage,forgotEmailValid,verifyForgotPassOtp,getResetPassPage,resendOtp,postNewPassword,userProfile,changeEmail,changeEmailValid,verifyEmailOtp,updateEmail,postChangePassword,addAddress,postAddAddress,editAddress,postEditAddress,deleteAddress,getNewEmailPage,updateProfile,getEditProfilePage,updateProfilePhoto,removeProfilePhoto,
}
