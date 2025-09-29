module.exports = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://31177eb8c583.ngrok-free.app");
  next();
};