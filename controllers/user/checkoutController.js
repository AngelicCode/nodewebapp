const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");


const loadCheckout = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    if(!userId){
     return res.status(401).json({status:false,message:"User not authenticated"})
    }

    const addressDoc = await Address.findOne({userId:userId});
    const addresses = addressDoc?addressDoc.address :[];

    res.render("checkout",{addresses});

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
}

const checkoutAddAddress = async(req,res)=>{
  try {
    const userId = req.session.user._id;
    if (!userId) {
      return res.status(401).json({ status: false, message: 'User not authenticated' });
        }

      const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;
      if(!name || !city || !state || !pincode || !phone){
        return res.status(400).json({status:false,message:"Missing required fields"});
      }

      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ status: false, message: 'Phone number must be 10 digits' });
      }

      if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ status: false, message: 'Pincode must be 6 digits' });
      }

      if (altPhone && !/^\d{10}$/.test(altPhone)) {
        return res.status(400).json({ status: false, message: 'Alternate phone must be 10 digits' });
      }

      const addressData = {
        addressType: addressType || "Home",
        name,
        city,
        landMark,
        state,
        pincode,
        phone,
        altPhone: altPhone || undefined,
        
      };

      const userAddress = await Address.findOne({userId:userId});
      if(!userAddress){
        const newAddress = new Address({
          userId:userId,
          address:[addressData]
        });
        await newAddress.save();
        
      }else{
        userAddress.address.push(addressData);
        await userAddress.save();
      }
      return res.json({ status: true, message: 'Address added successfully'});
     
    } catch (error) {
      console.error("Error adding address:",error)
      return res.status(500).json({ status: false, message: 'Internal server error' });
      
    }
}


module.exports = {
  loadCheckout,checkoutAddAddress,
}
