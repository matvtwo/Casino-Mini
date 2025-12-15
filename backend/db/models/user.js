'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Bet, { foreignKey: 'userId' });
    }
  }

  User.init(
    {
      username: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      balance: { type: DataTypes.INTEGER, defaultValue: 5000 },
      avatarUrl: DataTypes.STRING,
    },
    { sequelize, modelName: 'User' }
  );

  return User;
};
