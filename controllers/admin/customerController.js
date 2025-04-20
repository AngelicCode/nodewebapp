  const User = require("../../models/userSchema");

  const customerInfo = async (req, res) => {
    try {
      let search = req.query.search || "";
      let page = parseInt(req.query.page) || 1;
      const limit = 3;

      // Fetching customer data with search and pagination
      const userData = await User.find({
        isAdmin: false,
        $or: [
          { name: { $regex: ".*" + search + ".*", $options: "i" } },
          { email: { $regex: ".*" + search + ".*", $options: "i" } },
        ],
      })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

      // Counting total documents for pagination
      const count = await User.countDocuments({
        isAdmin: false,
        $or: [
          { name: { $regex: ".*" + search + ".*", $options: "i" } },
          { email: { $regex: ".*" + search + ".*", $options: "i" } },
        ],
      });

      res.render("customers", {
        //customers: userData,
        data: userData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        search,
      });
    } catch (error) {
      console.error("Error loading customers:", error.message);
      res.status(500).send("Internal Server Error");
    }
  };

  const customerBlocked = async (req,res)=>{
    try{
      let id = req.query.id;
      await User.updateOne({_id:id}, {$set:{isBlocked:true}});
      res.redirect("/admin/users");

    }catch(error){
      res.redirect("/pageerror");
    }
  };

  const customerunBlocked = async (req,res)=>{
    try {
      let id = req.query.id;
      await User.updateOne({_id:id},{$set:{isBlocked:false}});
      res.redirect("/admin/users");
    } catch (error) {
      res.redirect("/pageerror");
    }
  };

  module.exports = {
    customerInfo,customerBlocked,customerunBlocked,
  };
