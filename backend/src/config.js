require("dotenv").config();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

module.exports = {
  PORT,
  JWT_SECRET,
};


