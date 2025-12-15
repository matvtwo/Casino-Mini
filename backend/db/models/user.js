'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Bet, { foreignKey: 'userId' });
      User.hasMany(models.Transaction, {
        foreignKey: 'userId',
        as: 'transactions',
      });
      User.hasMany(models.Transaction, {
        foreignKey: 'actorId',
        as: 'actedTransactions',
      });
      User.belongsToMany(models.Item, {
        through: models.UserItem,
        foreignKey: 'userId',
        otherKey: 'itemId',
        as: 'items',
      });
      User.hasMany(models.UserItem, { foreignKey: 'userId' });
    }
  }

  User.init(
    {
      username: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      balance: { type: DataTypes.INTEGER, defaultValue: 5000 },
      avatarUrl: DataTypes.STRING,
      role: {
        type: DataTypes.ENUM('player', 'admin'),
        defaultValue: 'player',
        allowNull: false,
      },
    },
    { sequelize, modelName: 'User' }
  );

  return User;
};
