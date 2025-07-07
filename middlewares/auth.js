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
