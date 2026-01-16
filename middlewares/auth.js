const User = require("../models/userSchema");


const userAuth = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return handleBlocked(req, res);
    }

    const user = await User.findById(req.session.user);

    if (!user || user.isBlocked) {
      req.session.destroy(() => { });
      return handleBlocked(req, res);
    }

    return next();
  } catch (err) {
    console.error("Auth Error:", err);
    res.status(500).send("Internal Server Error");
  }
};

function handleBlocked(req, res) {
  const isAjax =
    req.xhr ||
    req.headers.accept?.includes("application/json") ||
    req.headers["content-type"] === "application/json";

  if (isAjax) {
    res.status(401).json({ blocked: true });
    return;
  }

  res.redirect("/login");
  return;
}


const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {
    res.redirect("/admin/login");
  }
};



const checkSession = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/")
  }
  next();
}


module.exports = {
  userAuth,
  adminAuth,
  checkSession
};
