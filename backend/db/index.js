// Small helper used by the runtime server code to access Sequelize models.
// The actual model definitions live in `db/models` for sequelize-cli.

const db = require("./models");

module.exports = db;
