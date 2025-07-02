// const User = require("../models/userSchema");

// const userAuth = (req,res,next)=>{
//   if(req.session.user){
//     User.findById(req.session.user)
//     .then(data=>{
//       if(data && !data.isBlocked){
//         next();
//       }else{
//         res.redirect("/login")
//       }
//     })
//     .catch(error=>{
//       console.log("Error in user auth middleware");
//       res.status(500).send("Internal Server error");
//     })

//   }else{
//     res.redirect("/login");
//   }
// }

// // const adminAuth = (req,res,next)=>{
// //   User.findOne({isAdmin:true})
// //   .then(data=>{
// //     if(data){
// //       next();
// //     }else{
// //       res.redirect("/admin/login");
// //     }
// //   })
// //   .catch(error=>{
// //     console.log("Error in admin auth middleware",error);
// //     res.status(500).send("Internal Server Error");
// //   })
// // }
// const adminAuth = (req, res, next) => {
//   if (req.session.admin) {
//     next();
//   } else {
//     res.redirect("/admin/login");
//   }
// };

// // const isBlocked = (req,res,next)=>{
// //   const user = req.session.user;
// //   let find = await User.findOne({user,isBlocked:true})
// //   if(find){
// //     res.redirect("/login")
// //   }else{

// //   }
// //   next();
// // }

// const isBlocked = async (req, res, next) => {
//   try {
//     const sessionUser = req.session.user;
//     console.log("fdddd",sessionUser)
//     if (!sessionUser) {
//       return res.redirect("/login");
//     }

//     const user = await User.find({sessionUser,isBlocked: true });

//     if (user) {
//       return res.redirect("/login"); // ✅ Use return to stop further execution
//     }
//     next(); // ✅ Only called if not blocked
//   } catch (err) {
//     console.error("Middleware error:", err);
//     res.status(500).send("Internal Server Error");
//   }
// };


// module.exports = {
//   userAuth,
//   adminAuth,
//   isBlocked,
// }



const User = require("../models/userSchema");


const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then(data => {
        if (data && !data.isBlocked) {
          next(); 
        } else {
          res.redirect("/login"); 
        }
      })
      .catch(error => {
        console.error("Error in userAuth middleware:", error);
        res.status(500).send("Internal Server Error");
      });
  } else {
    res.redirect("/login");
  }
};


const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {
    res.redirect("/admin/login");
  }
};


const isBlocked = async (req, res, next) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.redirect("/login");
    }

    
    const user = await User.findOne({ _id: sessionUser, isBlocked: true });

    if (user) {
      console.log("User is blocked");
      return res.render('login')
    }

    next(); 
  } catch (err) {
    console.error("Error in isBlocked middleware:", err);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  userAuth,
  adminAuth,
  isBlocked,
};
