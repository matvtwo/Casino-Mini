require("dotenv").config();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

module.exports = {
  PORT,
  JWT_SECRET,
  ADMIN_SECRET,
};

