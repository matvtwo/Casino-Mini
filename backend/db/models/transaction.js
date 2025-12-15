'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Transaction extends Model {
    static associate(models) {
      Transaction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Transaction.belongsTo(models.User, { foreignKey: 'actorId', as: 'actor' });
    }
  }

  Transaction.init(
    {
      type: { type: DataTypes.ENUM('CREDIT', 'PURCHASE', 'PAYOUT', 'BET'), allowNull: false },
      amount: { type: DataTypes.INTEGER, allowNull: false },
      description: DataTypes.STRING,
      userId: DataTypes.INTEGER,
      actorId: DataTypes.INTEGER,
    },
    { sequelize, modelName: 'Transaction' }
  );

  return Transaction;
};
