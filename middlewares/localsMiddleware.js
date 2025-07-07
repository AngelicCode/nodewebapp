
const setLocals = (req, res, next) => {
  res.locals.req = req; 
  next();
};

module.exports={
  setLocals,
}